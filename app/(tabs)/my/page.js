'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Bell, ChevronRight, Copy } from 'lucide-react';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ─── 대시보드 통계 카드 ───────────────────────────────────────
function StatCard({ label, value, accent }) {
  return (
    <div className="flex-1 bg-surface border border-border rounded-xl p-4">
      <p className="text-[12px] text-subtext">{label}</p>
      <p className="text-[22px] font-bold mt-1" style={{ color: accent ?? '#1A1A2E' }}>
        {value ?? '—'}
      </p>
    </div>
  );
}

export default function MyPage() {
  const { user, profile } = useAuth();
  const partyId   = profile?.party_id;
  const partyName = profile?.parties?.name ?? '우리 집';
  const inviteCode = profile?.parties?.invite_code;

  const [stats, setStats] = useState(null); // { active, eaten, discarded }
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  // 이번 달 통계
  useEffect(() => {
    if (!partyId) return;
    (async () => {
      const start = monthStart();
      const base  = () => supabase.from('items').select('id', { count: 'exact', head: true }).eq('party_id', partyId);

      const [activeRes, eatenRes, discardedRes] = await Promise.all([
        base().eq('status', 'active'),
        base().eq('status', 'eaten').gte('eaten_at', start),
        base().eq('status', 'discarded').gte('discarded_at', start),
      ]);

      setStats({
        active:    activeRes.count    ?? 0,
        eaten:     eatenRes.count     ?? 0,
        discarded: discardedRes.count ?? 0,
      });
    })();
  }, [partyId]);

  const copyInviteCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      showToast('초대코드가 복사됐어요');
    } catch {
      showToast('복사에 실패했어요');
    }
  };

  // 먹은 비율 (이번 달 소비 완료 중)
  const total    = (stats?.eaten ?? 0) + (stats?.discarded ?? 0);
  const eatenPct = total > 0 ? Math.round((stats.eaten / total) * 100) : null;

  const menuItems = [
    { href: '/my/party',    icon: Users, label: '파티 관리',  desc: '멤버 확인 · 초대코드' },
    { href: '/my/settings', icon: Bell,  label: '알림 설정',  desc: '빈도 · 시간 변경' },
  ];

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header title="마이" showBack={false} />

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 flex flex-col gap-6">

          {/* 파티 카드 */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-subtext">우리 파티</p>
                <p className="text-[18px] font-semibold text-text mt-0.5">{partyName}</p>
              </div>
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#EFF4FF' }}
              >
                <Users size={24} color="#1D6AE5" />
              </div>
            </div>
            {inviteCode && (
              <button
                onClick={copyInviteCode}
                className="mt-3 w-full flex items-center justify-between bg-bg rounded-xl px-4 py-3 active:bg-border transition-colors"
              >
                <span className="text-[13px] text-subtext">초대코드</span>
                <span className="flex items-center gap-1.5 text-[15px] font-semibold text-primary tracking-widest">
                  {inviteCode}
                  <Copy size={14} />
                </span>
              </button>
            )}
          </div>

          {/* 이번 달 대시보드 */}
          <section>
            <p className="text-[13px] font-semibold text-subtext mb-3">
              이번 달 리포트
            </p>
            <div className="flex gap-3">
              <StatCard label="보관 중"  value={stats?.active}    />
              <StatCard label="먹었어요" value={stats?.eaten}     accent="#10B981" />
              <StatCard label="버렸어요" value={stats?.discarded} accent="#EF4444" />
            </div>

            {eatenPct !== null ? (
              <div className="mt-3 bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] text-subtext">버리지 않고 먹은 비율</p>
                  <p className="text-[15px] font-bold text-success">{eatenPct}%</p>
                </div>
                <div className="h-2 bg-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success rounded-full transition-all"
                    style={{ width: `${eatenPct}%` }}
                  />
                </div>
                <p className="text-[12px] text-subtext mt-2">
                  {eatenPct >= 80
                    ? '훌륭해요. 음식물 낭비가 거의 없어요'
                    : eatenPct >= 50
                      ? '잘하고 있어요. 임박 알림을 활용해보세요'
                      : '버려지는 식품이 많아요. 요리 추천을 활용해보세요'}
                </p>
              </div>
            ) : stats !== null && (
              <div className="mt-3 bg-surface border border-border rounded-xl p-4">
                <p className="text-[13px] text-text font-medium">아직 이번 달 소비 기록이 없어요</p>
                <p className="text-[12px] text-subtext mt-1 leading-relaxed">
                  다 먹은 재고를 홈에서 옆으로 밀어 기록하면<br />
                  버리지 않고 먹은 비율을 여기서 볼 수 있어요
                </p>
              </div>
            )}
          </section>

          {/* 메뉴 */}
          <section>
            <p className="text-[13px] font-semibold text-subtext mb-3">
              설정
            </p>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {menuItems.map((m, i) => {
                const Icon = m.icon;
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    className="flex items-center gap-3 px-4 py-3.5 active:bg-bg transition-colors"
                    style={{ borderBottom: i < menuItems.length - 1 ? '1px solid #F0F2F5' : 'none' }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-bg flex items-center justify-center flex-shrink-0">
                      <Icon size={20} color="#8A94A6" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[15px] text-text font-medium">{m.label}</p>
                      <p className="text-[12px] text-subtext mt-0.5">{m.desc}</p>
                    </div>
                    <ChevronRight size={18} color="#C8CDD6" />
                  </Link>
                );
              })}
            </div>
          </section>

          {/* 계정 정보 */}
          <p className="text-[12px] text-subtext text-center pb-4">
            {user?.is_anonymous !== false ? '게스트로 이용 중 · 카카오 연동은 곧 제공돼요' : ''}
          </p>
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-20 left-5 right-5 z-50 flex justify-center pointer-events-none">
          <div className="bg-[#1A1A2E] text-white rounded-xl px-4 py-3 text-[14px] font-medium shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
