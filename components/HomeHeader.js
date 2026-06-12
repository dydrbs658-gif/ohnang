'use client';

import Link from 'next/link';
import { Bell, Search } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';

export default function HomeHeader({ onSearchClick }) {
  return (
    <header className="flex items-center justify-between bg-surface border-b border-[#E8ECF2] px-5" style={{ height: '52px', minHeight: '52px' }}>
      <BrandLogo symbolSize={22} />
      <div className="flex items-center">
        {onSearchClick && (
          <button onClick={onSearchClick} className="flex items-center justify-center" style={{ width: '44px', height: '44px' }} aria-label="재고 검색">
            <Search size={21} color="#1A1A2E" strokeWidth={1.8} />
          </button>
        )}
        <Link href="/my/settings" className="flex items-center justify-center" style={{ width: '44px', height: '44px' }} aria-label="알림 설정">
          <Bell size={21} color="#1A1A2E" strokeWidth={1.8} />
        </Link>
      </div>
    </header>
  );
}
