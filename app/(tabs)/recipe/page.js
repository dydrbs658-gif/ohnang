'use client';

import Header from '@/components/Header';

export default function RecipePage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="요리 추천" showBack={false} />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-subtext text-[14px]">요리 추천 (준비 중)</p>
      </div>
    </div>
  );
}
