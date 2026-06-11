'use client';

import Header from '@/components/Header';

export default function MyPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="마이" showBack={false} />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-subtext text-[14px]">마이 페이지 (준비 중)</p>
      </div>
    </div>
  );
}
