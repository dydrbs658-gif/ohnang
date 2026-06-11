'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Bell, CheckCircle, XCircle } from 'lucide-react';
import OnboardingProgress from '@/components/OnboardingProgress';

async function requestCameraPermission() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Camera } = await import('@capacitor/camera');
      const result = await Camera.requestPermissions({ permissions: ['camera'] });
      return result.camera === 'granted';
    }
    // 웹 환경: MediaDevices API로 시도
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      return true;
    }
    return true; // 확인 불가 → 허용으로 처리
  } catch {
    return false;
  }
}

async function requestNotificationPermission() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const result = await PushNotifications.requestPermissions();
      return result.receive === 'granted';
    }
    // 웹 환경
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      return result === 'granted';
    }
    return true;
  } catch {
    return false;
  }
}

export default function PermissionsPage() {
  const router = useRouter();
  const [step, setStep]           = useState('camera'); // 'camera' | 'notification'
  const [visible, setVisible]     = useState(true);
  const [cameraGranted, setCameraGranted]     = useState(null);
  const [loading, setLoading]     = useState(false);

  const transition = (nextStep) => {
    setVisible(false);
    setTimeout(() => {
      setStep(nextStep);
      setVisible(true);
    }, 250);
  };

  const handleCameraAllow = async () => {
    setLoading(true);
    const granted = await requestCameraPermission();
    setCameraGranted(granted);
    setLoading(false);
    transition('notification');
  };

  const handleCameraSkip = () => {
    setCameraGranted(false);
    transition('notification');
  };

  const handleNotificationAllow = async () => {
    setLoading(true);
    const granted = await requestNotificationPermission();
    setLoading(false);
    localStorage.setItem('notification_permission', granted ? 'granted' : 'denied');
    if (granted) {
      router.push('/onboarding/notifications');
    } else {
      router.push('/onboarding/party');
    }
  };

  const handleNotificationSkip = () => {
    localStorage.setItem('notification_permission', 'denied');
    router.push('/onboarding/party');
  };

  const cards = {
    camera: {
      icon: <Camera size={32} color="#1D6AE5" />,
      iconBg: '#EFF4FF',
      title: '카메라 접근 허용',
      desc: '음식 사진을 찍어 AI가 품목과\n유통기한을 자동으로 인식해요',
      allowText: '허용하기',
      skipText: '나중에',
      onAllow: handleCameraAllow,
      onSkip: handleCameraSkip,
    },
    notification: {
      icon: <Bell size={32} color="#F59E0B" />,
      iconBg: '#FFFBEB',
      title: '알림 허용',
      desc: '유통기한이 임박하면\n제때 알려드릴게요',
      allowText: '허용하기',
      skipText: '나중에',
      onAllow: handleNotificationAllow,
      onSkip: handleNotificationSkip,
    },
  };

  const card = cards[step];

  return (
    <div className="flex flex-col h-full bg-bg px-5 pt-safe">
      {/* 헤더 */}
      <div className="flex flex-col items-center pt-14 pb-8">
        <OnboardingProgress current={0} total={3} />
        <p className="text-[13px] text-subtext mt-3">권한 설정</p>
      </div>

      {/* 카드 — 애니메이션 */}
      <div
        className="flex flex-col gap-6 transition-all duration-250 ease-out"
        style={{
          opacity:   visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
        }}
      >
        {/* 단계 힌트 */}
        {step === 'notification' && cameraGranted !== null && (
          <div className="flex items-center gap-2 bg-surface border border-[#E8ECF2] rounded-xl p-3">
            {cameraGranted
              ? <CheckCircle size={18} color="#10B981" />
              : <XCircle    size={18} color="#8A94A6" />
            }
            <span className="text-[13px] text-subtext">
              카메라 권한 {cameraGranted ? '허용됨' : '건너뜀'}
            </span>
          </div>
        )}

        {/* 메인 카드 */}
        <div className="bg-surface border border-[#E8ECF2] rounded-2xl p-6 flex flex-col items-center gap-5">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: card.iconBg }}
          >
            {card.icon}
          </div>
          <div className="text-center">
            <h2 className="text-[18px] font-semibold text-text">{card.title}</h2>
            <p className="text-[14px] text-subtext mt-2 leading-relaxed whitespace-pre-line">
              {card.desc}
            </p>
          </div>
          <div className="w-full flex flex-col gap-3 mt-2">
            <button
              onClick={card.onAllow}
              disabled={loading}
              className="w-full h-[52px] bg-primary text-white rounded-xl text-[15px] font-semibold disabled:bg-disabled transition-colors"
            >
              {loading ? '확인 중...' : card.allowText}
            </button>
            <button
              onClick={card.onSkip}
              disabled={loading}
              className="w-full h-[52px] bg-bg text-subtext rounded-xl text-[15px] border border-[#E8ECF2]"
            >
              {card.skipText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
