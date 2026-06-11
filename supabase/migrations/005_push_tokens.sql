-- ============================================================
-- 005_push_tokens.sql
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- 푸시 알림: FCM 토큰 저장 + 발송 로그
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_token    TEXT,
  ADD COLUMN IF NOT EXISTS push_platform TEXT
    CHECK (push_platform IN ('ios', 'android', 'web'));

-- 같은 시간대 중복 발송 방지용 로그
CREATE TABLE IF NOT EXISTS notification_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title      TEXT,
  body       TEXT,
  item_count INT         NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS notification_logs_profile_sent_idx
  ON notification_logs (profile_id, sent_at DESC);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- 본인 로그만 조회 (쓰기는 service role 전용)
CREATE POLICY "notification_logs_select_own" ON notification_logs
  FOR SELECT USING (profile_id = auth.uid());

-- ============================================================
-- (참고) 알림 발송 스케줄링: Supabase Dashboard > Database > Cron
-- 매 30분마다 send-expiry-notifications Edge Function 호출
--
-- SELECT cron.schedule(
--   'send-expiry-notifications',
--   '*/30 * * * *',
--   $$
--   SELECT net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-expiry-notifications',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--     body    := '{}'::jsonb
--   );
--   $$
-- );
-- ============================================================
