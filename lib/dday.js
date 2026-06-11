export function getDday(expiryDate) {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
}

export function getDdayLabel(dday) {
  if (dday === null) return '미정';
  if (dday < 0) return `D+${Math.abs(dday)}`;
  if (dday === 0) return 'D-day';
  return `D-${dday}`;
}

export function getDdayStyle(dday) {
  if (dday === null) return { bg: '#F4F6FA', color: '#8A94A6' };
  if (dday <= 0)     return { bg: '#EF4444', color: '#FFFFFF' }; // D-day, 만료
  if (dday <= 2)     return { bg: '#FEE2E2', color: '#EF4444' }; // D-1, D-2
  if (dday <= 7)     return { bg: '#FEF3C7', color: '#F59E0B' }; // D-3~7
  return               { bg: '#F4F6FA', color: '#8A94A6' };      // D-8+
}

export function getSectionLabel(dday) {
  if (dday === null) return '날짜 미정';
  if (dday < 0)      return '이미 지남';
  if (dday === 0)    return '오늘';
  if (dday === 1)    return '내일';
  if (dday <= 7)     return '이번 주';
  return               '여유 있음';
}

export const SECTION_ORDER = ['이미 지남', '오늘', '내일', '이번 주', '여유 있음', '날짜 미정'];

// (아이콘은 components/CategoryIcon.js 의 STORAGE_META 사용)
export const CATEGORY_CONFIG = {
  fridge:     { label: '냉장',   bg: '#EFF4FF' },
  freezer:    { label: '냉동',   bg: '#F0F9FF' },
  pantry:     { label: '실온',   bg: '#FFFBEB' },
  supplement: { label: '영양제', bg: '#F0FDF4' },
  etc:        { label: '기타',   bg: '#F4F6FA' },
};
