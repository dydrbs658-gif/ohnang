'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingCart, Plus, ChefHat, User } from 'lucide-react';

const tabs = [
  { href: '/home', icon: Home, label: '홈' },
  { href: '/shopping', icon: ShoppingCart, label: '장보기' },
  { href: '/register', icon: Plus, label: null, isCenter: true },
  { href: '/recipe', icon: ChefHat, label: '요리' },
  { href: '/my', icon: User, label: '마이' },
];

export default function BottomTabBar() {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === '/home') return pathname === '/home' || pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-surface border-t border-[#E8ECF2] flex items-center pb-safe z-50"
      style={{ height: '56px', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.href);

        if (tab.isCenter) {
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex justify-center items-center"
            >
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center -mt-5 shadow-lg">
                <Icon size={24} color="#FFFFFF" strokeWidth={2.5} />
              </div>
            </Link>
          );
        }

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full"
          >
            <Icon
              size={24}
              color={active ? '#1D6AE5' : '#8A94A6'}
              strokeWidth={active ? 2.5 : 2}
            />
            <span
              className="text-[11px] font-medium"
              style={{ color: active ? '#1D6AE5' : '#8A94A6' }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
