// Supabase Edge Function: analyze-photo
// POST { scan_id } → { items: [...] }
// 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

import { serve }         from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient }  from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `당신은 식품/식재료/영양제를 사진에서 인식하는 전문가입니다.
사진에서 보이는 모든 식품 항목을 인식하고, 아래 JSON 배열 형식으로만 응답하세요.
다른 설명, 마크다운, 코드블록 없이 순수 JSON만 반환하세요.

[
  {
    "name": "한국어 품목명",
    "category": "유제품|채소|육류|해산물|발효식품|면류|빵|음료|영양제|기타 중 하나",
    "storage_type": "fridge|freezer|pantry|supplement|etc 중 하나",
    "quantity": 수량(정수, 불명확하면 1),
    "unit": "개|g|ml|봉|팩|통|캔|모|장 중 적절한 것",
    "confidence": "high 또는 low"
  }
]

규칙:
- 동일 품목이 여러 개면 quantity를 합산하세요
- 브랜드명보다 일반 품목명 사용 (예: "서울우유" → "우유")
- 불확실하면 confidence를 "low"로 설정
- 식품이 없으면 빈 배열 [] 반환`;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  );

  try {
    const { scan_id } = await req.json();
    if (!scan_id) throw new Error('scan_id 가 필요합니다');

    // ── 1. scan 레코드 조회 ──────────────────────────────────
    const { data: scan, error: scanErr } = await supabase
      .from('scans')
      .select('id, image_path, party_id')
      .eq('id', scan_id)
      .single();

    if (scanErr || !scan) throw new Error('scan 레코드를 찾을 수 없습니다');

    // processing 상태로 업데이트
    await supabase.from('scans').update({ status: 'processing' }).eq('id', scan_id);

    // ── 2. Storage 에서 이미지 다운로드 ──────────────────────
    const { data: imageBlob, error: downloadErr } = await supabase
      .storage.from('scans')
      .download(scan.image_path);

    if (downloadErr || !imageBlob) throw new Error('이미지 다운로드 실패');

    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64Image = arrayBufferToBase64(arrayBuffer);
    const mediaType   = imageBlob.type || 'image/jpeg';

    // ── 3. Claude Vision API 호출 ────────────────────────────
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       Deno.env.get('ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        system:     SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: mediaType, data: base64Image },
            },
            {
              type: 'text',
              text: '이 사진에 있는 식품을 모두 인식해주세요.',
            },
          ],
        }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude API 오류: ${errText}`);
    }

    const claudeData = await claudeRes.json();
    const rawText    = claudeData.content?.[0]?.text ?? '[]';

    // ── 4. JSON 파싱 ──────────────────────────────────────────
    let aiItems = [];
    try {
      // 코드블록 감싸진 경우 제거
      const cleaned = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      aiItems = JSON.parse(cleaned);
      if (!Array.isArray(aiItems)) aiItems = [];
    } catch {
      aiItems = [];
    }

    // ── 5. food_catalog 매칭 ─────────────────────────────────
    const unmatchedNames = [];

    const enrichedItems = await Promise.all(
      aiItems.map(async (item) => {
        const q = item.name?.trim();
        if (!q) return null;

        const { data: catalog } = await supabase
          .from('food_catalog')
          .select('id, name, category, default_unit, shelf_days, opened_days, frozen_days, thawed_days')
          .ilike('name', `%${q}%`)
          .limit(1)
          .single();

        if (!catalog) unmatchedNames.push({ name: q, category: item.category, scan_id });

        return {
          name:         catalog?.name  ?? item.name,
          category:     catalog?.category ?? item.category ?? 'etc',
          storage_type: item.storage_type ?? 'fridge',
          quantity:     item.quantity ?? 1,
          unit:         catalog?.default_unit ?? item.unit ?? '개',
          confidence:   item.confidence ?? 'high',
          catalog_id:   catalog?.id       ?? null,
          shelf_days:   catalog?.shelf_days  ?? null,
          opened_days:  catalog?.opened_days ?? null,
          frozen_days:  catalog?.frozen_days ?? null,
          thawed_days:  catalog?.thawed_days ?? null,
        };
      })
    );

    const items = enrichedItems.filter(Boolean);

    // ── 6. unmatched_items_log 기록 ──────────────────────────
    if (unmatchedNames.length > 0) {
      await supabase.from('unmatched_items_log').insert(unmatchedNames);
    }

    // ── 7. scan 레코드 완료 업데이트 ─────────────────────────
    await supabase
      .from('scans')
      .update({ status: 'done', result: { items } })
      .eq('id', scan_id);

    return new Response(JSON.stringify({ items }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    // 오류 시 scan 레코드에 에러 기록
    try {
      const { scan_id } = await req.clone().json().catch(() => ({}));
      if (scan_id) {
        const sb = createClient(
          Deno.env.get('SUPABASE_URL'),
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        );
        await sb.from('scans').update({ status: 'error', error_msg: err.message }).eq('id', scan_id);
      }
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
