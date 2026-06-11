-- ============================================================
-- 003_food_catalog.sql
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ============================================================

CREATE TABLE IF NOT EXISTS food_catalog (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT    NOT NULL,
  aliases      TEXT[]  NOT NULL DEFAULT '{}',
  category     TEXT    NOT NULL DEFAULT 'etc',
  shelf_days   INT,
  opened_days  INT,
  frozen_days  INT,
  thawed_days  INT,
  default_unit TEXT    NOT NULL DEFAULT '개',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS food_catalog_name_idx ON food_catalog (name);
CREATE INDEX IF NOT EXISTS food_catalog_aliases_idx ON food_catalog USING GIN (aliases);

-- 공개 읽기 허용 (카탈로그는 공용 참조 데이터)
ALTER TABLE food_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_catalog_public_read" ON food_catalog
  FOR SELECT USING (true);

-- ============================================================
-- 시드 데이터
-- ============================================================
INSERT INTO food_catalog (name, aliases, category, shelf_days, opened_days, frozen_days, thawed_days, default_unit) VALUES
-- 유제품
('우유',       ARRAY['milk', '우유'],                    '유제품',   14,   5,   30,  3,  'ml'),
('두유',       ARRAY['soy milk', '두유', '콩우유'],       '유제품',   10,   4,   30,  3,  'ml'),
('달걀',       ARRAY['egg', '계란', '달걀'],              '달걀',     28, NULL,  60, NULL, '개'),
('요거트',     ARRAY['yogurt', '요구르트', '요거트'],     '유제품',   14,   7,   60,  5,  '개'),
('치즈',       ARRAY['cheese', '치즈'],                  '유제품',   30,  14,   90,  7,  '장'),
('버터',       ARRAY['butter', '버터'],                  '유제품',   30,  14,  180, 14,  'g'),
('생크림',     ARRAY['heavy cream', '생크림', '휘핑크림'],'유제품',    7,   3,   60,  2,  'ml'),

-- 채소
('두부',       ARRAY['tofu', '두부'],                    '두부류',    7,   2,   60,  2,  '모'),
('콩나물',     ARRAY['bean sprout', '콩나물'],            '채소',      5,   3,   30,  2,  '봉'),
('시금치',     ARRAY['spinach', '시금치'],                '채소',      5,   3,   30,  2,  '봉'),
('당근',       ARRAY['carrot', '당근'],                  '채소',     21,  10,   90,  5,  '개'),
('브로콜리',   ARRAY['broccoli', '브로콜리'],             '채소',      7,   5,   30,  3,  '개'),
('양배추',     ARRAY['cabbage', '양배추'],                '채소',     14,   7,   60,  5,  '통'),
('오이',       ARRAY['cucumber', '오이'],                '채소',      7,   5,   30,  3,  '개'),
('애호박',     ARRAY['zucchini', '호박', '애호박'],       '채소',      7,   5,   30,  3,  '개'),
('파프리카',   ARRAY['paprika', '파프리카'],              '채소',      7,   5,   30,  3,  '개'),
('버섯',       ARRAY['mushroom', '버섯', '느타리', '표고'], '채소',    5,   3,   30,  2,  '팩'),
('대파',       ARRAY['green onion', '대파', '쪽파'],     '채소',      7,   5,   30,  3,  '대'),
('양파',       ARRAY['onion', '양파'],                   '실온채소',  30,  14,   90,  7,  '개'),
('감자',       ARRAY['potato', '감자'],                  '실온채소',  30,  14,   90,  7,  '개'),
('고구마',     ARRAY['sweet potato', '고구마'],          '실온채소',  30,  14,   90,  7,  '개'),
('마늘',       ARRAY['garlic', '마늘', '다진마늘'],       '실온채소',  21,   7,  180, 14,  '통'),
('생강',       ARRAY['ginger', '생강'],                  '실온채소',  21,  14,  180, 14,  '개'),

-- 육류
('닭가슴살',   ARRAY['chicken breast', '닭가슴살', '닭'],  '육류',    3, NULL,  180,  2,  'g'),
('닭다리',     ARRAY['chicken leg', '닭다리', '닭봉'],    '육류',     3, NULL,  180,  2,  '개'),
('삼겹살',     ARRAY['pork belly', '삼겹살'],             '육류',     3, NULL,  180,  2,  'g'),
('돼지고기',   ARRAY['pork', '돼지고기', '돼지'],         '육류',     3, NULL,  180,  2,  'g'),
('소고기',     ARRAY['beef', '소고기', '소'],             '육류',     3, NULL,  180,  2,  'g'),
('다진고기',   ARRAY['ground meat', '다진고기', '간고기'], '육류',    2, NULL,  120,  2,  'g'),
('소시지',     ARRAY['sausage', '소시지', '비엔나'],       '육류',    14,   7,   60,  3,  '개'),
('햄',         ARRAY['ham', '햄', '스팸'],                '육류',    14,   7,   90,  3,  '개'),

-- 해산물
('연어',       ARRAY['salmon', '연어'],                   '해산물',   2, NULL,   90,  1,  'g'),
('고등어',     ARRAY['mackerel', '고등어'],               '해산물',   2, NULL,   90,  1,  '마리'),
('새우',       ARRAY['shrimp', '새우'],                   '해산물',   2, NULL,   90,  1,  'g'),
('오징어',     ARRAY['squid', '오징어'],                  '해산물',   2, NULL,   90,  1,  '마리'),
('조개',       ARRAY['clam', '조개', '바지락'],           '해산물',   2, NULL,   60,  1,  'g'),
('명란',       ARRAY['mentaiko', '명란', '명란젓'],       '해산물',  14,   7,   90,  5,  'g'),

-- 발효식품/반찬
('김치',       ARRAY['kimchi', '김치'],                   '발효식품', 180,  30,  365, 14,  'kg'),
('깍두기',     ARRAY['kkakdugi', '깍두기'],               '발효식품', 90,   21,  180,  7,  'g'),
('된장',       ARRAY['doenjang', '된장'],                 '발효식품', 365,  90, NULL, NULL, 'g'),
('고추장',     ARRAY['gochujang', '고추장'],              '발효식품', 365,  90, NULL, NULL, 'g'),
('간장',       ARRAY['soy sauce', '간장'],                '조미료',   365, 180, NULL, NULL, 'ml'),
('참기름',     ARRAY['sesame oil', '참기름'],             '조미료',   365,  90, NULL, NULL, 'ml'),
('식용유',     ARRAY['cooking oil', '식용유'],            '조미료',   365,  90, NULL, NULL, 'ml'),

-- 빵/면/가공
('식빵',       ARRAY['bread', '식빵', '토스트'],          '빵',       5,   3,   30,  1,  '봉'),
('계란빵',     ARRAY['egg bread', '계란빵'],              '빵',       2,   1,   14,  1,  '개'),
('라면',       ARRAY['ramen', '라면', '라면면'],          '면류',     180, NULL, NULL, NULL, '개'),
('파스타',     ARRAY['pasta', '스파게티', '파스타'],      '면류',     365, NULL, NULL, NULL, 'g'),
('쌀',         ARRAY['rice', '쌀', '백미'],              '곡물',     365, 180, NULL, NULL, 'kg'),
('두부면',     ARRAY['tofu noodle', '두부면'],            '두부류',    5,   3,   30,  2,  '봉'),

-- 음료/기타
('주스',       ARRAY['juice', '주스', '오렌지주스'],      '음료',     14,   5,   30,  3,  'ml'),
('탄산음료',   ARRAY['soda', '콜라', '사이다', '탄산'],   '음료',     90,  14,  NULL, NULL, 'ml'),
('맥주',       ARRAY['beer', '맥주'],                    '음료',     180,  NULL, NULL, NULL, '캔'),

-- 영양제
('종합비타민', ARRAY['multivitamin', '종합비타민', '멀티비타민'], '영양제', 730, NULL, NULL, NULL, '정'),
('비타민C',    ARRAY['vitamin c', '비타민c', '비타민씨'],  '영양제',  365, NULL, NULL, NULL, '정'),
('오메가3',    ARRAY['omega3', '오메가3', '피쉬오일'],    '영양제',   365, NULL, NULL, NULL, '캡슐'),
('유산균',     ARRAY['probiotic', '유산균', '프로바이오틱'], '영양제', 365, NULL, NULL, NULL, '캡슐'),
('단백질파우더', ARRAY['protein', '단백질', '프로틴'],   '영양제',  365,  180, NULL, NULL, 'g');
