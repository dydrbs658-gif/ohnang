'use client';

import Header from '@/components/Header';

export default function ShoppingPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="장보기" showBack={false} />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-subtext text-[14px]">장보기 목록 (준비 중)</p>
      </div>
    </div>
  );
}
