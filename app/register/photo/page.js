'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ImageIcon, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// 진행 상태
// idle → preview → uploading → analyzing → done | error

export default function PhotoRegisterPage() {
  const router           = useRouter();
  const { user, profile } = useAuth();
  const fileInputRef     = useRef(null);

  const [status,  setStatus]  = useState('idle');   // idle|preview|uploading|analyzing|error
  const [preview, setPreview] = useState(null);      // data URL
  const [fileObj, setFileObj] = useState(null);      // File or { dataUrl, mimeType }
  const [errMsg,  setErrMsg]  = useState(null);

  // ── 파일 → preview 세팅 ─────────────────────────────────
  const loadFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
      setFileObj(file);
      setStatus('preview');
    };
    reader.readAsDataURL(file);
  };

  // ── Capacitor Camera (native + web fallback) ────────────
  const openCamera = async (sourceType) => {
    try {
      const { Camera: CapCamera, CameraResultType, CameraSource } =
        await import('@capacitor/camera');

      const image = await CapCamera.getPhoto({
        quality:       85,
        allowEditing:  false,
        resultType:    CameraResultType.DataUrl,
        source:        sourceType === 'gallery' ? CameraSource.Photos : CameraSource.Camera,
      });

      setPreview(image.dataUrl);
      setFileObj({ dataUrl: image.dataUrl, mimeType: image.format === 'png' ? 'image/png' : 'image/jpeg' });
      setStatus('preview');
    } catch (err) {
      // 사용자 취소 또는 웹 환경 → input fallback
      const cancelled = /cancel|denied|dismissed/i.test(err?.message ?? '');
      if (!cancelled) fileInputRef.current?.click();
    }
  };

  // ── AI 분석 시작 ────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!profile?.party_id || !user?.id) return;

    setStatus('uploading');
    setErrMsg(null);

    try {
      // 1. Blob 변환
      let blob;
      if (fileObj instanceof File) {
        blob = fileObj;
      } else {
        const res  = await fetch(fileObj.dataUrl);
        blob       = await res.blob();
      }

      const mimeType = blob.type || fileObj.mimeType || 'image/jpeg';
      const ext      = mimeType.includes('png') ? 'png' : 'jpg';
      const scanId   = crypto.randomUUID();
      const imgPath  = `${profile.party_id}/${scanId}.${ext}`;

      // 2. Supabase Storage 업로드
      const { error: uploadErr } = await supabase.storage
        .from('scans')
        .upload(imgPath, blob, { contentType: mimeType, upsert: false });

      if (uploadErr) throw uploadErr;

      // 3. scans 레코드 생성
      const { error: insertErr } = await supabase.from('scans').insert({
        id:         scanId,
        party_id:   profile.party_id,
        created_by: user.id,
        image_path: imgPath,
        status:     'pending',
      });

      if (insertErr) throw insertErr;

      setStatus('analyzing');

      // 4. Edge Function 호출 (동기 — 응답 대기)
      const { data, error: fnErr } = await supabase.functions.invoke('analyze-photo', {
        body: { scan_id: scanId },
      });

      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      // 5. 결과 확인 화면으로 이동
      router.push(`/register/confirm?scan_id=${scanId}`);

    } catch (err) {
      console.error(err);
      setErrMsg(err.message ?? '알 수 없는 오류가 발생했어요');
      setStatus('error');
    }
  };

  const reset = () => {
    setStatus('idle');
    setPreview(null);
    setFileObj(null);
    setErrMsg(null);
  };

  // ── 상태별 렌더 ─────────────────────────────────────────
  const isProcessing = status === 'uploading' || status === 'analyzing';

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header title="사진으로 등록" />

      <div className="flex-1 flex flex-col px-5 py-5 overflow-y-auto">

        {/* ── idle: 사진 선택 유도 ── */}
        {status === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-8">
            {/* 점선 원형 영역 */}
            <div
              className="w-56 h-56 rounded-full flex flex-col items-center justify-center gap-3"
              style={{ border: '2.5px dashed #C8CDD6' }}
            >
              <Camera size={48} color="#C8CDD6" strokeWidth={1.5} />
              <p className="text-[13px] text-subtext text-center px-4 leading-relaxed">
                라벨과 내용물이<br />잘 보이게 찍어요
              </p>
            </div>

            <div className="w-full flex flex-col gap-3">
              <button
                onClick={() => openCamera('camera')}
                className="w-full h-[52px] bg-primary text-white rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2"
              >
                <Camera size={20} />
                카메라로 촬영
              </button>
              <button
                onClick={() => openCamera('gallery')}
                className="w-full h-[52px] bg-surface text-text border border-border rounded-xl text-[15px] font-medium flex items-center justify-center gap-2"
              >
                <ImageIcon size={20} color="#8A94A6" />
                갤러리에서 선택
              </button>
            </div>
          </div>
        )}

        {/* ── preview: 사진 확인 ── */}
        {status === 'preview' && preview && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="선택한 사진" className="w-full h-full object-cover" />
            </div>
            <button
              onClick={reset}
              className="flex items-center justify-center gap-1.5 text-[14px] text-primary mx-auto"
            >
              <RefreshCw size={15} />
              다시 선택
            </button>
          </div>
        )}

        {/* ── 처리 중: 업로드 / 분석 ── */}
        {isProcessing && preview && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="분석 중" className="w-full h-full object-cover opacity-50" />
              {/* 로딩 오버레이 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="w-full max-w-[200px] flex flex-col gap-2 px-6">
                  <div className="h-3 bg-white/40 animate-pulse rounded-xl" />
                  <div className="h-3 bg-white/25 animate-pulse rounded-xl w-3/4 mx-auto" />
                </div>
                <p className="text-white text-[14px] font-semibold drop-shadow-lg">
                  {status === 'uploading' ? '사진 업로드 중...' : 'AI가 식품을 인식하고 있어요...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── 오류 ── */}
        {status === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
            <div className="text-4xl">😢</div>
            <div className="text-center">
              <p className="text-[16px] font-semibold text-text">분석에 실패했어요</p>
              <p className="text-[13px] text-subtext mt-1 leading-relaxed">{errMsg}</p>
            </div>
            <button
              onClick={reset}
              className="px-6 h-[44px] bg-bg border border-border rounded-xl text-[14px] text-text font-medium"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>

      {/* ── 하단 CTA ── */}
      {(status === 'preview') && (
        <div className="px-5 pt-3 pb-6 bg-surface border-t border-border">
          <button
            onClick={handleAnalyze}
            className="w-full h-[52px] bg-primary text-white rounded-xl text-[15px] font-semibold"
          >
            AI로 분석하기
          </button>
        </div>
      )}

      {/* 숨겨진 file input (web fallback) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''; }}
      />
    </div>
  );
}
