-- ============================================================
-- 002_items_schema.sql
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ============================================================

CREATE TABLE IF NOT EXISTS items (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id              UUID        NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  created_by            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  name                  TEXT        NOT NULL,
  category              TEXT        NOT NULL DEFAULT 'etc',
  storage_type          TEXT        NOT NULL DEFAULT 'fridge'
    CHECK (storage_type IN ('fridge', 'freezer', 'pantry', 'supplement', 'etc')),
  quantity              INT         NOT NULL DEFAULT 1,
  unit                  TEXT        NOT NULL DEFAULT '개',
  label_expiry_date     DATE,
  purchase_date         DATE        NOT NULL DEFAULT CURRENT_DATE,
  opened_at             DATE,
  is_opened             BOOLEAN     NOT NULL DEFAULT FALSE,
  frozen_at             DATE,
  is_frozen             BOOLEAN     NOT NULL DEFAULT FALSE,
  effective_expiry_date DATE,
  expiry_is_estimated   BOOLEAN     NOT NULL DEFAULT FALSE,
  catalog_id            UUID,
  status                TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'eaten', 'discarded')),
  eaten_at              TIMESTAMPTZ,
  discarded_at          TIMESTAMPTZ,
  memo                  TEXT,
  image_url             TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS items_party_id_idx    ON items (party_id);
CREATE INDEX IF NOT EXISTS items_status_idx      ON items (status);
CREATE INDEX IF NOT EXISTS items_expiry_idx      ON items (effective_expiry_date);

CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_select_party" ON items
  FOR SELECT USING (
    party_id IN (SELECT party_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "items_insert_party" ON items
  FOR INSERT WITH CHECK (
    party_id IN (SELECT party_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "items_update_party" ON items
  FOR UPDATE USING (
    party_id IN (SELECT party_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "items_delete_party" ON items
  FOR DELETE USING (
    party_id IN (SELECT party_id FROM profiles WHERE id = auth.uid())
  );

-- Realtime 활성화 (Supabase Dashboard > Database > Replication 에서도 설정 필요)
ALTER PUBLICATION supabase_realtime ADD TABLE items;
