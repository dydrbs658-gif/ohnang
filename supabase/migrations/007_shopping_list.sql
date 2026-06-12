-- ============================================================
-- 007_shopping_list.sql
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- 장보기 목록: 파티 단위 공유 쇼핑 리스트
-- ============================================================

CREATE TABLE shopping_items (
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

CREATE INDEX shopping_items_party_idx ON shopping_items (party_id, is_checked, created_at DESC);

-- Row Level Security
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopping_select_party" ON shopping_items
  FOR SELECT USING (
    party_id IN (SELECT party_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "shopping_insert_party" ON shopping_items
  FOR INSERT WITH CHECK (
    party_id IN (SELECT party_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "shopping_update_party" ON shopping_items
  FOR UPDATE USING (
    party_id IN (SELECT party_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "shopping_delete_party" ON shopping_items
  FOR DELETE USING (
    party_id IN (SELECT party_id FROM profiles WHERE id = auth.uid())
  );

-- Realtime 발행 (파티 멤버 간 실시간 동기화)
ALTER PUBLICATION supabase_realtime ADD TABLE shopping_items;
