'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PenLine } from 'lucide-react';
import Header from '@/components/Header';
import SkeletonItem from '@/components/SkeletonItem';
import { supabase } from '@/lib/supabase';
import { getDday, getDdayLabel, getDdayStyle, CATEGORY_CONFIG } from '@/lib/dday';

const STORAGE_LABEL = {
  fridge: '냉장', freezer: '냉동', pantry: '실온', supplement: '영양제', etc: '기타',
};

function formatDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-');
  return `${y}.${m}.${d}`;
}

function InfoRow({ label, value, danger }) {
  if (!value) return null;
  return (
    <div
      className="flex items-center justify-between py-3"
      style={{ borderBottom: '1px solid #F0F2F5' }}
    >
      <span className="text-[13px] text-subtext">{label}</span>
      <span className={`text-[14px] font-medium ${danger ? 'text-danger' : 'text-text'}`}>
        {value}
      </span>
    </div>
  );
}

// ─── 로딩 스켈레톤 ─────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="flex flex-col h-full bg-bg">
      <Header title="재고 상세" />
      <div className="mx-5 mt-4 bg-surface rounded-xl border border-border overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => <SkeletonItem key={i} />)}
      </div>
    </div>
  );
}

// ─── 메인 콘텐츠 ───────────────────────────────────────────
function ItemDetail() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const id           = searchParams.get('id');

  const [item,      setItem]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [actioning, setActioning] = useState(false);
  const [toast,     setToast]     = useState(null);

  useEffect(() => {
    if (!id) { setLoading(false); return; }

    supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        setItem(error ? null : data);
        setLoading(false);
      });
  }, [id]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleAction = async (newStatus, msg) => {
    setActioning(true);
    const patch = {
      status: newStatus,
      ...(newStatus === 'eaten'     && { eaten_at:     new Date().toISOString() }),
      ...(newStatus === 'discarded' && { discarded_at: new Date().toISOString() }),
    };
    const { error } = await supabase.from('items').update(patch).eq('id', id);
    setActioning(false);
    if (error) { showToast('오류가 발생했어요'); return; }
    showToast(msg);
    setTimeout(() => router.replace('/home'), 1200);
  };

  // ── 잘못된 접근 ──
  if (!id) {
    return (
      <div className="flex flex-col h-full bg-bg">
        <Header title="재고 상세" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-subtext text-[14px]">잘못된 접근이에요</p>
        </div>
      </div>
    );
  }

  // ── 로딩 ──
  if (loading) return <PageSkeleton />;

  // ── 없는 재고 ──
  if (!item) {
    return (
      <div className="flex flex-col h-full bg-bg">
        <Header title="재고 상세" />
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <p className="text-[16px] font-semibold text-text">재고를 찾을 수 없어요</p>
          <p className="text-[13px] text-subtext">삭제됐거나 접근 권한이 없어요</p>
        </div>
      </div>
    );
  }

  const dday  = getDday(item.effective_expiry_date);
  const cat   = CATEGORY_CONFIG[item.storage_type] ?? CATEGORY_CONFIG.etc;
  const { bg: ddayBg, color: ddayColor } = getDdayStyle(dday);
  const ddayLabel = getDdayLabel(dday);

  const showEffective =
    item.effective_expiry_date &&
    item.effective_expiry_date !== item.label_expiry_date;

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* 헤더 */}
      <Header
        title="재고 상세"
        rightContent={
          <Link
            href={`/item/edit?id=${id}`}
            className="flex items-center justify-center w-11 h-11"
            aria-label="수정"
          >
            <PenLine size={20} color="#1A1A2E" />
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto">

        {/* 히어로 카드 */}
        <div className="mx-5 mt-4 bg-surface rounded-xl border border-border p-5">
          <div className="flex items-start gap-4">
            {/* 아이콘 */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ backgroundColor: cat.bg }}
            >
              {cat.emoji}
            </div>

            {/* 이름 + 보조 */}
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-[20px] font-bold text-text leading-snug">{item.name}</p>
              <p className="text-[13px] text-subtext mt-0.5">
                {item.quantity}{item.unit} · {cat.label}
              </p>
            </div>

            {/* D-day 뱃지 (크게) */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-1">
              <div
                className="px-3 py-1.5 rounded-xl"
                style={{ backgroundColor: ddayBg }}
              >
                <span className="text-[16px] font-bold" style={{ color: ddayColor }}>
                  {ddayLabel}
                </span>
              </div>
              {item.expiry_is_estimated && (
                <span className="text-[11px] text-subtext">추정</span>
              )}
            </div>
          </div>

          {/* 상태 칩 */}
          {(item.is_opened || item.is_frozen) && (
            <div className="flex gap-2 mt-4">
              {item.is_opened && (
                <span className="px-2.5 py-1 bg-[#FEF3C7] text-[#F59E0B] rounded-full text-[12px] font-medium">
                  개봉됨
                </span>
              )}
              {item.is_frozen && (
                <span className="px-2.5 py-1 bg-[#EFF6FF] text-[#3B82F6] rounded-full text-[12px] font-medium">
                  냉동 중
                </span>
              )}
            </div>
          )}
        </div>

        {/* 상세 정보 */}
        <div className="mx-5 mt-3 bg-surface rounded-xl border border-border px-4">
          <InfoRow label="유통기한"  value={formatDate(item.label_expiry_date) ?? '미표기'} />
          {showEffective && (
            <InfoRow
              label="유효기한"
              value={`${formatDate(item.effective_expiry_date)}${item.expiry_is_estimated ? ' (추정)' : ''}`}
              danger={dday !== null && dday <= 2}
            />
          )}
          <InfoRow label="보관 위치" value={STORAGE_LABEL[item.storage_type] ?? item.storage_type} />
          <InfoRow label="수량"      value={`${item.quantity}${item.unit}`} />
          <InfoRow label="구매일"    value={formatDate(item.purchase_date)} />
          {item.is_opened && item.opened_at && (
            <InfoRow label="개봉일"    value={formatDate(item.opened_at)} />
          )}
          {item.is_frozen && item.frozen_at && (
            <InfoRow label="냉동 시작" value={formatDate(item.frozen_at)} />
          )}
          {item.memo && (
            <div className="py-3">
              <p className="text-[13px] text-subtext mb-1">메모</p>
              <p className="text-[14px] text-text">{item.memo}</p>
            </div>
          )}
        </div>

        <div className="h-4" />
      </div>

      {/* 액션 버튼 */}
      <div className="px-5 pt-3 pb-6 bg-surface border-t border-border flex flex-col gap-3">
        <button
          onClick={() => handleAction('eaten', `${item.name} 먹었어요! 👍`)}
          disabled={actioning}
          className="w-full h-[52px] bg-success text-white rounded-xl text-[15px] font-semibold disabled:bg-disabled transition-colors"
        >
          먹었어요
        </button>
        <button
          onClick={() => handleAction('discarded', `${item.name} 버렸어요`)}
          disabled={actioning}
          className="w-full h-[52px] bg-bg text-text border border-border rounded-xl text-[15px] font-medium disabled:opacity-50 transition-colors active:bg-border"
        >
          버렸어요
        </button>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-24 left-5 right-5 z-50 flex justify-center pointer-events-none">
          <div className="bg-[#1A1A2E] text-white rounded-xl px-4 py-3 text-[14px] font-medium shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 페이지 진입점 ─────────────────────────────────────────
export default function ItemPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ItemDetail />
    </Suspense>
  );
}
