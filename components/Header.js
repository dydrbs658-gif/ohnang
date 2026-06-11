'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function Header({ title, showBack = true, rightContent }) {
  const router = useRouter();

  return (
    <header className="flex items-center bg-surface border-b border-[#E8ECF2] px-4 relative" style={{ height: '52px', minHeight: '52px' }}>
      {showBack && (
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center absolute left-4"
          style={{ width: '44px', height: '44px' }}
          aria-label="뒤로가기"
        >
          <ChevronLeft size={24} color="#1A1A2E" />
        </button>
      )}
      <h1 className="flex-1 text-center text-[18px] font-semibold text-text truncate px-14">
        {title}
      </h1>
      {rightContent && (
        <div className="absolute right-4 flex items-center gap-1">
          {rightContent}
        </div>
      )}
    </header>
  );
}
