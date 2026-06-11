'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function EntryPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (user && profile?.onboarding_done) {
      router.replace('/home');
    } else {
      router.replace('/onboarding');
    }
  }, [user, profile, loading, router]);

  return (
    <div className="flex h-full items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 bg-[#EFF4FF] rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}
