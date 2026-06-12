'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Camera, Bell, ChefHat } from 'lucide-react';
import { BrandHero } from '@/components/BrandLogo';

export default function OnboardingIntroPage() {
  const router = useRouter();
  const { signInAnonymously, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleStart = async () => {
    setLoading(true);
    setError('');
    try {
      if (!user) {
        await signInAnonymously();
      }
      router.push('/onboarding/permissions');
    } catch (err) {
      console.error('익명 로그인 실패:', err);
      // 로그인 없이 진행하면 파티 생성에서 막히므로 여기서 멈추고 재시도 유도
      setError('연결에 실패했어요. 네트워크를 확인하고 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg px-5 pt-safe">
      <div className="flex-1 flex flex-col items-center justify-center gap-10">
        <BrandHero size={128} />

        <div className="text-center">
          <p className="text-[15px] font-bold text-primary mb-2">신선고</p>
          <h1 className="text-[26px] font-bold text-text leading-snug">
            유통기한,<br />이제 신경 쓰지 마세요
          </h1>
          <p className="text-[15px] text-subtext mt-3 leading-relaxed">
            사진 한 장으로 등록하고<br />임박하면 알림으로 알려드려요
          </p>
        </div>

        <div className="flex flex-col items-center gap-5 w-full">
          <div className="flex gap-2">
            {[
              { Icon: Camera,  text: '사진 등록' },
              { Icon: Bell,    text: '임박 알림' },
              { Icon: ChefHat, text: '요리 추천' },
            ].map(({ Icon, text }, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-surface border border-[#E8ECF2] rounded-full px-3 py-2"
              >
                <Icon size={14} color="#1D6AE5" strokeWidth={1.8} />
                <span className="text-[13px] font-medium text-text whitespace-nowrap">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pb-12">
        {error && (
          <p className="text-[13px] text-danger text-center mb-3">{error}</p>
        )}
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full h-[52px] bg-primary text-white rounded-xl text-[15px] font-semibold disabled:bg-disabled transition-colors"
        >
          {loading ? '잠깐만요...' : '시작하기'}
        </button>
      </div>
    </div>
  );
}
