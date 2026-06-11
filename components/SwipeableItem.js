'use client';

import { useRef, useState, useCallback } from 'react';

const TRIGGER = 80;   // px — 이 거리 이상 스와이프 시 액션 발동
const MAX_TX  = 110;  // px — 최대 이동 거리

export default function SwipeableItem({ onEaten, onDiscarded, children }) {
  const startX   = useRef(0);
  const startY   = useRef(0);
  const dragging = useRef(false);
  const isHoriz  = useRef(false);

  const [tx,       setTx]       = useState(0);
  const [settling, setSettling] = useState(false);

  const direction = tx > TRIGGER ? 'eaten' : tx < -TRIGGER ? 'discarded' : null;
  const bgOpacity = Math.min(Math.abs(tx) / TRIGGER, 1);

  const onTouchStart = useCallback((e) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dragging.current = true;
    isHoriz.current  = false;
    setSettling(false);
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (!isHoriz.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      isHoriz.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!isHoriz.current) return;

    e.preventDefault(); // 수직 스크롤 방지
    setTx(Math.max(-MAX_TX, Math.min(MAX_TX, dx)));
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setSettling(true);

    const snap = tx;
    setTx(0);
    setTimeout(() => setSettling(false), 300);

    if (snap > TRIGGER)  onEaten?.();
    else if (snap < -TRIGGER) onDiscarded?.();
  }, [tx, onEaten, onDiscarded]);

  return (
    <div className="relative overflow-hidden">
      {/* 우→ 먹었어요 배경 */}
      <div
        className="absolute inset-0 flex items-center pl-5"
        style={{ backgroundColor: '#10B981', opacity: tx > 0 ? bgOpacity : 0 }}
        aria-hidden
      >
        <span className="text-white text-[14px] font-semibold">먹었어요 ✓</span>
      </div>

      {/* 좌→ 버렸어요 배경 */}
      <div
        className="absolute inset-0 flex items-center justify-end pr-5"
        style={{ backgroundColor: '#EF4444', opacity: tx < 0 ? bgOpacity : 0 }}
        aria-hidden
      >
        <span className="text-white text-[14px] font-semibold">✕ 버렸어요</span>
      </div>

      {/* 실제 콘텐츠 */}
      <div
        style={{
          transform:  `translateX(${tx}px)`,
          transition: settling ? 'transform 0.28s ease-out' : 'none',
          willChange: 'transform',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
