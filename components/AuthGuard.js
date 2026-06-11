'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// 온보딩을 마치지 않은 사용자가 메인 화면에 직접 진입하면 온보딩으로 보낸다.
export default function AuthGuard({ children }) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user || !profile?.onboarding_done) {
      router.replace('/onboarding');
    }
  }, [user, profile, loading, router]);

  return children;
}
