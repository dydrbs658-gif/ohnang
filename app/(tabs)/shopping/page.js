'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, ShoppingCart, Check, PackagePlus, RotateCcw, BellRing } from 'lucide-react';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// ─── 스켈레톤 ─────────────────────────────────────────────────
function ShoppingSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-6 h-6 bg-bg animate-pulse rounded-full flex-shrink-0" />
          <div className="h-4 flex-1 bg-bg animate-pulse rounded-xl" />
        </div>
      ))}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────
export default function ShoppingPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const partyId = profile?.party_id;

  const [list,    setList]    = useState([]);
  const [suggest, setSuggest] = useState([]); // 재구매 제안 (먹은 기록 기반)
  const [loading, setLoading] = useState(true);
  const [name,    setName]    = useState('');
  const [adding,  setAdding]  = useState(false);
  const [toast,   setToast]   = useState(null);

  const inputRef = useRef(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  const fetchList = useCallback(async () => {
    if (!partyId) return;
    const { data, error } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('party_id', partyId)
      .order('created_at', { ascending: false });
    if (!error) setList(data ?? []);
    setLoading(false);
  }, [partyId]);

  useEffect(() => {
    if (!partyId) return;
    fetchList();

    const channel = supabase
      .channel(`shopping-${partyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_items', filter: `party_id=eq.${partyId}` },
        () => fetchList()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partyId, fetchList]);

  // 재구매 제안: 최근 45일 내 먹은 품목 중 현재 재고에 없는 것
  useEffect(() => {
    if (!partyId) return;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 45);

      const [eatenRes, activeRes] = await Promise.all([
        supabase
          .from('items')
          .select('name, unit, eaten_at')
          .eq('party_id', partyId)
          .eq('status', 'eaten')
          .gte('eaten_at', since.toISOString())
          .order('eaten_at', { ascending: false })
          .limit(100),
        supabase
          .from('items')
          .select('name')
          .eq('party_id', partyId)
          .eq('status', 'active')
          .limit(200),
      ]);
      if (eatenRes.error || activeRes.error) return;

      const activeNames = new Set((activeRes.data ?? []).map(i => i.name));
      const map = new Map();
      for (const it of eatenRes.data ?? []) {
        if (activeNames.has(it.name)) continue;
        const cur = map.get(it.name);
        if (cur) cur.count += 1;
        else map.set(it.name, { name: it.name, unit: it.unit, count: 1 });
      }
      setSuggest(Array.from(map.values()).slice(0, 6));
    })();
  }, [partyId]);

  // ── 추가 ───────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || adding || !partyId) return;

    setAdding(true);
    const { error } = await supabase.from('shopping_items').insert({
      party_id:   partyId,
      name:       trimmed,
      created_by: user?.id,
    });
    setAdding(false);

    if (error) {
      showToast('추가하지 못했어요. 다시 시도해주세요');
      return;
    }
    setName('');
    inputRef.current?.focus();
    fetchList();
  };

  // ── 체크 토글 ──────────────────────────────────────────────
  const toggleChecked = async (item) => {
    // 낙관적 업데이트
    setList(l => l.map(i => i.id === item.id
      ? { ...i, is_checked: !i.is_checked, checked_at: i.is_checked ? null : new Date().toISOString() }
      : i
    ));
    const { error } = await supabase
      .from('shopping_items')
      .update({
        is_checked: !item.is_checked,
        checked_at: item.is_checked ? null : new Date().toISOString(),
      })
      .eq('id', item.id);
    if (error) {
      fetchList();
      showToast('오류가 발생했어요');
    }
  };

  // ── 삭제 ───────────────────────────────────────────────────
  const handleDelete = async (item) => {
    setList(l => l.filter(i => i.id !== item.id));
    const { error } = await supabase.from('shopping_items').delete().eq('id', item.id);
    if (error) {
      fetchList();
      showToast('삭제하지 못했어요');
    }
  };

  // ── 구매 완료 → 재고 등록 ──────────────────────────────────
  const registerAsItem = (item) => {
    try {
      sessionStorage.setItem('register_prefill', JSON.stringify({
        name: item.name,
        unit: item.unit || '개',
      }));
    } catch { /* 저장 실패해도 빈 폼으로 진행 */ }
    router.push('/register/manual');
  };

  const clearChecked = async () => {
    const ids = list.filter(i => i.is_checked).map(i => i.id);
    if (ids.length === 0) return;
    setList(l => l.filter(i => !i.is_checked));
    const { error } = await supabase.from('shopping_items').delete().in('id', ids);
    if (error) {
      fetchList();
      showToast('비우지 못했어요');
    } else {
      showToast('구매 완료 목록을 비웠어요');
    }
  };

  // 재구매 제안에 담기
  const addSuggested = async (s) => {
    setSuggest(prev => prev.filter(x => x.name !== s.name));
    const { error } = await supabase.from('shopping_items').insert({
      party_id:   partyId,
      name:       s.name,
      unit:       s.unit || '개',
      created_by: user?.id,
    });
    if (error) {
      showToast('담지 못했어요');
      return;
    }
    showToast(`${s.name}을(를) 장보기에 담았어요`);
    fetchList();
  };

  const pending = list.filter(i => !i.is_checked);
  const checked = list.filter(i => i.is_checked);
  // 이미 목록에 있는 품목은 제안에서 숨김
  const visibleSuggest = suggest.filter(s => !list.some(i => i.name === s.name));

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header title="장보기" showBack={false} />

      {/* 빠른 추가 입력 */}
      <form onSubmit={handleAdd} className="px-5 pt-4 flex-shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="살 것을 입력하세요 (예: 우유)"
            maxLength={50}
            className="flex-1 h-[52px] bg-surface border border-border rounded-xl px-4 text-[15px] text-text outline-none focus:border-primary placeholder:text-disabled"
          />
          <button
            type="submit"
            disabled={!name.trim() || adding}
            aria-label="장보기 추가"
            className="w-[52px] h-[52px] bg-primary rounded-xl flex items-center justify-center flex-shrink-0 disabled:bg-disabled transition-colors"
          >
            <Plus size={24} color="#FFFFFF" />
          </button>
        </div>
      </form>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 flex flex-col gap-6">
          {loading ? (
            <ShoppingSkeleton />
          ) : (
            <>
              {/* 다시 채울 때 됐어요 (먹은 기록 기반 재구매 제안) */}
              {visibleSuggest.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-1">
                    <RotateCcw size={14} color="#0EA5A0" />
                    <p className="text-[13px] font-semibold text-subtext">다시 채울 때 됐어요</p>
                  </div>
                  <p className="text-[12px] text-subtext mb-3">
                    최근에 다 먹었는데 냉장고에 없는 품목이에요
                  </p>
                  <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    {visibleSuggest.map((s, idx) => (
                      <div
                        key={s.name}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{ borderBottom: idx < visibleSuggest.length - 1 ? '1px solid #F0F2F5' : 'none' }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] text-text font-medium truncate">{s.name}</p>
                          {s.count > 1 && (
                            <p className="text-[12px] text-subtext mt-0.5">최근 {s.count}번 소비했어요</p>
                          )}
                        </div>
                        <button
                          onClick={() => addSuggested(s)}
                          className="flex items-center gap-1 text-[12px] font-medium text-secondary bg-[#ECFDF5] rounded-full px-2.5 py-1.5 flex-shrink-0 active:opacity-70"
                        >
                          <Plus size={13} />
                          담기
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {list.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#EFF4FF' }}
                  >
                    <ShoppingCart size={36} color="#1D6AE5" strokeWidth={1.5} />
                  </div>
                  <div className="text-center">
                    <p className="text-[16px] font-semibold text-text">장보기 목록이 비어 있어요</p>
                    <p className="text-[14px] text-subtext mt-1 leading-relaxed">
                      살 것을 적어두면 파티원과 실시간으로 공유돼요.<br />
                      다 먹은 재고도 여기로 보낼 수 있어요
                    </p>
                  </div>
                </div>
              ) : (
                <>
              {/* 살 것 */}
              {pending.length > 0 && (
                <section>
                  <p className="text-[13px] font-semibold text-subtext mb-3">
                    살 것 {pending.length}
                  </p>
                  <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    {pending.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-3.5"
                        style={{ borderBottom: idx < pending.length - 1 ? '1px solid #F0F2F5' : 'none' }}
                      >
                        <button
                          onClick={() => toggleChecked(item)}
                          aria-label={`${item.name} 구매 완료`}
                          className="w-6 h-6 rounded-full border-2 border-border flex-shrink-0 active:border-primary transition-colors"
                        />
                        <button
                          onClick={() => toggleChecked(item)}
                          className="flex-1 text-left text-[15px] text-text font-medium truncate"
                        >
                          {item.name}
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          aria-label={`${item.name} 삭제`}
                          className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                        >
                          <X size={16} color="#C8CDD6" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 구매 완료 */}
              {checked.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-semibold text-subtext">
                      구매 완료 {checked.length}
                    </p>
                    <button
                      onClick={clearChecked}
                      className="text-[13px] text-subtext active:text-text"
                    >
                      비우기
                    </button>
                  </div>
                  <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    {checked.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-3.5"
                        style={{ borderBottom: idx < checked.length - 1 ? '1px solid #F0F2F5' : 'none' }}
                      >
                        <button
                          onClick={() => toggleChecked(item)}
                          aria-label={`${item.name} 체크 해제`}
                          className="w-6 h-6 rounded-full bg-success flex items-center justify-center flex-shrink-0"
                        >
                          <Check size={14} color="#FFFFFF" strokeWidth={3} />
                        </button>
                        <button
                          onClick={() => toggleChecked(item)}
                          className="flex-1 text-left text-[15px] text-subtext line-through truncate"
                        >
                          {item.name}
                        </button>
                        <button
                          onClick={() => registerAsItem(item)}
                          className="flex items-center gap-1 text-[12px] font-medium text-primary bg-[#EFF4FF] rounded-full px-2.5 py-1.5 flex-shrink-0 active:opacity-70"
                        >
                          <PackagePlus size={13} />
                          재고 등록
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[12px] text-subtext mt-2 px-1">
                    사 온 품목은 재고로 등록해야 기한 알림을 받을 수 있어요
                  </p>
                </section>
              )}
                </>
              )}

              {/* 가격 알림 (준비 중 티저) */}
              <section className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#FEF3C7' }}
                  >
                    <BellRing size={20} color="#F59E0B" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-medium text-text">가격 알림</p>
                      <span className="text-[11px] font-semibold text-subtext bg-bg rounded-full px-2 py-0.5">
                        곧 제공
                      </span>
                    </div>
                    <p className="text-[12px] text-subtext mt-1 leading-relaxed">
                      자주 사는 품목의 할인·최저가 타이밍을 알려드릴 예정이에요
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-20 left-5 right-5 z-50 flex justify-center pointer-events-none">
          <div className="bg-[#1A1A2E] text-white rounded-xl px-4 py-3 text-[14px] font-medium shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
