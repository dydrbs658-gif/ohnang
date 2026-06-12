'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChefHat, Clock, RefreshCw, ChevronDown } from 'lucide-react';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getDday, getDdayLabel, getDdayStyle } from '@/lib/dday';

const DIFFICULTY_STYLE = {
  '쉬움':   { bg: '#F0FDF4', color: '#10B981' },
  '보통':   { bg: '#FEF3C7', color: '#F59E0B' },
  '어려움': { bg: '#FEE2E2', color: '#EF4444' },
};

const CACHE_KEY = 'recipe_cache';

function loadCache(partyId) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];
    if (cache.party_id !== partyId || cache.date !== today) return null;
    return cache;
  } catch {
    return null;
  }
}

function saveCache(partyId, recipes, basedOn) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      party_id: partyId,
      date:     new Date().toISOString().split('T')[0],
      recipes,
      based_on: basedOn,
    }));
  } catch { /* 저장 실패 무시 */ }
}

// ─── 레시피 카드 ──────────────────────────────────────────────
function RecipeCard({ recipe }) {
  const [open, setOpen] = useState(false);
  const diff = DIFFICULTY_STYLE[recipe.difficulty] ?? DIFFICULTY_STYLE['보통'];

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full p-4 text-left active:bg-bg transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-semibold text-text">{recipe.name}</p>
            <p className="text-[13px] text-subtext mt-1 leading-relaxed">{recipe.description}</p>
          </div>
          <ChevronDown
            size={18}
            color="#8A94A6"
            className={`flex-shrink-0 mt-1 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className="flex items-center gap-1 text-[12px] text-subtext bg-bg px-2 py-1 rounded-full">
            <Clock size={12} />
            {recipe.time_minutes}분
          </span>
          <span
            className="text-[12px] font-medium px-2 py-1 rounded-full"
            style={{ backgroundColor: diff.bg, color: diff.color }}
          >
            {recipe.difficulty}
          </span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[#F0F2F5] pt-3 flex flex-col gap-3">
          {/* 재료 */}
          <div>
            <p className="text-[12px] font-semibold text-subtext mb-1.5">사용하는 재고</p>
            <div className="flex flex-wrap gap-1.5">
              {(recipe.ingredients_have ?? []).map((ing, i) => (
                <span key={i} className="text-[12px] text-primary bg-[#EFF4FF] px-2 py-1 rounded-full font-medium">
                  {ing}
                </span>
              ))}
            </div>
          </div>

          {(recipe.ingredients_need ?? []).length > 0 && (
            <div>
              <p className="text-[12px] font-semibold text-subtext mb-1.5">추가로 필요해요</p>
              <div className="flex flex-wrap gap-1.5">
                {recipe.ingredients_need.map((ing, i) => (
                  <span key={i} className="text-[12px] text-subtext bg-bg px-2 py-1 rounded-full">
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 조리 단계 */}
          <div>
            <p className="text-[12px] font-semibold text-subtext mb-1.5">만드는 법</p>
            <ol className="flex flex-col gap-2">
              {(recipe.steps ?? []).map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-bg text-subtext text-[11px] font-semibold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-[14px] text-text leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 스켈레톤 ─────────────────────────────────────────────────
function RecipeSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="bg-surface border border-border rounded-xl p-4">
          <div className="h-5 w-2/5 bg-bg animate-pulse rounded-xl" />
          <div className="h-4 w-4/5 bg-bg animate-pulse rounded-xl mt-2" />
          <div className="flex gap-2 mt-3">
            <div className="h-6 w-14 bg-bg animate-pulse rounded-full" />
            <div className="h-6 w-14 bg-bg animate-pulse rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────
export default function RecipePage() {
  const { profile } = useAuth();
  const partyId = profile?.party_id;

  const [items,       setItems]       = useState([]);
  const [selected,    setSelected]    = useState(new Set()); // 선택한 재료 id
  const [recipes,     setRecipes]     = useState(null);  // null = 아직 추천 안 받음
  const [basedOn,     setBasedOn]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [errMsg,      setErrMsg]      = useState(null);

  // 재고 로드 (임박 순) + 임박 재료(D-7) 기본 선택
  useEffect(() => {
    if (!partyId) return;
    (async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, effective_expiry_date')
        .eq('party_id', partyId)
        .eq('status', 'active')
        .neq('storage_type', 'supplement')
        .order('effective_expiry_date', { ascending: true, nullsFirst: false })
        .limit(30);
      if (!error) {
        const list = data ?? [];
        setItems(list);
        const urgent = list.filter(i => {
          const d = getDday(i.effective_expiry_date);
          return d !== null && d <= 7;
        }).slice(0, 8);
        setSelected(new Set(urgent.map(i => i.id)));
      }
      setItemsLoaded(true);
    })();

    // 오늘 받은 추천 캐시 복원
    const cache = loadCache(partyId);
    if (cache) {
      setRecipes(cache.recipes);
      setBasedOn(cache.based_on ?? []);
    }
  }, [partyId]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchRecipes = useCallback(async () => {
    if (!partyId || loading) return;
    setLoading(true);
    setErrMsg(null);

    const selectedNames = items
      .filter(i => selected.has(i.id))
      .map(i => i.name);

    try {
      const { data, error } = await supabase.functions.invoke('recommend-recipe', {
        body: { party_id: partyId, selected_names: selectedNames },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setRecipes(data.recipes ?? []);
      setBasedOn(data.based_on ?? []);
      saveCache(partyId, data.recipes ?? [], data.based_on ?? []);
    } catch (err) {
      console.error(err);
      setErrMsg(err.message ?? '추천을 받지 못했어요');
    } finally {
      setLoading(false);
    }
  }, [partyId, loading, items, selected]);

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header title="요리 추천" showBack={false} />

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 flex flex-col gap-6">

          {/* 재료 고르기 섹션 */}
          {items.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[13px] font-semibold text-subtext">
                  쓸 재료 고르기
                </p>
                <span className="text-[12px] text-subtext">
                  {selected.size > 0 ? `${selected.size}개 선택` : ''}
                </span>
              </div>
              <p className="text-[12px] text-subtext mb-3">
                선택한 재료를 꼭 사용하는 요리를 추천해드려요 · 임박한 재료는 미리 골라뒀어요
              </p>
              <div className="flex flex-wrap gap-2">
                {items.map(item => {
                  const dday   = getDday(item.effective_expiry_date);
                  const style  = getDdayStyle(dday);
                  const active = selected.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleSelect(item.id)}
                      className={`flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1.5 text-[13px] transition-colors border ${
                        active
                          ? 'bg-primary border-primary text-white font-medium'
                          : 'bg-surface border-border text-text'
                      }`}
                    >
                      {item.name}
                      <span
                        className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={
                          active
                            ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#FFFFFF' }
                            : { backgroundColor: style.bg, color: style.color }
                        }
                      >
                        {getDdayLabel(dday)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* 추천 결과 / CTA */}
          <section className="flex flex-col gap-3">
            {recipes !== null && (
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-subtext">
                  오늘의 추천 요리
                </p>
                <button
                  onClick={fetchRecipes}
                  disabled={loading}
                  className="flex items-center gap-1 text-[13px] text-primary disabled:text-disabled"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  다시 추천
                </button>
              </div>
            )}

            {loading && <RecipeSkeleton />}

            {!loading && recipes === null && (
              <div className="flex flex-col items-center gap-5 py-10">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#EFF4FF' }}
                >
                  <ChefHat size={44} color="#1D6AE5" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <p className="text-[16px] font-semibold text-text">뭐 해먹을지 고민될 때</p>
                  <p className="text-[13px] text-subtext mt-1 leading-relaxed">
                    임박한 재료로 만들 수 있는 요리를<br />AI가 추천해드려요
                  </p>
                </div>
                <button
                  onClick={fetchRecipes}
                  disabled={!itemsLoaded || !partyId}
                  className="w-full h-[52px] bg-primary text-white rounded-xl text-[15px] font-semibold disabled:bg-disabled"
                >
                  {selected.size > 0 ? `재료 ${selected.size}개로 추천 받기` : '요리 추천 받기'}
                </button>
              </div>
            )}

            {!loading && recipes !== null && recipes.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="w-20 h-20 rounded-full bg-bg flex items-center justify-center">
                  <ChefHat size={34} color="#8A94A6" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <p className="text-[15px] font-semibold text-text">추천할 요리를 찾지 못했어요</p>
                  <p className="text-[13px] text-subtext mt-1">재고를 먼저 등록해보세요</p>
                </div>
              </div>
            )}

            {!loading && recipes !== null && recipes.length > 0 && (
              <>
                {basedOn.length > 0 && (
                  <p className="text-[12px] text-subtext -mt-1">
                    {basedOn.slice(0, 3).join(', ')} 재료를 우선 활용했어요
                  </p>
                )}
                <div className="flex flex-col gap-3">
                  {recipes.map((r, i) => <RecipeCard key={i} recipe={r} />)}
                </div>
              </>
            )}

            {errMsg && (
              <div className="bg-[#FEE2E2] rounded-xl px-4 py-3">
                <p className="text-[13px] text-danger leading-relaxed">{errMsg}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
