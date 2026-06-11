-- ============================================================
-- 001_initial_schema.sql
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ============================================================

-- Parties (household / group)
CREATE TABLE IF NOT EXISTS parties (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL DEFAULT '우리 집',
  invite_code  TEXT        UNIQUE NOT NULL,
  created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles (one per auth.user)
CREATE TABLE IF NOT EXISTS profiles (
  id                   UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  party_id             UUID        REFERENCES parties(id) ON DELETE SET NULL,
  display_name         TEXT,
  notification_enabled BOOLEAN     NOT NULL DEFAULT TRUE,
  notification_freq    TEXT        NOT NULL DEFAULT 'daily'
    CHECK (notification_freq IN ('daily', '3x_week', 'weekly', 'random')),
  notification_count   INT         NOT NULL DEFAULT 1
    CHECK (notification_count BETWEEN 1 AND 3),
  notification_times   TEXT[]      NOT NULL DEFAULT ARRAY['15:00'],
  onboarding_done      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_anonymous         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parties_updated_at
  BEFORE UPDATE ON parties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE parties  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: 자신의 레코드만
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Parties: 해당 파티 멤버만 조회, 생성자만 수정
CREATE POLICY "parties_select_member" ON parties
  FOR SELECT USING (
    id IN (SELECT party_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "parties_insert_own" ON parties
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "parties_update_owner" ON parties
  FOR UPDATE USING (created_by = auth.uid());
