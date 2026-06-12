'use client';

/**
 * 신선고 브랜드 심볼 — 미니멀 냉장고 실루엣 + 잎사귀
 * 앱 아이콘(resources/icon.svg)과 동일한 도형을 공유한다.
 */
export function BrandSymbol({ size = 48, stroke = '#1D6AE5', leaf = '#10B981' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* 냉장고 바디 */}
      <rect
        x="13" y="4" width="22" height="40" rx="4.5"
        stroke={stroke} strokeWidth="3"
      />
      {/* 냉동/냉장 분할선 */}
      <line
        x1="13" y1="17" x2="35" y2="17"
        stroke={stroke} strokeWidth="3"
      />
      {/* 손잡이 */}
      <line
        x1="30.5" y1="22.5" x2="30.5" y2="27"
        stroke={stroke} strokeWidth="3" strokeLinecap="round"
      />
      {/* 잎사귀 (신선) */}
      <path
        d="M29 27 C29 33.5 25.5 37 19 37 C19 30.5 22.5 27 29 27 Z"
        fill={leaf}
      />
    </svg>
  );
}

/** 심볼 + 워드마크 (헤더용) */
export function BrandLogo({ symbolSize = 24 }) {
  return (
    <div className="flex items-center gap-1.5">
      <BrandSymbol size={symbolSize} />
      <span className="text-[18px] font-bold text-primary tracking-tight">신선고</span>
    </div>
  );
}

/** 라운드 타일 위 심볼 (온보딩 히어로, 빈 화면용) */
export function BrandHero({ size = 128 }) {
  return (
    <div
      className="rounded-3xl flex items-center justify-center"
      style={{ width: size, height: size, backgroundColor: '#EFF4FF' }}
    >
      <BrandSymbol size={size * 0.56} />
    </div>
  );
}
