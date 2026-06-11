'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Users, Copy, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import OnboardingProgress from '@/components/OnboardingProgress';

export default function PartyPage() {
  const router = useRouter();
  const { user, createProfileAndParty, signInAnonymously } = useAuth();

  const [type,    setType]    = useState(null);   // 'solo' | 'group'
  const [loading, setLoading] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const [partyResult, setPartyResult] = useState(null);
  const [error, setError] = useState('');

  const getNotificationSettings = () => {
    try {
      const raw = localStorage.getItem('notification_settings');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const handleFinish = async (partyType) => {
    setLoading(true);
    setError('');
    try {
      // 앞 단계에서 로그인이 안 된 채 진입한 경우 여기서 복구
      const userId = user?.id ?? (await signInAnonymously()).id;

      const notificationSettings = getNotificationSettings();
      const result = await createProfileAndParty(userId, {
        notificationSettings,
        partyType,
        partyName: partyType === 'group' ? '우리 집' : '내 냉장고',
      });

      localStorage.setItem('onboarding_done', 'true');

      if (partyType === 'solo') {
        router.replace('/home');
      } else {
        setPartyResult(result);
      }
    } catch (err) {
      console.error(err);
      setError('저장 중 오류가 발생했어요. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!partyResult?.parties?.invite_code) return;
    try {
      await navigator.clipboard.writeText(partyResult.parties.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 초대코드 발급 완료 화면
  if (partyResult) {
    const code = partyResult.parties?.invite_code ?? '------';
    return (
      <div className="flex flex-col h-full bg-bg px-5 pt-safe">
        <div className="flex flex-col items-center pt-14 pb-6">
          <OnboardingProgress current={2} total={3} />
          <p className="text-[13px] text-subtext mt-3">파티 설정</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="w-20 h-20 bg-[#EFF4FF] rounded-2xl flex items-center justify-center">
            <Users size={40} color="#1D6AE5" />
          </div>
          <div className="text-center">
            <h2 className="text-[20px] font-bold text-text">초대코드를 공유해요</h2>
            <p className="text-[14px] text-subtext mt-2">
              가족이나 룸메이트에게 전달하면<br />같이 재고를 관리할 수 있어요
            </p>
          </div>

          <div className="bg-surface border border-[#E8ECF2] rounded-2xl p-6 w-full">
            <p className="text-[13px] text-subtext text-center mb-3">초대코드</p>
            <div className="flex items-center justify-center gap-2">
              {code.split('').map((char, i) => (
                <div
                  key={i}
                  className="w-10 h-12 bg-bg rounded-xl flex items-center justify-center text-[20px] font-bold text-primary"
                >
                  {char}
                </div>
              ))}
            </div>
            <button
              onClick={handleCopyCode}
              className="mt-5 w-full h-[48px] bg-[#EFF4FF] text-primary rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? '복사됐어요!' : '코드 복사'}
            </button>
          </div>
        </div>

        <div className="pb-12">
          <button
            onClick={() => router.replace('/home')}
            className="w-full h-[52px] bg-primary text-white rounded-xl text-[15px] font-semibold"
          >
            시작하기
          </button>
          <button
            onClick={() => router.replace('/home')}
            className="w-full text-center text-[14px] text-subtext py-3 mt-1"
          >
            나중에 공유하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg px-5 pt-safe">
      {/* 헤더 */}
      <div className="flex flex-col items-center pt-14 pb-6">
        <OnboardingProgress current={2} total={3} />
        <p className="text-[13px] text-subtext mt-3">파티 설정</p>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <h1 className="text-[22px] font-bold text-text mb-2">누구와 함께 쓸 건가요?</h1>
        <p className="text-[14px] text-subtext mb-8">가족이나 룸메이트와 재고를 공유할 수 있어요</p>

        <div className="flex flex-col gap-3">
          {/* 혼자 */}
          <button
            onClick={() => setType('solo')}
            className="flex items-center gap-4 p-5 rounded-2xl border-2 transition-colors text-left"
            style={{
              backgroundColor: type === 'solo' ? '#EFF4FF' : '#FFFFFF',
              borderColor:     type === 'solo' ? '#1D6AE5' : '#E8ECF2',
            }}
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: type === 'solo' ? '#DBEAFE' : '#F4F6FA' }}
            >
              <User size={28} color={type === 'solo' ? '#1D6AE5' : '#8A94A6'} />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-text">혼자 써요</p>
              <p className="text-[13px] text-subtext mt-0.5">내 재고만 관리해요</p>
            </div>
          </button>

          {/* 같이 */}
          <button
            onClick={() => setType('group')}
            className="flex items-center gap-4 p-5 rounded-2xl border-2 transition-colors text-left"
            style={{
              backgroundColor: type === 'group' ? '#EFF4FF' : '#FFFFFF',
              borderColor:     type === 'group' ? '#1D6AE5' : '#E8ECF2',
            }}
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: type === 'group' ? '#DBEAFE' : '#F4F6FA' }}
            >
              <Users size={28} color={type === 'group' ? '#1D6AE5' : '#8A94A6'} />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-text">같이 써요</p>
              <p className="text-[13px] text-subtext mt-0.5">가족·룸메이트와 공유해요</p>
            </div>
          </button>
        </div>

        {error && (
          <p className="text-[13px] text-danger mt-4 text-center">{error}</p>
        )}
      </div>

      <div className="pb-12 flex flex-col gap-3">
        <button
          onClick={() => type && handleFinish(type)}
          disabled={!type || loading}
          className="w-full h-[52px] rounded-xl text-[15px] font-semibold transition-colors"
          style={{
            backgroundColor: type && !loading ? '#1D6AE5' : '#C8CDD6',
            color: '#FFFFFF',
          }}
        >
          {loading ? '저장 중...' : '다음'}
        </button>
        <button
          onClick={() => handleFinish('solo')}
          disabled={loading}
          className="w-full text-center text-[14px] text-subtext py-2"
        >
          건너뛰기 →
        </button>
      </div>
    </div>
  );
}
