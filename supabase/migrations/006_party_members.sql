-- ============================================================
-- 006_party_members.sql
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- 파티 관리: 같은 파티 멤버의 프로필 조회 허용
-- ============================================================

-- profiles 테이블 자기 참조 RLS는 무한 재귀를 일으키므로
-- SECURITY DEFINER 함수로 우회한다
CREATE OR REPLACE FUNCTION my_party_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT party_id FROM profiles WHERE id = auth.uid();
$$;

-- 같은 파티 멤버 프로필 조회 (기존 profiles_select_own 과 OR 결합)
DROP POLICY IF EXISTS "profiles_select_party" ON profiles;
CREATE POLICY "profiles_select_party" ON profiles
  FOR SELECT USING (party_id IS NOT NULL AND party_id = my_party_id());
