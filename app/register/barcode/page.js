'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Barcode, Keyboard, X } from 'lucide-react';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';

// 진행 상태: scanning → looking-up → notfound | error
// 찾으면 곧바로 /register/manual 로 프리필 이동

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

export default function BarcodeRegisterPage() {
  const router = useRouter();

  const [mode,      setMode]      = useState('scanning'); // scanning|manual
  const [status,    setStatus]    = useState('idle');     // idle|looking-up|notfound|error
  const [errMsg,    setErrMsg]    = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [cameraOk,  setCameraOk]  = useState(null);       // null=확인 중, true|false

  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const detectTimer = useRef(null);
  const lookingUp   = useRef(false);

  // ── 바코드 조회 → 직접입력 폼 프리필 이동 ──────────────────
  const lookup = useCallback(async (code) => {
    if (lookingUp.current) return;
    lookingUp.current = true;
    setStatus('looking-up');

    try {
      const { data, error } = await supabase.functions.invoke('barcode-lookup', {
        body: { barcode: code },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (!data?.found) {
        setStatus('notfound');
        lookingUp.current = false;
        return;
      }

      // 프리필 데이터 저장 후 직접입력 폼으로
      sessionStorage.setItem('register_prefill', JSON.stringify({
        name:         data.product.name,
        category:     data.product.category ?? 'etc',
        storage_type: data.product.storage_type ?? 'pantry',
        unit:         data.catalog?.default_unit ?? '개',
        shelf_days:   data.product.shelf_days,
        catalog:      data.catalog ?? null,
        barcode:      data.product.barcode,
      }));
      router.replace('/register/manual?from=barcode');

    } catch (err) {
      console.error(err);
      setErrMsg(err.message ?? '조회에 실패했어요');
      setStatus('error');
      lookingUp.current = false;
    }
  }, [router]);

  // ── 네이티브(ML Kit) 스캔 ──────────────────────────────────
  const scanNative = useCallback(async () => {
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== 'granted' && camera !== 'limited') {
        setCameraOk(false);
        return;
      }
      setCameraOk(true);
      const { barcodes } = await BarcodeScanner.scan();
      const code = barcodes?.[0]?.rawValue;
      if (code) lookup(code);
    } catch {
      setCameraOk(false);
    }
  }, [lookup]);

  // ── 웹 카메라 + BarcodeDetector ────────────────────────────
  const startWebScan = useCallback(async () => {
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
      setCameraOk(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOk(true);

      const detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS });
      detectTimer.current = setInterval(async () => {
        if (!videoRef.current || lookingUp.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0 && codes[0].rawValue) {
            lookup(codes[0].rawValue);
          }
        } catch { /* 프레임 미준비 등 무시 */ }
      }, 350);
    } catch {
      setCameraOk(false);
    }
  }, [lookup]);

  const stopWebScan = useCallback(() => {
    clearInterval(detectTimer.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // ── 시작/정리 ──────────────────────────────────────────────
  useEffect(() => {
    let isNative = false;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        isNative = Capacitor.isNativePlatform();
      } catch { /* 웹 전용 환경 */ }
      if (isNative) scanNative();
      else startWebScan();
    })();
    return () => stopWebScan();
  }, [scanNative, startWebScan, stopWebScan]);

  // 카메라를 못 쓰면 수동 입력 모드로 자동 전환
  useEffect(() => {
    if (cameraOk === false) setMode('manual');
  }, [cameraOk]);

  // 다시 스캔
  const resetScan = () => {
    setStatus('idle');
    setErrMsg(null);
    lookingUp.current = false;
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!/^\d{6,14}$/.test(code)) {
      setErrMsg('바코드 번호를 정확히 입력해주세요 (6~14자리 숫자)');
      setStatus('error');
      return;
    }
    setErrMsg(null);
    lookup(code);
  };

  const isLookingUp = status === 'looking-up';

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header title="바코드 스캔" />

      <div className="flex-1 flex flex-col px-5 py-5 overflow-y-auto">

        {/* ── 카메라 스캔 영역 ── */}
        {mode === 'scanning' && (
          <div className="flex flex-col gap-4">
            <div className="relative w-full rounded-2xl overflow-hidden bg-[#1A1A2E]" style={{ aspectRatio: '3/4' }}>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* 스캔 가이드 프레임 */}
              {cameraOk && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[70%] h-28 border-2 border-white rounded-xl opacity-80" />
                </div>
              )}

              {/* 카메라 사용 불가 */}
              {cameraOk === false && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
                  <Barcode size={40} color="#8A94A6" />
                  <p className="text-white text-[14px] text-center leading-relaxed">
                    카메라 스캔을 사용할 수 없어요.<br />
                    아래에서 바코드 번호를 직접 입력해주세요.
                  </p>
                </div>
              )}

              {/* 조회 중 오버레이 */}
              {isLookingUp && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
                  <div className="w-full max-w-[200px] flex flex-col gap-2 px-6">
                    <div className="h-3 bg-white/30 animate-pulse rounded-xl" />
                    <div className="h-3 bg-white/20 animate-pulse rounded-xl w-3/4 mx-auto" />
                  </div>
                  <p className="text-white text-[14px] font-semibold">제품 정보를 찾고 있어요...</p>
                </div>
              )}
            </div>

            <p className="text-[13px] text-subtext text-center">
              제품 뒷면의 바코드를 프레임 안에 맞춰주세요
            </p>

            <button
              onClick={() => { stopWebScan(); setMode('manual'); resetScan(); }}
              className="flex items-center justify-center gap-2 w-full h-[52px] bg-surface text-text border border-border rounded-xl text-[15px] font-medium"
            >
              <Keyboard size={18} color="#8A94A6" />
              번호 직접 입력
            </button>
          </div>
        )}

        {/* ── 수동 입력 ── */}
        {mode === 'manual' && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[13px] text-subtext mb-1">바코드 번호</p>
              <input
                type="text"
                inputMode="numeric"
                value={manualCode}
                onChange={e => setManualCode(e.target.value.replace(/\D/g, ''))}
                placeholder="예: 8801115114154"
                maxLength={14}
                className="w-full h-[52px] bg-bg border border-border rounded-xl px-4 text-[15px] text-text outline-none focus:border-primary tracking-wider"
              />
            </div>
            <button
              onClick={handleManualSubmit}
              disabled={isLookingUp || manualCode.length < 6}
              className="w-full h-[52px] bg-primary text-white rounded-xl text-[15px] font-semibold disabled:bg-disabled transition-colors"
            >
              {isLookingUp ? '조회 중...' : '조회하기'}
            </button>
            {cameraOk !== false && (
              <button
                onClick={() => { setMode('scanning'); resetScan(); startWebScan(); }}
                className="flex items-center justify-center gap-1.5 text-[14px] text-primary mx-auto"
              >
                <Barcode size={15} />
                카메라로 스캔하기
              </button>
            )}
          </div>
        )}

        {/* ── 결과: 못 찾음 ── */}
        {status === 'notfound' && (
          <div className="mt-6 bg-surface border border-border rounded-xl p-5 flex flex-col items-center gap-3">
            <div className="text-3xl">🔍</div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-text">제품 정보를 찾지 못했어요</p>
              <p className="text-[13px] text-subtext mt-1 leading-relaxed">
                공공 데이터에 없는 제품이에요.<br />직접 입력으로 등록해주세요.
              </p>
            </div>
            <div className="w-full flex gap-3 mt-1">
              <button
                onClick={resetScan}
                className="flex-1 h-[44px] bg-bg border border-border rounded-xl text-[14px] text-text font-medium"
              >
                다시 스캔
              </button>
              <button
                onClick={() => router.replace('/register/manual')}
                className="flex-1 h-[44px] bg-primary text-white rounded-xl text-[14px] font-semibold"
              >
                직접 입력
              </button>
            </div>
          </div>
        )}

        {/* ── 오류 ── */}
        {status === 'error' && errMsg && (
          <div className="mt-4 bg-[#FEE2E2] rounded-xl px-4 py-3 flex items-start gap-2">
            <X size={16} color="#EF4444" className="mt-0.5 flex-shrink-0" />
            <p className="text-[13px] text-danger leading-relaxed">{errMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
