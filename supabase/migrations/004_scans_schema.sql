-- ============================================================
-- 004_scans_schema.sql
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- Storage 버킷 "scans" 도 Dashboard > Storage 에서 생성하세요 (private)
-- ============================================================

CREATE TABLE IF NOT EXISTS scans (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id     UUID        NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  image_path   TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'error')),
  result       JSONB,
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER scans_updated_at
  BEFORE UPDATE ON scans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scans_party_access" ON scans
  FOR ALL USING (
    party_id IN (SELECT party_id FROM profiles WHERE id = auth.uid())
  );

-- ─── AI가 인식하지 못한 품목 로그 (카탈로그 개선용) ───────────
CREATE TABLE IF NOT EXISTS unmatched_items_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  category   TEXT,
  scan_id    UUID        REFERENCES scans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Storage 버킷 RLS 정책 (Dashboard > Storage > scans > Policies) ────
-- INSERT: auth.uid() IS NOT NULL
-- SELECT: party_id folder 기준 — (storage.foldername(name))[1] IN
--   (SELECT party_id::text FROM profiles WHERE id = auth.uid())
-- DELETE: 위와 동일
