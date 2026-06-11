'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Camera, Barcode, PenLine, AlertCircle, CheckCircle2, Refrigerator } from 'lucide-react';
import HomeHeader from '@/components/HomeHeader';
import SwipeableItem from '@/components/SwipeableItem';
import DdayBadge from '@/components/DdayBadge';
import SkeletonItem from '@/components/SkeletonItem';
import CategoryIcon, { STORAGE_META } from '@/components/CategoryIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useItems } from '@/hooks/useItems';
import { getDday, getSectionLabel, SECTION_ORDER } from '@/lib/dday';

const FILTERS = [
  { value: 'all',        label: '전체' },
  { value: 'fridge',     label: '냉장' },
  { value: 'freezer',    label: '냉동' },
  { value: 'pantry',     label: '실온' },
  { value: 'supplement', label: '영양제' },
];

function groupBySection(items) {
  const map = {};
  for (const item of items) {
    const label = getSectionLabel(getDday(item.effective_expiry_date));
    (map[label] = map[label] ?? []).push(item);
  }
  return map;
}

export default function HomePage() {
  const { profile } = useAuth();
  const [activeFilter, setActiveFilter] = useState('all');
  const [toast, setToast]               = useState(null);

  const { items, loading, updateStatus } = useItems(profile?.party_id, activeFilter);

  const sections = useMemo(() => {
    const grouped = groupBySection(items);
    return SECTION_ORDER
      .filter(s => grouped[s]?.length)
      .map(s => ({ label: s, items: grouped[s] }));
  }, [items]);

  const urgentCount = useMemo(
    () => items.filter(i => { const d = getDday(i.effective_expiry_date); return d !== null && d <= 2; }).length,
    [items]
  );

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleEaten = async (item) => {
    try {
      await updateStatus(item.id, 'eaten');
      showToast(`${item.name}을(를) 먹은 것으로 기록했어요`);
    } catch {
      showToast('오류가 발생했어요');
    }
  };

  const handleDiscarded = async (item) => {
    try {
      await updateStatus(item.id, 'discarded');
      showToast(`${item.name} 버렸어요`);
    } catch {
      showToast('오류가 발생했어요');
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      <HomeHeader />

      {/* 요약 카드 */}
      <div className="mx-5 mt-4 flex-shrink-0">
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[13px] text-subtext">오늘 확인할 품목</p>
            <p className="text-[22px] font-bold text-text mt-0.5">
              {loading ? '—' : urgentCount}
              <span className="text-[15px] font-medium text-subtext ml-0.5">개</span>
            </p>
            <p className="text-[13px] text-subtext mt-1">
              {urgentCount > 0 ? '기한이 임박한 재고가 있어요' : '모든 재고가 여유 있어요'}
            </p>
          </div>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: urgentCount > 0 ? '#FEF3C7' : '#F0FDF4' }}
          >
            {urgentCount > 0
              ? <AlertCircle size={24} color="#F59E0B" strokeWidth={1.8} />
              : <CheckCircle2 size={24} color="#10B981" strokeWidth={1.8} />}
          </div>
        </div>
      </div>

      {/* 필터 칩 */}
      <div className="flex gap-2 px-5 mt-4 overflow-x-auto flex-shrink-0 pb-1">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setActiveFilter(f.value)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: activeFilter === f.value ? '#1D6AE5' : '#F4F6FA',
              color:           activeFilter === f.value ? '#FFFFFF'  : '#8A94A6',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 재고 리스트 */}
      <div className="flex-1 overflow-y-auto mt-3">
        {loading ? (
          <div className="bg-surface rounded-xl mx-5 overflow-hidden border border-[#E8ECF2]">
            {Array.from({ length: 5 }, (_, i) => <SkeletonItem key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState filter={activeFilter} />
        ) : (
          <div className="pb-4">
            {sections.map(({ label, items: sectionItems }) => (
              <div key={label}>
                {/* 섹션 헤더 */}
                <div className="px-5 pt-4 pb-2">
                  <span className="text-[13px] font-semibold text-subtext">
                    {label}
                  </span>
                </div>

                {/* 아이템 카드 */}
                <div className="bg-surface mx-5 rounded-xl overflow-hidden border border-[#E8ECF2]">
                  {sectionItems.map((item, idx) => {
                    const dday = getDday(item.effective_expiry_date);
                    const cat  = STORAGE_META[item.storage_type] ?? STORAGE_META.etc;
                    const isLast = idx === sectionItems.length - 1;

                    return (
                      <SwipeableItem
                        key={item.id}
                        onEaten={() => handleEaten(item)}
                        onDiscarded={() => handleDiscarded(item)}
                      >
                        <Link href={`/item?id=${item.id}`}>
                          <div
                            className="flex items-center gap-3 px-4 py-3 bg-surface active:bg-bg transition-colors"
                            style={{ borderBottom: isLast ? 'none' : '1px solid #F0F2F5' }}
                          >
                            {/* 카테고리 아이콘 */}
                            <CategoryIcon type={item.storage_type} />

                            {/* 텍스트 */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[15px] font-semibold text-text truncate">
                                {item.name}
                              </p>
                              <p className="text-[13px] text-subtext mt-0.5">
                                {item.quantity}{item.unit} · {cat.label}
                                {item.is_opened ? ' · 개봉' : ''}
                                {item.is_frozen ? ' · 냉동 중' : ''}
                              </p>
                            </div>

                            {/* D-day 배지 */}
                            <DdayBadge dday={dday} estimated={item.expiry_is_estimated} />
                          </div>
                        </Link>
                      </SwipeableItem>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-20 left-5 right-5 z-50 flex justify-center pointer-events-none">
          <div className="bg-[#1A1A2E] text-white rounded-xl px-4 py-3 text-[14px] font-medium shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ filter }) {
  const labels = { fridge: '냉장', freezer: '냉동', pantry: '실온', supplement: '영양제' };
  const label  = labels[filter];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-5 gap-4">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{ backgroundColor: '#EFF4FF' }}
      >
        <Refrigerator size={36} color="#1D6AE5" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <p className="text-[16px] font-semibold text-text">
          {label ? `${label} 재고가 없어요` : '등록된 재고가 없어요'}
        </p>
        <p className="text-[14px] text-subtext mt-1">
          {label ? `${label}에 보관 중인 품목을 등록해보세요` : '첫 재고를 등록해보세요'}
        </p>
      </div>

      {!label && (
        <div className="w-full flex flex-col gap-3 mt-2">
          <Link
            href="/register/photo"
            className="w-full h-[52px] bg-primary text-white rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2"
          >
            <Camera size={20} />
            사진으로 등록
          </Link>
          <div className="flex gap-3">
            <Link
              href="/register/barcode"
              className="flex-1 h-[52px] bg-surface text-text rounded-xl text-[15px] font-medium border border-[#E8ECF2] flex items-center justify-center gap-2"
            >
              <Barcode size={18} />
              바코드
            </Link>
            <Link
              href="/register/manual"
              className="flex-1 h-[52px] bg-surface text-text rounded-xl text-[15px] font-medium border border-[#E8ECF2] flex items-center justify-center gap-2"
            >
              <PenLine size={18} />
              직접 입력
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
