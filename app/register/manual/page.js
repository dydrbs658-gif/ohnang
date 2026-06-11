'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { calcEffectiveExpiry } from '@/lib/calcExpiry';

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

// ─── Toggle 컴포넌트 ────────────────────────────────────────
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

// ─── 수량 스텝퍼 ─────────────────────────────────────────────
function QuantityStepper({ value, onChange }) {
  return (
    <div className="flex items-center bg-bg border border-border rounded-xl overflow-hidden flex-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="w-12 h-[52px] flex items-center justify-center text-subtext text-[22px] font-light active:bg-border transition-colors"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="flex-1 text-center h-[52px] bg-transparent text-[15px] text-text outline-none"
        min={1}
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-12 h-[52px] flex items-center justify-center text-subtext text-[22px] font-light active:bg-border transition-colors"
      >
        +
      </button>
    </div>
  );
}

// ─── 날짜 입력 ───────────────────────────────────────────────
function DateInput({ value, onChange, max, label, hint }) {
  return (
    <div>
      {label && <p className="text-[13px] text-subtext mb-1">{label}</p>}
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        max={max}
        className="w-full h-[52px] bg-bg border border-border rounded-xl px-4 text-[15px] text-text outline-none focus:border-primary"
      />
      {hint && <p className="text-[12px] text-subtext mt-1">{hint}</p>}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────
export default function ManualRegisterPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [form, setForm] = useState({
    name:              '',
    storage_type:      'fridge',
    quantity:          1,
    unit:              '개',
    label_expiry_date: '',
    purchase_date:     today(),
    is_opened:         false,
    opened_at:         '',
    is_frozen:         false,
    frozen_at:         '',
    memo:              '',
  });

  const [catalog,      setCatalog]      = useState(null);
  const [suggestions,  setSuggestions]  = useState([]);
  const [showSuggest,  setShowSuggest]  = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [errors,       setErrors]       = useState({});
  const [toast,        setToast]        = useState(null);

  const suggestTimer = useRef(null);

  // 바코드 스캔 결과 프리필 (sessionStorage 경유)
  useEffect(() => {
    let prefill = null;
    try {
      const raw = sessionStorage.getItem('register_prefill');
      if (raw) prefill = JSON.parse(raw);
    } catch { /* 손상된 데이터 무시 */ }
    if (!prefill) return;

    sessionStorage.removeItem('register_prefill');

    setForm(f => ({
      ...f,
      name:         prefill.name         || f.name,
      storage_type: prefill.storage_type || f.storage_type,
      unit:         prefill.unit         || f.unit,
      is_frozen:    prefill.storage_type === 'freezer',
    }));

    // 카탈로그 매칭이 있으면 그대로, 없으면 공공 API 유통기한으로 가상 카탈로그 구성
    if (prefill.catalog) {
      setCatalog(prefill.catalog);
    } else if (prefill.shelf_days) {
      setCatalog({
        id:           null,
        name:         prefill.name,
        category:     prefill.category ?? 'etc',
        default_unit: prefill.unit ?? '개',
        shelf_days:   prefill.shelf_days,
        opened_days:  null,
        frozen_days:  null,
      });
    }
  }, []);

  const set = useCallback((key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }, [errors]);

  // 자동완성 검색
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
    if (!form.quantity || form.quantity < 1) e.quantity = '수량을 입력해주세요';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    if (!profile?.party_id || !user?.id) {
      showToast('로그인이 필요해요');
      return;
    }

    setSaving(true);

    const { effective_expiry_date, expiry_is_estimated } = calcEffectiveExpiry(form, catalog);

    const payload = {
      party_id:             profile.party_id,
      created_by:           user.id,
      name:                 form.name.trim(),
      category:             catalog?.category ?? 'etc',
      storage_type:         form.storage_type,
      quantity:             Number(form.quantity),
      unit:                 form.unit.trim() || '개',
      label_expiry_date:    form.label_expiry_date    || null,
      purchase_date:        form.purchase_date        || today(),
      is_opened:            form.is_opened,
      opened_at:            form.is_opened ? (form.opened_at || null) : null,
      is_frozen:            form.is_frozen,
      frozen_at:            form.is_frozen ? (form.frozen_at || null) : null,
      memo:                 form.memo.trim()           || null,
      effective_expiry_date,
      expiry_is_estimated,
      catalog_id:           catalog?.id               ?? null,
      status:               'active',
    };

    const { error } = await supabase.from('items').insert(payload);
    setSaving(false);

    if (error) {
      console.error(error);
      showToast('등록에 실패했어요. 다시 시도해주세요');
      return;
    }

    router.replace('/home');
  };

  // 냉동 토글은 냉장·실온·기타일 때만 (freezer 선택 시는 기본 냉동 상태)
  const canToggleFrozen = ['fridge', 'pantry', 'etc'].includes(form.storage_type);

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header title="직접 입력" />

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
                placeholder="예: 우유, 달걀, 두부"
                className={`w-full h-[52px] bg-bg rounded-xl px-4 text-[15px] text-text outline-none border transition-colors ${
                  errors.name ? 'border-danger' : 'border-border focus:border-primary'
                }`}
              />
              {errors.name && (
                <p className="text-[12px] text-danger mt-1">{errors.name}</p>
              )}

              {/* 자동완성 드롭다운 */}
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
                    // 냉동 선택 시 is_frozen 자동 ON
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

          {/* 수량 + 단위 */}
          <div>
            <p className="text-[13px] text-subtext mb-1">수량</p>
            <div className="flex gap-3">
              <QuantityStepper value={form.quantity} onChange={v => set('quantity', v)} />
              <input
                type="text"
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
                placeholder="단위"
                className="w-20 h-[52px] bg-bg border border-border rounded-xl px-3 text-[15px] text-center text-text outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* 유통기한 */}
          <DateInput
            label="유통기한"
            value={form.label_expiry_date}
            onChange={v => set('label_expiry_date', v)}
            hint={
              !form.label_expiry_date
                ? catalog
                  ? `카탈로그 기준 자동 계산돼요 (구매일로부터 ${catalog.shelf_days}일)`
                  : '입력 안 하면 날짜 미정으로 등록돼요'
                : undefined
            }
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
                {catalog?.opened_days && (
                  <p className="text-[12px] text-subtext mt-1">
                    개봉 후 {catalog.opened_days}일까지 유통기한이 단축돼요
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 냉동 여부 (냉장·실온·기타일 때만) */}
          {canToggleFrozen && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <span className="text-[15px] text-text">냉동 중이에요</span>
                  {catalog?.frozen_days && (
                    <p className="text-[12px] text-subtext mt-0.5">
                      냉동 기한 {catalog.frozen_days}일로 연장돼요
                    </p>
                  )}
                </div>
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

          {/* 추가 정보 (구매일, 메모) */}
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

      {/* 등록하기 버튼 */}
      <div className="px-5 pt-3 pb-6 bg-surface border-t border-border">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !form.name.trim()}
          className="w-full h-[52px] bg-primary text-white rounded-xl text-[15px] font-semibold disabled:bg-disabled transition-colors"
        >
          {saving ? '등록 중...' : '등록하기'}
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
