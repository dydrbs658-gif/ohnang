-- ============================================================
-- 007_shopping_list.sql
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- 장보기 목록: 파티 단위 공유 쇼핑 리스트
-- (멱등 스크립트 — 여러 번 실행해도 안전)
-- ============================================================

CREATE TABLE IF NOT EXISTS shopping_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id    UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  quantity    INT  NOT NULL DEFAULT 1,
  unit        TEXT NOT NULL DEFAULT '개',
  is_checked  BOOLEAN NOT NULL DEFAULT FALSE,
  checked_at  TIMESTAMPTZ,
  -- '먹었어요' 처리한 재고에서 넘어온 경우 원본 추적 (재등록 프리필용)
  source_item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shopping_items_party_idx
  ON shopping_items (party_id, is_checked, created_at DESC);

-- Row Level Security
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopping_select_party" ON shopping_items;
CREATE POLICY "shopping_select_party" ON shopping_items
  FOR SELECT USING (
    party_id IN (SELECT party_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "shopping_insert_party" ON shopping_items;
CREATE POLICY "shopping_insert_party" ON shopping_items
  FOR INSERT WITH CHECK (
    party_id IN (SELECT party_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "shopping_update_party" ON shopping_items;
CREATE POLICY "shopping_update_party" ON shopping_items
  FOR UPDATE USING (
    party_id IN (SELECT party_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "shopping_delete_party" ON shopping_items;
CREATE POLICY "shopping_delete_party" ON shopping_items
  FOR DELETE USING (
    party_id IN (SELECT party_id FROM profiles WHERE id = auth.uid())
  );

-- Realtime 발행 (파티 멤버 간 실시간 동기화) — 이미 등록돼 있으면 건너뜀
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'shopping_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shopping_items;
  END IF;
END $$;

-- ── 실행 후 확인용 (선택) ──────────────────────────────────
-- SELECT policyname FROM pg_policies WHERE tablename = 'shopping_items';
-- SELECT * FROM pg_publication_tables WHERE tablename = 'shopping_items';
