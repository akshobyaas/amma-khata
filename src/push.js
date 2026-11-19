import { h } from './dom.js';
import { t } from './i18n.js';
import { firebaseConfig } from '../firebase-config.js';

const base = 'https://www.gstatic.com/firebasejs/10.14.1';

async function register(store, vapidKey) {
  const { getMessaging, getToken, onMessage } = await import(`${base}/firebase-messaging.js`);
  const reg = await navigator.serviceWorker.register(
    './firebase-messaging-sw.js?config=' + encodeURIComponent(JSON.stringify(firebaseConfig)), { scope: './' });
  const messaging = getMessaging(store.app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
  if (token) await store.saveToken(token);
  // While the app is open, show the same notification the phone would show when closed.
  onMessage(messaging, m => {
    const n = m.notification || {};
    reg.showNotification(n.title || 'Amma Khata', { body: n.body || '', icon: 'icon-192.png' });
  });
  return token;
}

// Registers push quietly when allowed; otherwise shows one "Turn on reminders" button.
export function offerPush(slot, store, vapidKey, getLang) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  if (Notification.permission === 'granted') { register(store, vapidKey).catch(console.error); return; }
  if (Notification.permission === 'denied') return;
  const btn = h('button', { type: 'button', class: 'btn btn-line', style: 'margin:14px 16px 0;width:calc(100% - 32px)',
    onclick: async () => {
      const p = await Notification.requestPermission();
      btn.remove();
      if (p === 'granted') await register(store, vapidKey).catch(console.error);
    } }, '🔔 ' + t('allowNotifications', getLang()));
  slot.append(btn);
}
