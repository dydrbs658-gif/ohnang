'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingProgress from '@/components/OnboardingProgress';

const FREQ_OPTIONS = [
  { value: 'daily',    label: '매일' },
  { value: '3x_week',  label: '주 3회' },
  { value: 'weekly',   label: '주 1회' },
  { value: 'random',   label: '랜덤' },
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

function TimeSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="flex-1 h-[52px] bg-bg border border-[#E8ECF2] rounded-xl px-4 text-[15px] text-text focus:border-primary outline-none"
    >
      {TIME_OPTIONS.map(t => (
        <option key={t.value} value={t.value}>{t.label}</option>
      ))}
    </select>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [freq,  setFreq]  = useState('daily');
  const [count, setCount] = useState(1);
  const [times, setTimes] = useState(['15:00', '09:00', '20:00']);

  const updateTime = (index, value) => {
    setTimes(prev => prev.map((t, i) => i === index ? value : t));
  };

  const handleSave = () => {
    const settings = {
      enabled: true,
      freq,
      count,
      times: times.slice(0, count),
    };
    localStorage.setItem('notification_settings', JSON.stringify(settings));
    router.push('/onboarding/party');
  };

  const handleSkip = () => {
    localStorage.setItem('notification_settings', JSON.stringify({
      enabled: true,
      freq: 'daily',
      count: 1,
      times: ['15:00'],
    }));
    router.push('/onboarding/party');
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* 헤더 */}
      <div className="flex flex-col items-center pt-14 pb-6 px-5">
        <OnboardingProgress current={1} total={3} />
        <p className="text-[13px] text-subtext mt-3">알림 설정</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        <h1 className="text-[22px] font-bold text-text mb-1">언제 알려드릴까요?</h1>
        <p className="text-[14px] text-subtext mb-8">언제든지 마이 탭에서 변경할 수 있어요</p>

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
                  color:           freq === opt.value ? '#FFFFFF'  : '#1A1A2E',
                  borderColor:     freq === opt.value ? '#1D6AE5'  : '#E8ECF2',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* 알림 횟수 */}
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
                  color:           count === n ? '#FFFFFF'  : '#1A1A2E',
                  borderColor:     count === n ? '#1D6AE5'  : '#E8ECF2',
                }}
              >
                {n}회
              </button>
            ))}
          </div>
        </section>

        {/* 알림 시간 */}
        <section className="mb-10">
          <p className="text-[13px] font-semibold text-subtext uppercase tracking-wide mb-3">알림 시간</p>
          <div className="flex flex-col gap-3">
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                {count > 1 && (
                  <span className="text-[13px] text-subtext w-8 text-right">{i + 1}번째</span>
                )}
                <TimeSelect value={times[i]} onChange={v => updateTime(i, v)} />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 하단 버튼 */}
      <div className="px-5 pb-12 flex flex-col gap-3">
        <button
          onClick={handleSave}
          className="w-full h-[52px] bg-primary text-white rounded-xl text-[15px] font-semibold"
        >
          설정 완료
        </button>
        <button
          onClick={handleSkip}
          className="w-full text-center text-[14px] text-subtext py-2"
        >
          건너뛰기 →
        </button>
      </div>
    </div>
  );
}
