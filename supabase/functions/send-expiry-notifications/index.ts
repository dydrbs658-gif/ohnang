// Supabase Edge Function: send-expiry-notifications
// pg_cron 등으로 매 30분 호출 → 발송 시간이 된 사용자에게 임박 재고 푸시 발송
// 필수 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FCM_SERVICE_ACCOUNT (서비스 계정 JSON 문자열)

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── 타입 정의 ────────────────────────────────────────────────

interface ProfileRow {
  id:                   string;
  party_id:             string;
  push_token:           string;
  notification_freq:    'daily' | '3x_week' | 'weekly' | 'random';
  notification_times:   string[];
}

interface ItemRow {
  name:                  string;
  effective_expiry_date: string;
}

interface ServiceAccount {
  project_id:   string;
  client_email: string;
  private_key:  string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ─── KST 시간 유틸 ────────────────────────────────────────────

function nowKst(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

// 현재 KST를 30분 단위로 내림한 "HH:MM"
function currentSlotKst(): string {
  const d  = nowKst();
  const h  = d.getUTCHours();
  const m  = d.getUTCMinutes() < 30 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
}

function todayKst(): string {
  return nowKst().toISOString().split('T')[0];
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// 빈도 조건: daily 매일, 3x_week 월·수·금, weekly 월요일, random 1/3 확률
function freqMatches(freq: ProfileRow['notification_freq']): boolean {
  const dow = nowKst().getUTCDay(); // 0=일
  switch (freq) {
    case 'daily':   return true;
    case '3x_week': return dow === 1 || dow === 3 || dow === 5;
    case 'weekly':  return dow === 1;
    case 'random':  return Math.random() < 1 / 3;
    default:        return true;
  }
}

// ─── FCM v1 액세스 토큰 (서비스 계정 JWT) ─────────────────────

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8', der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now    = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }));

  const key       = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const jwt = `${header}.${claims}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });
  if (!res.ok) throw new Error(`FCM 토큰 발급 실패 (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

async function sendFcm(
  sa: ServiceAccount, accessToken: string,
  token: string, title: string, body: string,
): Promise<boolean> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: { route: '/home' },
        },
      }),
    },
  );
  return res.ok;
}

// ─── 메인 핸들러 ───────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT');
    if (!saRaw) throw new Error('FCM_SERVICE_ACCOUNT 환경변수가 설정되지 않았습니다');
    const sa: ServiceAccount = JSON.parse(saRaw);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const slot  = currentSlotKst();
    const today = todayKst();

    // ── 1. 이번 슬롯에 알림 받을 프로필 조회 ─────────────────
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, party_id, push_token, notification_freq, notification_times')
      .eq('notification_enabled', true)
      .not('push_token', 'is', null)
      .not('party_id', 'is', null)
      .contains('notification_times', [slot]);

    if (profErr) throw profErr;

    const targets = (profiles as ProfileRow[] ?? []).filter(p => freqMatches(p.notification_freq));
    if (targets.length === 0) return json({ sent: 0, slot });

    // ── 2. 최근 1시간 내 이미 발송된 프로필 제외 (같은 슬롯 재실행 방지) ──
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentLogs } = await supabase
      .from('notification_logs')
      .select('profile_id')
      .gte('sent_at', since)
      .in('profile_id', targets.map(t => t.id));

    const alreadySent = new Set((recentLogs ?? []).map(l => l.profile_id));

    let accessToken: string | null = null;
    let sent = 0;

    // ── 3. 파티별 임박 재고 조회 + 발송 ──────────────────────
    const partyCache = new Map<string, ItemRow[]>();

    for (const profile of targets) {
      if (alreadySent.has(profile.id)) continue;

      let items = partyCache.get(profile.party_id);
      if (!items) {
        const { data } = await supabase
          .from('items')
          .select('name, effective_expiry_date')
          .eq('party_id', profile.party_id)
          .eq('status', 'active')
          .not('effective_expiry_date', 'is', null)
          .lte('effective_expiry_date', addDaysStr(today, 3))
          .order('effective_expiry_date', { ascending: true })
          .limit(10);
        items = (data as ItemRow[]) ?? [];
        partyCache.set(profile.party_id, items);
      }

      if (items.length === 0) continue;

      const first = items[0];
      const title = '⏰ 유통기한 임박 알림';
      const body  = items.length === 1
        ? `${first.name}의 기한이 곧 끝나요. 오늘 확인해보세요!`
        : `${first.name} 외 ${items.length - 1}개 품목의 기한이 임박했어요.`;

      if (!accessToken) accessToken = await getAccessToken(sa);

      const ok = await sendFcm(sa, accessToken, profile.push_token, title, body);

      if (ok) {
        sent++;
        await supabase.from('notification_logs').insert({
          profile_id: profile.id,
          title, body,
          item_count: items.length,
        });
      } else {
        // 만료/무효 토큰 정리
        await supabase.from('profiles')
          .update({ push_token: null })
          .eq('id', profile.id);
      }
    }

    return json({ sent, slot, targets: targets.length });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return json({ error: message }, 500);
  }
});
