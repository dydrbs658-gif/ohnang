'use client';

import { Refrigerator, Snowflake, Archive, Pill, Package } from 'lucide-react';

// 보관 위치별 아이콘/컬러 — 이모지 대신 라인 아이콘으로 통일
export const STORAGE_META = {
  fridge:     { Icon: Refrigerator, label: '냉장',   color: '#1D6AE5', bg: '#EFF4FF' },
  freezer:    { Icon: Snowflake,    label: '냉동',   color: '#0EA5E9', bg: '#F0F9FF' },
  pantry:     { Icon: Archive,      label: '실온',   color: '#F59E0B', bg: '#FFFBEB' },
  supplement: { Icon: Pill,         label: '영양제', color: '#10B981', bg: '#F0FDF4' },
  etc:        { Icon: Package,      label: '기타',   color: '#8A94A6', bg: '#F4F6FA' },
};

export default function CategoryIcon({ type, size = 40, iconSize = 20, rounded = 'rounded-xl' }) {
  const meta = STORAGE_META[type] ?? STORAGE_META.etc;
  const { Icon } = meta;

  return (
    <div
      className={`${rounded} flex items-center justify-center flex-shrink-0`}
      style={{ width: size, height: size, backgroundColor: meta.bg }}
    >
      <Icon size={iconSize} color={meta.color} strokeWidth={1.8} />
    </div>
  );
}
