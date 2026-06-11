// Supabase Edge Function: barcode-lookup
// POST { barcode } → { found, product?: {...}, catalog?: {...} }
// 필수 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOOD_SAFETY_API_KEY
// 식품안전나라 바코드연계제품정보 (C005) 공공 API 사용

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── 타입 정의 ────────────────────────────────────────────────

interface C005Row {
  PRDLST_NM:    string;  // 제품명
  PRDLST_DCNM:  string;  // 식품 유형 (예: 과자, 음료류)
  POG_DAYCNT:   string;  // 유통기한 표기 (예: "제조일로부터 12개월", "60일")
  BSSH_NM:      string;  // 제조사
  BRCD_NO:      string;  // 바코드
}

interface CatalogRow {
  id:           string;
  name:         string;
  category:     string;
  default_unit: string;
  shelf_days:   number | null;
  opened_days:  number | null;
  frozen_days:  number | null;
}

// ─── 상수 ─────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 식품 유형 → 앱 카테고리/보관위치 대략 매핑
const TYPE_MAP: { pattern: RegExp; category: string; storage_type: string }[] = [
  { pattern: /우유|유제품|치즈|발효유|버터/, category: '유제품',   storage_type: 'fridge' },
  { pattern: /김치|장류|젓갈|절임/,          category: '발효식품', storage_type: 'fridge' },
  { pattern: /음료|차|커피|주스/,            category: '음료',     storage_type: 'pantry' },
  { pattern: /면류|라면|국수/,               category: '면류',     storage_type: 'pantry' },
  { pattern: /빵|과자|스낵|초콜릿|캔디/,     category: '빵',       storage_type: 'pantry' },
  { pattern: /육류|햄|소시지|축산/,          category: '육류',     storage_type: 'fridge' },
  { pattern: /수산|어묵|맛살/,               category: '해산물',   storage_type: 'fridge' },
  { pattern: /건강기능|영양/,                category: '영양제',   storage_type: 'supplement' },
];

// ─── 유틸 ─────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// "제조일로부터 12개월", "60일", "24개월" 등 → 일수
function parseShelfDays(raw: string | undefined): number | null {
  if (!raw) return null;
  const monthMatch = raw.match(/(\d+)\s*개월/);
  if (monthMatch) return Number(monthMatch[1]) * 30;
  const yearMatch = raw.match(/(\d+)\s*년/);
  if (yearMatch) return Number(yearMatch[1]) * 365;
  const dayMatch = raw.match(/(\d+)\s*일/);
  if (dayMatch) return Number(dayMatch[1]);
  return null;
}

function classify(typeName: string | undefined): { category: string; storage_type: string } {
  if (typeName) {
    for (const t of TYPE_MAP) {
      if (t.pattern.test(typeName)) return { category: t.category, storage_type: t.storage_type };
    }
  }
  return { category: '기타', storage_type: 'pantry' };
}

// ─── 메인 핸들러 ───────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { barcode } = await req.json();
    if (!barcode || !/^\d{6,14}$/.test(String(barcode))) {
      return json({ error: '유효한 바코드 번호가 필요합니다' }, 400);
    }

    const apiKey = Deno.env.get('FOOD_SAFETY_API_KEY');
    if (!apiKey) throw new Error('FOOD_SAFETY_API_KEY 환경변수가 설정되지 않았습니다');

    // ── 1. 식품안전나라 C005 조회 ────────────────────────────
    const url = `https://openapi.foodsafetykorea.go.kr/api/${apiKey}/C005/json/1/5/BAR_CD=${barcode}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`공공 API 오류 (${res.status})`);

    const data = await res.json();
    const rows: C005Row[] = data?.C005?.row ?? [];

    if (rows.length === 0) {
      return json({ found: false });
    }

    const row = rows[0];
    const { category, storage_type } = classify(row.PRDLST_DCNM);
    const shelfDaysFromApi = parseShelfDays(row.POG_DAYCNT);

    // ── 2. food_catalog 매칭 (이름 기반) ─────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let catalog: CatalogRow | null = null;
    const productName = (row.PRDLST_NM ?? '').trim();
    if (productName) {
      // 제품명 전체 → 부분 일치 순으로 시도
      const { data: exact } = await supabase
        .from('food_catalog')
        .select('id, name, category, default_unit, shelf_days, opened_days, frozen_days')
        .ilike('name', productName)
        .limit(1)
        .maybeSingle<CatalogRow>();
      catalog = exact ?? null;

      if (!catalog) {
        const { data: partial } = await supabase
          .from('food_catalog')
          .select('id, name, category, default_unit, shelf_days, opened_days, frozen_days')
          .filter('name', 'ilike', `%${productName.split(' ')[0]}%`)
          .limit(1)
          .maybeSingle<CatalogRow>();
        catalog = partial ?? null;
      }
    }

    return json({
      found: true,
      product: {
        barcode:      String(barcode),
        name:         productName,
        type_name:    row.PRDLST_DCNM ?? null,
        manufacturer: row.BSSH_NM     ?? null,
        shelf_days:   shelfDaysFromApi,
        category:     catalog?.category ?? category,
        storage_type,
      },
      catalog,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return json({ error: message }, 500);
  }
});
