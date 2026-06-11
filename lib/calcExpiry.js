function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function calcEffectiveExpiry(item, catalog = null) {
  const dates = [];

  // 1. 라벨 기한 or 카탈로그 기본값
  if (item.label_expiry_date) {
    dates.push(item.label_expiry_date);
  } else if (catalog?.shelf_days && item.purchase_date) {
    dates.push(addDays(item.purchase_date, catalog.shelf_days));
  }

  // 2. 개봉한 경우 → 개봉일+opened_days와 비교해 빠른 날짜 선택
  if (item.is_opened && item.opened_at && catalog?.opened_days) {
    dates.push(addDays(item.opened_at, catalog.opened_days));
  }

  // 3. 냉동 중인 경우 → 냉동 기한으로 완전 대체
  if (item.is_frozen && item.frozen_at && catalog?.frozen_days) {
    return {
      effective_expiry_date: addDays(item.frozen_at, catalog.frozen_days),
      expiry_is_estimated: !item.label_expiry_date,
    };
  }

  if (dates.length === 0) {
    return { effective_expiry_date: null, expiry_is_estimated: false };
  }

  const min = dates.reduce((a, b) => (a < b ? a : b));
  return {
    effective_expiry_date: min,
    expiry_is_estimated: !item.label_expiry_date,
  };
}
