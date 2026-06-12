'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronDown, Trash2 } from 'lucide-react';
import Header from '@/components/Header';
import SkeletonItem from '@/components/SkeletonItem';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { calcEffectiveExpiry } from '@/lib/calcExpiry';
import { QuantityUnitField, ExpiryDateField } from '@/components/FormFields';

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

// ─── 서브 컴포넌트 ──────────────────────────────────────────

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${
        value ? 'bg-primary' : 'bg-disabled'
      }`}
      aria-pressed={value}
    >
      <div
        className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${
          value ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function DateInput({ value, onChange, max, label, hint }) {
  return (
    <div>
      {label && <p className="text-[13px] text-subtext mb-1">{label}</p>}
      <input
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        max={max}
        className="w-full h-[52px] bg-bg border border-border rounded-xl px-4 text-[15px] text-text outline-none focus:border-primary"
      />
      {hint && <p className="text-[12px] text-subtext mt-1">{hint}</p>}
    </div>
  );
}

// ─── 삭제 확인 모달 ─────────────────────────────────────────

function DeleteModal({ itemName, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-5">
      <div className="bg-surface rounded-2xl p-6 w-full max-w-sm">
        <p className="text-[17px] font-semibold text-text text-center">삭제하시겠어요?</p>
        <p className="text-[14px] text-subtext text-center mt-2 leading-relaxed">
          <span className="text-text font-medium">{itemName}</span>을(를) 삭제하면<br />
          복구할 수 없어요
        </p>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-[52px] bg-bg text-text rounded-xl text-[15px] font-medium border border-border disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-[52px] bg-danger text-white rounded-xl text-[15px] font-semibold disabled:bg-disabled"
          >
            {loading ? '삭제 중...' : '삭제하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 로딩 스켈레톤 ─────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="flex flex-col h-full bg-bg">
      <Header title="재고 수정" />
      <div className="mx-5 mt-4 bg-surface rounded-xl border border-border overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => <SkeletonItem key={i} />)}
      </div>
    </div>
  );
}

// ─── 편집 폼 ───────────────────────────────────────────────

function ItemEditContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { user }     = useAuth();
  const id           = searchParams.get('id');

  const [original,     setOriginal]     = useState(null);
  const [form,         setForm]         = useState(null);
  const [catalog,      setCatalog]      = useState(null);
  const [suggestions,  setSuggestions]  = useState([]);
  const [showSuggest,  setShowSuggest]  = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [showDelete,   setShowDelete]   = useState(false);
  const [errors,       setErrors]       = useState({});
  const [toast,        setToast]        = useState(null);
  const [loading,      setLoading]      = useState(true);

  const suggestTimer = useRef(null);

  // ── 초기 데이터 로드 ──
  useEffect(() => {
    if (!id) { setLoading(false); return; }

    supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setLoading(false); return; }
        setOriginal(data);
        setForm({
          name:              data.name,
          storage_type:      data.storage_type,
          quantity:          parseFloat(data.quantity) || 1,
          unit:              data.unit,
          label_expiry_date: data.label_expiry_date ?? '',
          purchase_date:     data.purchase_date ?? today(),
          is_opened:         data.is_opened,
          opened_at:         data.opened_at ?? '',
          is_frozen:         data.is_frozen,
          frozen_at:         data.frozen_at ?? '',
          memo:              data.memo ?? '',
        });
        setLoading(false);
      });
  }, [id]);

  const set = useCallback((key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }, [errors]);

  // ── 자동완성 ──
  const searchCatalog = useCallback(async (q) => {
    if (!q || q.length < 1) { setSuggestions([]); return; }
    const { data } = await supabase
      .from('food_catalog')
      .select('id, name, category, default_unit, shelf_days, opened_days, frozen_days')
      .ilike('name', `%${q}%`)
      .limit(6);
    setSuggestions(data ?? []);
  }, []);

  const handleNameChange = (val) => {
    set('name', val);
    clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => searchCatalog(val), 200);
    setShowSuggest(true);
    if (!val) setCatalog(null);
  };

  const selectCatalog = (item) => {
    setCatalog(item);
    setForm(f => ({ ...f, name: item.name, unit: item.default_unit || '개' }));
    setSuggestions([]);
    setShowSuggest(false);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = '품목명을 입력해주세요';
    if (!form.quantity || parseFloat(form.quantity) <= 0) e.quantity = '수량을 입력해주세요';
    return e;
  };

  // ── 수정 저장 ──
  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);

    const catalogForCalc = catalog ?? {
      shelf_days:  original?.catalog_id ? null : null,
      opened_days: null,
      frozen_days: null,
    };

    const { effective_expiry_date, expiry_is_estimated } = calcEffectiveExpiry(form, catalogForCalc);

    const patch = {
      name:                 form.name.trim(),
      category:             catalog?.category ?? original?.category ?? 'etc',
      storage_type:         form.storage_type,
      quantity:             Number(form.quantity),
      unit:                 form.unit.trim() || '개',
      label_expiry_date:    form.label_expiry_date    || null,
      purchase_date:        form.purchase_date        || today(),
      is_opened:            form.is_opened,
      opened_at:            form.is_opened ? (form.opened_at  || null) : null,
      is_frozen:            form.is_frozen,
      frozen_at:            form.is_frozen ? (form.frozen_at  || null) : null,
      memo:                 form.memo.trim()           || null,
      effective_expiry_date,
      expiry_is_estimated,
      ...(catalog ? { catalog_id: catalog.id } : {}),
    };

    const { error } = await supabase.from('items').update(patch).eq('id', id);
    setSaving(false);

    if (error) {
      console.error(error);
      showToast('저장에 실패했어요. 다시 시도해주세요');
      return;
    }

    router.replace(`/item?id=${id}`);
  };

  // ── 삭제 ──
  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('items').delete().eq('id', id);
    setDeleting(false);
    if (error) {
      showToast('삭제에 실패했어요');
      setShowDelete(false);
      return;
    }
    router.replace('/home');
  };

  // ── 로딩/에러 상태 ──
  if (!id || (!loading && !original)) {
    return (
      <div className="flex flex-col h-full bg-bg">
        <Header title="재고 수정" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-subtext text-[14px]">재고를 찾을 수 없어요</p>
        </div>
      </div>
    );
  }

  if (loading || !form) return <PageSkeleton />;

  const canToggleFrozen = ['fridge', 'pantry', 'etc'].includes(form.storage_type);

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* 헤더 */}
      <Header
        title="재고 수정"
        rightContent={
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="flex items-center justify-center w-11 h-11"
            aria-label="삭제"
          >
            <Trash2 size={20} color="#EF4444" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 flex flex-col gap-5">

          {/* 품목명 */}
          <div>
            <p className="text-[13px] text-subtext mb-1">품목명 *</p>
            <div className="relative">
              <input
                type="text"
                value={form.name}
                onChange={e => handleNameChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                onFocus={() => form.name && setShowSuggest(true)}
                placeholder="품목명"
                className={`w-full h-[52px] bg-bg rounded-xl px-4 text-[15px] text-text outline-none border transition-colors ${
                  errors.name ? 'border-danger' : 'border-border focus:border-primary'
                }`}
              />
              {errors.name && (
                <p className="text-[12px] text-danger mt-1">{errors.name}</p>
              )}
              {showSuggest && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl overflow-hidden z-20 shadow-md">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={() => selectCatalog(s)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-bg"
                      style={{ borderBottom: i < suggestions.length - 1 ? '1px solid #F0F2F5' : 'none' }}
                    >
                      <span className="text-[15px] text-text">{s.name}</span>
                      <span className="text-[13px] text-subtext ml-auto">{s.default_unit}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 보관 위치 */}
          <div>
            <p className="text-[13px] text-subtext mb-2">보관 위치</p>
            <div className="flex gap-2 flex-wrap">
              {STORAGE_TYPES.map(st => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => {
                    set('storage_type', st.value);
                    if (st.value === 'freezer') set('is_frozen', true);
                    else set('is_frozen', false);
                  }}
                  className={`px-4 py-2 rounded-full text-[13px] font-medium transition-colors ${
                    form.storage_type === st.value
                      ? 'bg-primary text-white'
                      : 'bg-surface border border-border text-subtext'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* 수량 + 단위 (단위 선택 시 수량 자동 보정) */}
          <QuantityUnitField
            quantity={form.quantity}
            unit={form.unit}
            onQuantityChange={v => set('quantity', v)}
            onUnitChange={v => set('unit', v)}
          />

          {/* 유통기한 (칩 누를 때마다 누적 더하기) */}
          <ExpiryDateField
            value={form.label_expiry_date}
            onChange={v => set('label_expiry_date', v)}
          />

          {/* 개봉 여부 */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-[15px] text-text">개봉했어요</span>
              <Toggle value={form.is_opened} onChange={v => set('is_opened', v)} />
            </div>
            {form.is_opened && (
              <div className="px-4 pb-4 border-t border-[#F0F2F5] pt-3">
                <DateInput
                  label="개봉일"
                  value={form.opened_at}
                  onChange={v => set('opened_at', v)}
                  max={today()}
                />
              </div>
            )}
          </div>

          {/* 냉동 여부 */}
          {canToggleFrozen && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-[15px] text-text">냉동 중이에요</span>
                <Toggle value={form.is_frozen} onChange={v => set('is_frozen', v)} />
              </div>
              {form.is_frozen && (
                <div className="px-4 pb-4 border-t border-[#F0F2F5] pt-3">
                  <DateInput
                    label="냉동 시작일"
                    value={form.frozen_at}
                    onChange={v => set('frozen_at', v)}
                    max={today()}
                  />
                </div>
              )}
            </div>
          )}

          {/* 추가 정보 */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-1 text-[14px] text-primary"
            >
              추가 정보
              <ChevronDown
                size={16}
                className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              />
            </button>
            {showAdvanced && (
              <div className="flex flex-col gap-4 mt-4">
                <DateInput
                  label="구매일"
                  value={form.purchase_date}
                  onChange={v => set('purchase_date', v)}
                  max={today()}
                />
                <div>
                  <p className="text-[13px] text-subtext mb-1">메모</p>
                  <textarea
                    value={form.memo}
                    onChange={e => set('memo', e.target.value)}
                    placeholder="예: 이마트 세일, 유기농"
                    rows={3}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-[15px] text-text outline-none focus:border-primary resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="h-2" />
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="px-5 pt-3 pb-6 bg-surface border-t border-border">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !form.name.trim()}
          className="w-full h-[52px] bg-primary text-white rounded-xl text-[15px] font-semibold disabled:bg-disabled transition-colors"
        >
          {saving ? '저장 중...' : '수정 완료'}
        </button>
      </div>

      {/* 삭제 확인 모달 */}
      {showDelete && (
        <DeleteModal
          itemName={original?.name}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          loading={deleting}
        />
      )}

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
export default function ItemEditPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ItemEditContent />
    </Suspense>
  );
}
