'use client';

import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Pencil, Crown, User } from 'lucide-react';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function PartyPage() {
  const { user, profile, loadProfile, joinParty } = useAuth();
  const party   = profile?.parties;
  const isOwner = !!user?.id && party?.created_by === user.id;

  const [members,    setMembers]    = useState([]);
  const [editing,    setEditing]    = useState(false);
  const [nameInput,  setNameInput]  = useState('');
  const [joinCode,   setJoinCode]   = useState('');
  const [joining,    setJoining]    = useState(false);
  const [showJoin,   setShowJoin]   = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [toast,      setToast]      = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  // 멤버 목록 (006 마이그레이션의 profiles_select_party 정책 필요)
  const loadMembers = useCallback(async () => {
    if (!profile?.party_id) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, created_at')
      .eq('party_id', profile.party_id)
      .order('created_at', { ascending: true });
    if (!error) setMembers(data ?? []);
  }, [profile?.party_id]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const copyInviteCode = async () => {
    if (!party?.invite_code) return;
    try {
      await navigator.clipboard.writeText(party.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast('복사에 실패했어요');
    }
  };

  // 파티명 수정 (생성자만)
  const saveName = async () => {
    const name = nameInput.trim();
    if (!name || !party?.id) { setEditing(false); return; }

    const { error } = await supabase
      .from('parties')
      .update({ name })
      .eq('id', party.id);

    if (error) {
      console.error(error);
      showToast('파티명 변경에 실패했어요');
    } else {
      await loadProfile(user.id);
      showToast('파티명이 변경됐어요');
    }
    setEditing(false);
  };

  // 다른 파티 합류
  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { showToast('초대코드 6자리를 입력해주세요'); return; }

    setJoining(true);
    try {
      await joinParty(user.id, code);
      showToast('파티에 합류했어요');
      setShowJoin(false);
      setJoinCode('');
      loadMembers();
    } catch (err) {
      showToast(err.message ?? '합류에 실패했어요');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header title="파티 관리" />

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 flex flex-col gap-6">

          {/* 파티명 */}
          <section>
            <p className="text-[13px] text-subtext mb-1">파티 이름</p>
            {editing ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  maxLength={20}
                  autoFocus
                  className="flex-1 h-[52px] bg-bg border border-primary rounded-xl px-4 text-[15px] text-text outline-none"
                />
                <button
                  onClick={saveName}
                  className="px-5 h-[52px] bg-primary text-white rounded-xl text-[14px] font-semibold"
                >
                  저장
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 h-[52px]">
                <span className="text-[15px] font-semibold text-text">{party?.name ?? '우리 집'}</span>
                {isOwner && (
                  <button
                    onClick={() => { setNameInput(party?.name ?? ''); setEditing(true); }}
                    className="flex items-center justify-center w-8 h-8"
                    aria-label="파티명 수정"
                  >
                    <Pencil size={16} color="#8A94A6" />
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 초대코드 */}
          <section>
            <p className="text-[13px] text-subtext mb-1">초대코드</p>
            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col items-center gap-3">
              <p className="text-[28px] font-bold text-primary tracking-[0.3em] pl-[0.3em]">
                {party?.invite_code ?? '——————'}
              </p>
              <button
                onClick={copyInviteCode}
                className="flex items-center gap-1.5 px-4 h-[40px] bg-bg rounded-xl text-[13px] font-medium text-text active:bg-border transition-colors"
              >
                {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} color="#8A94A6" />}
                {copied ? '복사됨' : '코드 복사'}
              </button>
              <p className="text-[12px] text-subtext text-center leading-relaxed">
                가족에게 코드를 공유하면 재고를 함께 관리할 수 있어요
              </p>
            </div>
          </section>

          {/* 멤버 목록 */}
          <section>
            <p className="text-[13px] font-semibold text-subtext mb-3">
              멤버{members.length > 0 ? ` ${members.length}명` : ''}
            </p>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {members.length === 0 ? (
                <div className="px-4 py-5">
                  <p className="text-[13px] text-subtext text-center">멤버 정보를 불러올 수 없어요</p>
                </div>
              ) : (
                members.map((m, i) => {
                  const isMe      = m.id === user?.id;
                  const isCreator = m.id === party?.created_by;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 px-4 py-3.5"
                      style={{ borderBottom: i < members.length - 1 ? '1px solid #F0F2F5' : 'none' }}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: isCreator ? '#EFF4FF' : '#F4F6FA' }}
                      >
                        <User size={18} color={isCreator ? '#1D6AE5' : '#8A94A6'} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[15px] text-text font-medium">
                          {m.display_name ?? (isMe ? '나' : `멤버 ${i + 1}`)}
                          {isMe && !m.display_name ? '' : isMe ? ' (나)' : ''}
                        </p>
                        <p className="text-[12px] text-subtext mt-0.5">
                          {isCreator ? '파티장' : '멤버'}
                        </p>
                      </div>
                      {isCreator && <Crown size={16} color="#F59E0B" />}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* 다른 파티 합류 */}
          <section>
            {!showJoin ? (
              <button
                onClick={() => setShowJoin(true)}
                className="w-full text-center text-[14px] text-subtext py-2"
              >
                초대코드로 다른 파티에 합류하기 →
              </button>
            ) : (
              <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
                <p className="text-[13px] text-subtext">
                  합류하면 지금 파티의 재고는 더 이상 보이지 않아요
                </p>
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="초대코드 6자리"
                  className="w-full h-[52px] bg-bg border border-border rounded-xl px-4 text-[15px] text-text text-center tracking-[0.3em] uppercase outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowJoin(false); setJoinCode(''); }}
                    className="flex-1 h-[44px] bg-bg border border-border rounded-xl text-[14px] text-text font-medium"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleJoin}
                    disabled={joining || joinCode.length !== 6}
                    className="flex-1 h-[44px] bg-primary text-white rounded-xl text-[14px] font-semibold disabled:bg-disabled"
                  >
                    {joining ? '합류 중...' : '합류하기'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-24 left-5 right-5 z-50 flex justify-center pointer-events-none">
          <div className="bg-[#1A1A2E] text-white rounded-xl px-4 py-3 text-[14px] font-medium shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
