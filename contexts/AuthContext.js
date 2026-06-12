'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, parties(*)')
      .eq('id', userId)
      .single();
    if (!error) setProfile(data);
    return data;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        loadProfile(u.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          await loadProfile(u.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signInAnonymously = async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.user;
  };

  const createProfileAndParty = async (userId, { notificationSettings, partyType, partyName }) => {
    // 재시도 시 기존 파티 재사용 (중복 파티 생성 방지)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, party_id')
      .eq('id', userId)
      .maybeSingle();

    let party;

    if (existingProfile?.party_id) {
      // 프로필+파티 이미 존재 → 기존 파티 그대로 사용
      const { data: existingParty, error } = await supabase
        .from('parties')
        .select()
        .eq('id', existingProfile.party_id)
        .single();
      if (error) throw error;
      party = existingParty;
    } else {
      // 새 파티 생성 — ID를 클라이언트에서 생성해 INSERT 후 SELECT RLS 문제 회피
      // (parties_select_member 정책이 profiles.party_id를 참조하므로, 프로필 생성 전에
      //  .select()를 체이닝하면 0 rows가 반환되어 .single()이 에러를 던진다)
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const inviteCode = Array.from({ length: 6 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join('');
      const partyId = crypto.randomUUID();

      const { error: partyError } = await supabase
        .from('parties')
        .insert({ id: partyId, created_by: userId, invite_code: inviteCode, name: partyName || '우리 집' });
      if (partyError) throw partyError;

      party = { id: partyId, created_by: userId, invite_code: inviteCode, name: partyName || '우리 집' };
    }

    // 프로필 upsert (재시도 시 중복 키 에러 방지)
    const profileData = {
      id: userId,
      party_id: party.id,
      onboarding_done: true,
      notification_enabled: notificationSettings?.enabled ?? true,
      notification_freq: notificationSettings?.freq ?? 'daily',
      notification_count: notificationSettings?.count ?? 1,
      notification_times: notificationSettings?.times ?? ['15:00'],
    };

    const { data: prof, error: profileError } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })
      .select()
      .single();
    if (profileError) throw profileError;

    const merged = { ...prof, parties: party };
    setProfile(merged);
    return merged;
  };

  const joinParty = async (userId, inviteCode) => {
    const { data: party, error } = await supabase
      .from('parties')
      .select()
      .eq('invite_code', inviteCode.toUpperCase())
      .single();
    if (error || !party) throw new Error('유효하지 않은 초대코드예요');

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ party_id: party.id })
      .eq('id', userId);
    if (updateError) throw updateError;

    await loadProfile(userId);
  };

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signInAnonymously, createProfileAndParty, joinParty, loadProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
