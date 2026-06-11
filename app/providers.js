'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import PushManager from '@/components/PushManager';

export function Providers({ children }) {
  return (
    <AuthProvider>
      <PushManager />
      {children}
    </AuthProvider>
  );
}
