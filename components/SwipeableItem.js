'use client';

import { useRef, useState, useCallback } from 'react';

const TRIGGER = 80;   // px — 이 거리 이상 스와이프 시 액션 발동
const MAX_TX  = 110;  // px — 최대 이동 거리

// 터치 + 마우스 모두 지원 (Pointer Events)
export default function SwipeableItem({ onEaten, onDiscarded, children }) {
  const startX   = useRef(0);
  const startY   = useRef(0);
  const dragging = useRef(false);
  const isHoriz  = useRef(false);
  const moved    = useRef(false); // 드래그 후 클릭(링크 이동) 방지용

  const [tx,       setTx]       = useState(0);
  const [settling, setSettling] = useState(false);

  const bgOpacity = Math.min(Math.abs(tx) / TRIGGER, 1);

  const onPointerDown = useCallback((e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startX.current   = e.clientX;
    startY.current   = e.clientY;
    dragging.current = true;
    isHoriz.current  = false;
    moved.current    = false;
    setSettling(false);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (!isHoriz.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      isHoriz.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!isHoriz.current) return;

    moved.current = true;
    setTx(Math.max(-MAX_TX, Math.min(MAX_TX, dx)));
  }, []);

  const finishDrag = useCallback((fire) => {
    if (!dragging.current) return;
    dragging.current = false;
    setSettling(true);

    setTx(prev => {
      if (fire) {
        if (prev > TRIGGER)       onEaten?.();
        else if (prev < -TRIGGER) onDiscarded?.();
      }
      return 0;
    });
    setTimeout(() => setSettling(false), 300);
  }, [onEaten, onDiscarded]);

  const onPointerUp     = useCallback(() => finishDrag(true),  [finishDrag]);
  const onPointerCancel = useCallback(() => finishDrag(false), [finishDrag]);

  // 드래그였다면 클릭(링크 이동) 무시
  const onClickCapture = useCallback((e) => {
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
    }
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* 우→ 먹었어요 배경 */}
      <div
        className="absolute inset-0 flex items-center pl-5"
        style={{ backgroundColor: '#10B981', opacity: tx > 0 ? bgOpacity : 0 }}
        aria-hidden
      >
        <span className="text-white text-[14px] font-semibold">먹었어요</span>
      </div>

      {/* 좌→ 버렸어요 배경 */}
      <div
        className="absolute inset-0 flex items-center justify-end pr-5"
        style={{ backgroundColor: '#EF4444', opacity: tx < 0 ? bgOpacity : 0 }}
        aria-hidden
      >
        <span className="text-white text-[14px] font-semibold">버렸어요</span>
      </div>

      {/* 실제 콘텐츠 */}
      <div
        style={{
          transform:   `translateX(${tx}px)`,
          transition:  settling ? 'transform 0.28s ease-out' : 'none',
          willChange:  'transform',
          touchAction: 'pan-y',   // 수직 스크롤은 브라우저에, 수평은 우리가
          userSelect:  'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
