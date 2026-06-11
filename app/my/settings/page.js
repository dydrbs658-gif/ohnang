'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { disablePushToken } from '@/lib/push';

const FREQ_OPTIONS = [
  { value: 'daily',   label: '매일' },
  { value: '3x_week', label: '주 3회' },
  { value: 'weekly',  label: '주 1회' },
  { value: 'random',  label: '랜덤' },
];

const COUNT_OPTIONS = [1, 2, 3];

// 6:00 ~ 22:00, 30분 단위
const TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => {
  const totalMins = 6 * 60 + i * 30;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const label = h < 12 ? `오전 ${h}:${mm}` : h === 12 ? `오후 12:${mm}` : `오후 ${h - 12}:${mm}`;
  return { value: `${hh}:${mm}`, label };
});

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${
        value ? 'bg-primary' : 'bg-disabled'
      }`}
      aria-pressed={value}
    >
      <div
        className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${
          value ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { user, profile, loadProfile } = useAuth();

  const [enabled, setEnabled] = useState(true);
  const [freq,    setFreq]    = useState('daily');
  const [count,   setCount]   = useState(1);
  const [times,   setTimes]   = useState(['15:00', '09:00', '20:00']);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState(null);

  // 프로필 값으로 초기화
  useEffect(() => {
    if (!profile) return;
    setEnabled(profile.notification_enabled ?? true);
    setFreq(profile.notification_freq ?? 'daily');
    setCount(profile.notification_count ?? 1);
    const t = profile.notification_times ?? ['15:00'];
    setTimes([t[0] ?? '15:00', t[1] ?? '09:00', t[2] ?? '20:00']);
  }, [profile]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  const updateTime = (index, value) => {
    setTimes(prev => prev.map((t, i) => i === index ? value : t));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        notification_enabled: enabled,
        notification_freq:    freq,
        notification_count:   count,
        notification_times:   times.slice(0, count),
      })
      .eq('id', user.id);

    if (!error && !enabled) {
      // 알림 끄면 토큰도 비활성화 → 서버 발송 대상에서 제외
      await disablePushToken(user.id);
    }

    setSaving(false);

    if (error) {
      console.error(error);
      showToast('저장에 실패했어요. 다시 시도해주세요');
      return;
    }

    await loadProfile(user.id);
    showToast('저장됐어요 ✅');
    setTimeout(() => router.back(), 800);
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header title="알림 설정" />

      <div className="flex-1 overflow-y-auto px-5 py-5">

        {/* 알림 받기 토글 */}
        <div className="bg-surface border border-border rounded-xl px-4 py-3.5 flex items-center justify-between mb-6">
          <div>
            <p className="text-[15px] text-text font-medium">유통기한 알림 받기</p>
            <p className="text-[12px] text-subtext mt-0.5">임박한 재고를 푸시로 알려드려요</p>
          </div>
          <Toggle value={enabled} onChange={setEnabled} />
        </div>

        {enabled && (
          <>
            {/* 알림 빈도 */}
            <section className="mb-6">
              <p className="text-[13px] font-semibold text-subtext uppercase tracking-wide mb-3">알림 빈도</p>
              <div className="grid grid-cols-4 gap-2">
                {FREQ_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFreq(opt.value)}
                    className="h-[44px] rounded-xl text-[14px] font-medium border transition-colors"
                    style={{
                      backgroundColor: freq === opt.value ? '#1D6AE5' : '#FFFFFF',
                      color:           freq === opt.value ? '#FFFFFF' : '#1A1A2E',
                      borderColor:     freq === opt.value ? '#1D6AE5' : '#E8ECF2',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>

            {/* 하루 횟수 */}
            <section className="mb-6">
              <p className="text-[13px] font-semibold text-subtext uppercase tracking-wide mb-3">하루 횟수</p>
              <div className="flex gap-2">
                {COUNT_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className="flex-1 h-[52px] rounded-xl text-[15px] font-semibold border transition-colors"
                    style={{
                      backgroundColor: count === n ? '#1D6AE5' : '#FFFFFF',
                      color:           count === n ? '#FFFFFF' : '#1A1A2E',
                      borderColor:     count === n ? '#1D6AE5' : '#E8ECF2',
                    }}
                  >
                    {n}회
                  </button>
                ))}
              </div>
            </section>

            {/* 알림 시간 */}
            <section className="mb-6">
              <p className="text-[13px] font-semibold text-subtext uppercase tracking-wide mb-3">알림 시간</p>
              <div className="flex flex-col gap-3">
                {Array.from({ length: count }, (_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {count > 1 && (
                      <span className="text-[13px] text-subtext w-8 text-right">{i + 1}번째</span>
                    )}
                    <select
                      value={times[i]}
                      onChange={e => updateTime(i, e.target.value)}
                      className="flex-1 h-[52px] bg-surface border border-border rounded-xl px-4 text-[15px] text-text focus:border-primary outline-none"
                    >
                      {TIME_OPTIONS.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {/* 저장 버튼 */}
      <div className="px-5 pt-3 pb-6 bg-surface border-t border-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-[52px] bg-primary text-white rounded-xl text-[15px] font-semibold disabled:bg-disabled transition-colors"
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
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
