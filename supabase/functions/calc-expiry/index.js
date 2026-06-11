// Supabase Edge Function: calc-expiry
// POST { item, catalog } → { effective_expiry_date, expiry_is_estimated }
// lib/calcExpiry.js와 동일한 로직 — 서버사이드 트리거/배치에서 사용

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function calcEffectiveExpiry(item, catalog) {
  const dates = [];

  if (item.label_expiry_date) {
    dates.push(item.label_expiry_date);
  } else if (catalog?.shelf_days && item.purchase_date) {
    dates.push(addDays(item.purchase_date, catalog.shelf_days));
  }

  if (item.is_opened && item.opened_at && catalog?.opened_days) {
    dates.push(addDays(item.opened_at, catalog.opened_days));
  }

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { item, catalog } = await req.json();
    const result = calcEffectiveExpiry(item, catalog ?? null);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
