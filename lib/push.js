// 푸시 알림 등록 (네이티브 전용 — 웹에서는 no-op)
// Capacitor Push Notifications + FCM
import { supabase } from '@/lib/supabase';

let initialized = false;

export async function initPush(userId, onNavigate) {
  if (initialized || !userId) return;

  let Capacitor;
  try {
    ({ Capacitor } = await import('@capacitor/core'));
  } catch {
    return;
  }
  if (!Capacitor.isNativePlatform()) return;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  // 권한 확인/요청
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') return;

  initialized = true;

  // FCM 토큰 수신 → profiles 저장
  await PushNotifications.addListener('registration', async (token) => {
    const platform = Capacitor.getPlatform(); // 'ios' | 'android'
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token.value, push_platform: platform })
      .eq('id', userId);
    if (error) console.error('푸시 토큰 저장 실패:', error.message);
  });

  await PushNotifications.addListener('registrationError', (err) => {
    console.error('푸시 등록 실패:', err);
  });

  // 알림 탭 → 홈으로 이동
  await PushNotifications.addListener('pushNotificationActionPerformed', () => {
    onNavigate?.('/home');
  });

  await PushNotifications.register();
}

export async function disablePushToken(userId) {
  if (!userId) return;
  const { error } = await supabase
    .from('profiles')
    .update({ push_token: null })
    .eq('id', userId);
  if (error) console.error('푸시 토큰 해제 실패:', error.message);
}
