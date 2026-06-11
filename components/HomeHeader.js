'use client';

import Link from 'next/link';
import { Search, Bell } from 'lucide-react';

export default function HomeHeader() {
  return (
    <header className="flex items-center justify-between bg-surface border-b border-[#E8ECF2] px-5" style={{ height: '52px', minHeight: '52px' }}>
      <div className="flex items-center gap-2">
        <span className="text-[18px] font-bold text-primary">오냥</span>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/search" className="flex items-center justify-center" style={{ width: '44px', height: '44px' }}>
          <Search size={22} color="#1A1A2E" />
        </Link>
        <Link href="/notifications" className="flex items-center justify-center relative" style={{ width: '44px', height: '44px' }}>
          <Bell size={22} color="#1A1A2E" />
        </Link>
      </div>
    </header>
  );
}
