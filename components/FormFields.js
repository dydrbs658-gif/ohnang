'use client';

// ─── 단위별 수량 규칙 ─────────────────────────────────────────
// 단위를 고르면 수량 기본값·증감 폭이 그 단위 스케일로 자동 설정된다.
export const UNIT_RULES = {
  '개':   { step: 1,   dflt: 1 },
  '팩':   { step: 1,   dflt: 1 },
  '병':   { step: 1,   dflt: 1 },
  '봉지': { step: 1,   dflt: 1 },
  'g':    { step: 100, dflt: 100 },
  'ml':   { step: 100, dflt: 100 },
  'kg':   { step: 0.5, dflt: 1 },
  'L':    { step: 0.5, dflt: 1 },
};
const DEFAULT_RULE = { step: 1, dflt: 1 };

export const COMMON_UNITS = Object.keys(UNIT_RULES);

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ─── 수량 + 단위 필드 ─────────────────────────────────────────
export function QuantityUnitField({ quantity, unit, onQuantityChange, onUnitChange }) {
  const rule = UNIT_RULES[unit] ?? DEFAULT_RULE;
  const minQ = rule.step < 1 ? rule.step : 1;

  const stepBy = (dir) => {
    const cur = parseFloat(quantity) || 0;
    onQuantityChange(round2(Math.max(minQ, cur + dir * rule.step)));
  };

  const handleInput = (raw) => {
    if (raw === '') { onQuantityChange(''); return; }
    const v = parseFloat(raw);
    if (!isNaN(v)) onQuantityChange(v);
  };

  const pickUnit = (u) => {
    onUnitChange(u);
    // 단위 스케일에 맞춰 수량 자동 보정 (개→1, g→100, kg→1 ...)
    const r = UNIT_RULES[u] ?? DEFAULT_RULE;
    onQuantityChange(r.dflt);
  };

  return (
    <div>
      <p className="text-[13px] text-subtext mb-1">수량</p>
      <div className="flex gap-3">
        <div className="flex items-center bg-bg border border-border rounded-xl overflow-hidden flex-1">
          <button
            type="button"
            onClick={() => stepBy(-1)}
            className="w-12 h-[52px] flex items-center justify-center text-subtext text-[22px] font-light active:bg-border transition-colors"
          >
            −
          </button>
          <input
            type="number"
            inputMode="decimal"
            step={rule.step}
            value={quantity}
            onChange={e => handleInput(e.target.value)}
            onBlur={() => {
              const v = parseFloat(quantity);
              onQuantityChange(isNaN(v) ? rule.dflt : round2(Math.max(minQ, v)));
            }}
            className="flex-1 text-center h-[52px] bg-transparent text-[15px] text-text outline-none"
            min={minQ}
          />
          <button
            type="button"
            onClick={() => stepBy(1)}
            className="w-12 h-[52px] flex items-center justify-center text-subtext text-[22px] font-light active:bg-border transition-colors"
          >
            +
          </button>
        </div>
        <input
          type="text"
          value={unit}
          onChange={e => onUnitChange(e.target.value)}
          placeholder="단위"
          className="w-20 h-[52px] bg-bg border border-border rounded-xl px-3 text-[15px] text-center text-text outline-none focus:border-primary"
        />
      </div>
      {/* 단위 빠른 선택 */}
      <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5">
        {COMMON_UNITS.map(u => (
          <button
            key={u}
            type="button"
            onClick={() => pickUnit(u)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              unit === u
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-subtext'
            }`}
          >
            {u}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── 유통기한 필드 (누적 더하기 칩) ──────────────────────────
const EXPIRY_PRESETS = [
  { label: '+1일',   days: 1 },
  { label: '+3일',   days: 3 },
  { label: '+1주',   days: 7 },
  { label: '+1개월', days: 30 },
];

export function ExpiryDateField({ value, onChange, hint }) {
  // 칩을 누를 때마다 현재 설정된 날짜(없으면 오늘)에 누적으로 더해진다
  const addDays = (days) => {
    const base = value ? new Date(value) : new Date();
    base.setDate(base.getDate() + days);
    onChange(base.toISOString().split('T')[0]);
  };

  return (
    <div>
      <p className="text-[13px] text-subtext mb-1">유통기한</p>
      <input
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full h-[52px] bg-bg border border-border rounded-xl px-4 text-[15px] text-text outline-none focus:border-primary"
      />
      <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5 items-center">
        {EXPIRY_PRESETS.map(p => (
          <button
            key={p.days}
            type="button"
            onClick={() => addDays(p.days)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium bg-surface border border-border text-subtext active:bg-bg transition-colors"
          >
            {p.label}
          </button>
        ))}
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium text-danger bg-[#FEE2E2] transition-colors"
          >
            지우기
          </button>
        )}
      </div>
      {hint && <p className="text-[12px] text-subtext mt-1">{hint}</p>}
    </div>
  );
}

// ─── 수량 표시 포맷 (NUMERIC → "1.5", "1") ───────────────────
export function fmtQty(q) {
  const n = parseFloat(q);
  return isNaN(n) ? q : String(n);
}
