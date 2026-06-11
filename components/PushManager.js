'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { initPush } from '@/lib/push';

// 로그인 + 온보딩 완료 + 알림 ON 상태일 때 푸시 토큰을 등록한다.
// 네이티브가 아니면 initPush 내부에서 no-op.
export default function PushManager() {
  const router = useRouter();
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user?.id || !profile?.onboarding_done || !profile?.notification_enabled) return;
    initPush(user.id, (path) => router.push(path));
  }, [user?.id, profile?.onboarding_done, profile?.notification_enabled, router]);

  return null;
}
