'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import Header from '@/components/Header';
import SkeletonItem from '@/components/SkeletonItem';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { calcEffectiveExpiry } from '@/lib/calcExpiry';
import { CATEGORY_CONFIG } from '@/lib/dday';

const STORAGE_TYPES = [
  { value: 'fridge',     label: '냉장' },
  { value: 'freezer',    label: '냉동' },
  { value: 'pantry',     label: '실온' },
  { value: 'supplement', label: '영양제' },
  { value: 'etc',        label: '기타' },
];

function today() {
  return new Date().toISOString().split('T')[0];
}

// storage_type → CATEGORY_CONFIG 키 매핑 (아이콘 표시용)
function getCatConfig(item) {
  return CATEGORY_CONFIG[item.storage_type] ?? CATEGORY_CONFIG.etc;
}

// ─── 보관 위치 선택 드롭다운 ──────────────────────────────────
function StorageSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = STORAGE_TYPES.find(s => s.value === value) ?? STORAGE_TYPES[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2.5 py-1 bg-bg border border-border rounded-full text-[12px] text-subtext"
      >
        {current.label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-xl overflow-hidden z-20 shadow-md min-w-[80px]">
          {STORAGE_TYPES.map(st => (
            <button
              key={st.value}
              type="button"
              onMouseDown={() => { onChange(st.value); setOpen(false); }}
              className={`w-full px-3 py-2 text-left text-[13px] ${
                st.value === value ? 'text-primary font-medium bg-[#EFF4FF]' : 'text-text'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 개별 아이템 행 ────────────────────────────────────────────
function ConfirmRow({ item, onToggle, onStorageChange, onQuantityChange }) {
  const cat     = getCatConfig(item);
  const isExist = !!item.existingItem;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 bg-surface active:bg-bg transition-colors ${
        !item.checked ? 'opacity-50' : ''
      }`}
      style={{ borderBottom: '1px solid #F0F2F5' }}
    >
      {/* 체크박스 */}
      <button
        type="button"
        onClick={() => onToggle(item._idx)}
        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          item.checked
            ? 'bg-primary border-primary'
            : 'bg-transparent border-disabled'
        }`}
      >
        {item.checked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
      </button>

      {/* 카테고리 아이콘 */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ backgroundColor: cat.bg }}
      >
        {cat.emoji}
      </div>

      {/* 텍스트 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] font-semibold text-text">{item.name}</span>
          {item.confidence === 'low' && (
            <span className="text-[11px] text-subtext bg-bg px-1.5 py-0.5 rounded">불확실</span>
          )}
          {isExist && (
            <span className="text-[11px] text-subtext bg-bg border border-border px-1.5 py-0.5 rounded">
              이미 있어요
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <StorageSelector value={item.storage_type} onChange={v => onStorageChange(item._idx, v)} />
        </div>
      </div>

      {/* 수량 조절 */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => onQuantityChange(item._idx, Math.max(1, item.quantity - 1))}
          className="w-7 h-7 rounded-lg bg-bg border border-border flex items-center justify-center text-subtext text-[16px]"
        >
          −
        </button>
        <span className="text-[14px] font-medium text-text w-7 text-center">
          {item.quantity}
        </span>
        <button
          type="button"
          onClick={() => onQuantityChange(item._idx, item.quantity + 1)}
          className="w-7 h-7 rounded-lg bg-bg border border-border flex items-center justify-center text-subtext text-[16px]"
        >
          +
        </button>
        <span className="text-[12px] text-subtext">{item.unit}</span>
      </div>
    </div>
  );
}

// ─── 빈 상태 ──────────────────────────────────────────────────
function EmptyResult({ onRetry }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5">
      <div className="text-4xl">🔍</div>
      <div className="text-center">
        <p className="text-[16px] font-semibold text-text">식품을 인식하지 못했어요</p>
        <p className="text-[13px] text-subtext mt-1 leading-relaxed">
          라벨이 잘 보이게 다시 촬영해보세요
        </p>
      </div>
      <button
        onClick={onRetry}
        className="w-full h-[52px] bg-primary text-white rounded-xl text-[15px] font-semibold"
      >
        다시 촬영하기
      </button>
    </div>
  );
}

// ─── 메인 콘텐츠 ──────────────────────────────────────────────
function ConfirmContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { user, profile } = useAuth();
  const scanId       = searchParams.get('scan_id');

  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // ── scan 결과 로드 ──
  useEffect(() => {
    if (!scanId || !profile?.party_id) return;
    loadScanResult();
  }, [scanId, profile?.party_id]);

  const loadScanResult = async () => {
    setLoading(true);

    const { data: scan } = await supabase
      .from('scans')
      .select('result, status')
      .eq('id', scanId)
      .single();

    if (!scan?.result?.items) {
      setItems([]);
      setLoading(false);
      return;
    }

    const aiItems = scan.result.items;

    // 현재 재고에서 동일 품목 있는지 확인
    const names = aiItems.map(i => i.name);
    const { data: existingItems } = await supabase
      .from('items')
      .select('id, name, quantity, unit')
      .eq('party_id', profile.party_id)
      .eq('status', 'active')
      .in('name', names);

    const existingMap = {};
    (existingItems ?? []).forEach(e => { existingMap[e.name] = e; });

    // 로컬 상태 초기화
    const enriched = aiItems.map((item, idx) => ({
      _idx:         idx,
      name:         item.name,
      category:     item.category ?? 'etc',
      storage_type: item.storage_type ?? 'fridge',
      quantity:     item.quantity    ?? 1,
      unit:         item.unit        ?? '개',
      confidence:   item.confidence  ?? 'high',
      catalog_id:   item.catalog_id  ?? null,
      shelf_days:   item.shelf_days  ?? null,
      opened_days:  item.opened_days ?? null,
      frozen_days:  item.frozen_days ?? null,
      checked:      true,
      existingItem: existingMap[item.name] ?? null,
    }));

    setItems(enriched);
    setLoading(false);
  };

  const toggle = useCallback((idx) => {
    setItems(prev => prev.map(i => i._idx === idx ? { ...i, checked: !i.checked } : i));
  }, []);

  const changeStorage = useCallback((idx, val) => {
    setItems(prev => prev.map(i => i._idx === idx ? { ...i, storage_type: val } : i));
  }, []);

  const changeQty = useCallback((idx, qty) => {
    setItems(prev => prev.map(i => i._idx === idx ? { ...i, quantity: qty } : i));
  }, []);

  // ── 등록하기 ──
  const handleRegister = async () => {
    const checkedItems = items.filter(i => i.checked);
    if (checkedItems.length === 0) return;
    if (!profile?.party_id || !user?.id) return;

    setSaving(true);

    const todayStr = today();

    const inserts = [];
    const updates = [];

    for (const item of checkedItems) {
      const catalog = item.shelf_days ? { shelf_days: item.shelf_days, opened_days: item.opened_days, frozen_days: item.frozen_days } : null;
      const { effective_expiry_date, expiry_is_estimated } = calcEffectiveExpiry(
        { label_expiry_date: null, purchase_date: todayStr, is_opened: false, is_frozen: false },
        catalog,
      );

      if (item.existingItem) {
        // 이미 있는 재고 → 수량 증가
        updates.push(
          supabase.from('items')
            .update({ quantity: item.existingItem.quantity + item.quantity })
            .eq('id', item.existingItem.id)
        );
      } else {
        inserts.push({
          party_id:             profile.party_id,
          created_by:           user.id,
          name:                 item.name,
          category:             item.category ?? 'etc',
          storage_type:         item.storage_type,
          quantity:             item.quantity,
          unit:                 item.unit,
          purchase_date:        todayStr,
          catalog_id:           item.catalog_id,
          effective_expiry_date,
          expiry_is_estimated,
          status:               'active',
        });
      }
    }

    try {
      // 신규 아이템 일괄 INSERT
      if (inserts.length > 0) {
        const { error } = await supabase.from('items').insert(inserts);
        if (error) throw error;
      }

      // 수량 증가 UPDATE (병렬)
      await Promise.all(updates.map(q => q));

      // scan 상태 done 확인 (이미 Edge Function에서 처리했지만 안전장치)
      await supabase.from('scans').update({ status: 'done' }).eq('id', scanId);

      showToast(`${checkedItems.length}개 등록됐어요 ✅`);
      setTimeout(() => router.replace('/home'), 1000);

    } catch (err) {
      console.error(err);
      showToast('등록에 실패했어요. 다시 시도해주세요');
      setSaving(false);
    }
  };

  // ── 로딩 ──
  if (loading) {
    return (
      <div className="flex flex-col h-full bg-bg">
        <Header title="인식 결과 확인" />
        <div className="mx-5 mt-4 bg-surface rounded-xl border border-border overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => <SkeletonItem key={i} />)}
        </div>
      </div>
    );
  }

  // ── 인식 결과 없음 ──
  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col h-full bg-bg">
        <Header title="인식 결과 확인" />
        <EmptyResult onRetry={() => router.replace('/register/photo')} />
      </div>
    );
  }

  const checkedCount = items.filter(i => i.checked).length;

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header title="인식 결과 확인" />

      {/* 부제목 */}
      <div className="px-5 pt-4 pb-2 flex-shrink-0">
        <p className="text-[14px] text-subtext">
          <span className="text-text font-semibold">{items.length}개</span> 인식됐어요 · 등록할 항목을 선택해주세요
        </p>
      </div>

      {/* 아이템 리스트 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-5 bg-surface rounded-xl border border-border overflow-hidden mb-4">
          {items.map((item) => (
            <ConfirmRow
              key={item._idx}
              item={item}
              onToggle={toggle}
              onStorageChange={changeStorage}
              onQuantityChange={changeQty}
            />
          ))}
        </div>
      </div>

      {/* 등록 버튼 */}
      <div className="px-5 pt-3 pb-6 bg-surface border-t border-border">
        <button
          onClick={handleRegister}
          disabled={saving || checkedCount === 0}
          className="w-full h-[52px] bg-primary text-white rounded-xl text-[15px] font-semibold disabled:bg-disabled transition-colors"
        >
          {saving ? '등록 중...' : `등록하기 ${checkedCount}개`}
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

// ─── 페이지 진입점 ─────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="flex flex-col h-full bg-bg">
      <Header title="인식 결과 확인" />
      <div className="mx-5 mt-4 bg-surface rounded-xl border border-border overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => <SkeletonItem key={i} />)}
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ConfirmContent />
    </Suspense>
  );
}
