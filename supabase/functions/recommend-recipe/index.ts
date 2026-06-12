// Supabase Edge Function: recommend-recipe
// POST { party_id, selected_names? } → { recipes: [...], based_on: [...] }
// selected_names: 사용자가 직접 고른 재료 이름 배열 (있으면 반드시 활용)
// 필수 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── 타입 정의 ────────────────────────────────────────────────

interface ItemRow {
  name:                  string;
  quantity:              number;
  unit:                  string;
  effective_expiry_date: string | null;
  storage_type:          string;
}

interface Recipe {
  name:             string;
  description:      string;
  time_minutes:     number;
  difficulty:       '쉬움' | '보통' | '어려움';
  ingredients_have: string[];
  ingredients_need: string[];
  steps:            string[];
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `당신은 한국 가정식 요리 전문가입니다.
사용자의 냉장고 재고 목록(유통기한 임박 순)을 받아, 임박한 재료를 우선 소진할 수 있는 요리 3가지를 추천하세요.
아래 JSON 배열 형식으로만 응답하세요. 다른 설명, 마크다운, 코드블록 없이 순수 JSON만 반환하세요.

[
  {
    "name": "요리 이름",
    "description": "한 줄 설명 (어떤 임박 재료를 소진하는지 포함)",
    "time_minutes": 조리시간(정수, 분),
    "difficulty": "쉬움|보통|어려움 중 하나",
    "ingredients_have": ["재고에 있는 사용 재료"],
    "ingredients_need": ["추가로 필요한 재료 (기본 양념 제외)"],
    "steps": ["조리 단계 1", "조리 단계 2", "..."]
  }
]

규칙:
- 유통기한이 임박한 재료를 반드시 1개 이상 활용하세요
- ingredients_have에는 재고 목록에 실제로 있는 이름만 넣으세요
- 소금, 설탕, 간장, 식용유 등 기본 양념은 ingredients_need에서 생략하세요
- steps는 3~6단계로 간결하게 작성하세요
- 일반 가정에서 30분 내외로 만들 수 있는 요리 위주로 추천하세요`;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── 메인 핸들러 ───────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { party_id, selected_names } = await req.json();
    if (!party_id) return json({ error: 'party_id 가 필요합니다' }, 400);

    const selectedList: string[] = Array.isArray(selected_names)
      ? selected_names.filter((n: unknown) => typeof n === 'string').slice(0, 15)
      : [];

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 1. 재고 조회 (임박 순, 식재료 위주) ───────────────────
    const { data, error: itemsErr } = await supabase
      .from('items')
      .select('name, quantity, unit, effective_expiry_date, storage_type')
      .eq('party_id', party_id)
      .eq('status', 'active')
      .neq('storage_type', 'supplement')
      .order('effective_expiry_date', { ascending: true, nullsFirst: false })
      .limit(30);

    if (itemsErr) throw itemsErr;

    const items = (data as ItemRow[]) ?? [];
    if (items.length === 0) {
      return json({ recipes: [], based_on: [], reason: 'no_items' });
    }

    // ── 2. 프롬프트용 재고 목록 구성 ─────────────────────────
    const today = todayStr();
    const lines = items.map(i => {
      let urgency = '기한 미정';
      if (i.effective_expiry_date) {
        const dday = Math.floor(
          (new Date(i.effective_expiry_date).getTime() - new Date(today).getTime()) / 86400000,
        );
        urgency = dday < 0 ? '기한 지남' : dday === 0 ? '오늘까지' : `D-${dday}`;
      }
      return `- ${i.name} ${i.quantity}${i.unit} (${urgency})`;
    });

    // ── 3. Claude API 호출 ────────────────────────────────────
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 2048,
        system:     SYSTEM_PROMPT,
        messages: [
          {
            role:    'user',
            content:
              `현재 재고 목록 (유통기한 임박 순):\n${lines.join('\n')}\n\n` +
              (selectedList.length > 0
                ? `사용자가 꼭 쓰고 싶은 재료: ${selectedList.join(', ')}\n위 재료를 각 요리마다 최소 1개 이상 반드시 사용해서 요리 3가지를 추천해주세요.`
                : '이 재고로 만들 수 있는 요리 3가지를 추천해주세요.'),
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude API 오류 (${claudeRes.status}): ${errText}`);
    }

    const claudeData = await claudeRes.json();
    const rawText: string = claudeData.content?.[0]?.text ?? '[]';

    // ── 4. JSON 파싱 ──────────────────────────────────────────
    let recipes: Recipe[] = [];
    try {
      const cleaned = rawText
        .replace(/```json?\n?/g, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      recipes = Array.isArray(parsed) ? parsed : [];
    } catch {
      recipes = [];
    }

    // 추천 근거 재료: 사용자 선택 우선, 없으면 임박 상위 5개
    const basedOn = selectedList.length > 0
      ? selectedList.slice(0, 5)
      : items
          .filter(i => i.effective_expiry_date)
          .slice(0, 5)
          .map(i => i.name);

    return json({ recipes, based_on: basedOn });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return json({ error: message }, 500);
  }
});
