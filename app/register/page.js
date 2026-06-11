'use client';

import { useRouter } from 'next/navigation';
import { Camera, Barcode, PenLine, X } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();

  const options = [
    {
      href: '/register/photo',
      icon: Camera,
      label: '사진으로 등록',
      desc: 'AI가 품목과 유통기한을 인식해요',
      color: '#1D6AE5',
      bg: '#EFF4FF',
    },
    {
      href: '/register/barcode',
      icon: Barcode,
      label: '바코드 스캔',
      desc: '바코드로 빠르게 등록해요',
      color: '#0EA5A0',
      bg: '#ECFDF5',
    },
    {
      href: '/register/manual',
      icon: PenLine,
      label: '직접 입력',
      desc: '품목명과 날짜를 직접 입력해요',
      color: '#8A94A6',
      bg: '#F4F6FA',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="w-full bg-surface rounded-t-3xl pb-safe">
        <div className="flex justify-center pt-3 mb-4">
          <div className="w-10 h-1 bg-[#E8ECF2] rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 mb-6">
          <h2 className="text-[17px] font-semibold text-text">재고 등록</h2>
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-8 h-8"
          >
            <X size={20} color="#8A94A6" />
          </button>
        </div>
        <div className="px-5 flex flex-col gap-3 pb-8">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.href}
                onClick={() => router.push(opt.href)}
                className="flex items-center gap-4 p-4 bg-surface border border-[#E8ECF2] rounded-xl active:bg-bg"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: opt.bg }}
                >
                  <Icon size={24} color={opt.color} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[15px] font-semibold text-text">{opt.label}</p>
                  <p className="text-[13px] text-subtext mt-0.5">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
