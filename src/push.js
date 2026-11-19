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

// Shows "Turn on reminders" until this device has a token, and shows any problem on screen.
export function offerPush(slot, store, vapidKey, getLang, device) {
  const say = (text) => slot.replaceChildren(h('p', { class: 'note', role: 'status', style: 'margin:12px 16px 0' }, text));
  if (!('Notification' in window) || !('serviceWorker' in navigator)) { say(t('remindersUnsupported', getLang())); return; }

  async function turnOn() {
    let p = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission();
    if (p !== 'granted') { say(t('remindersBlocked', getLang())); return; }
    try {
      const token = await register(store, vapidKey);
      if (!token) throw new Error('no token returned');
      say('✓ ' + t('remindersOn', getLang()));
      setTimeout(() => slot.replaceChildren(), 4000);
    } catch (e) {
      console.error(e);
      slot.replaceChildren(
        h('p', { class: 'error', role: 'alert', style: 'margin:12px 16px 4px' }, t('remindersFailed', getLang()) + ' ' + (e && e.message || e)),
        button());
    }
  }
  const button = () => h('button', { type: 'button', class: 'btn btn-line', style: 'margin:12px 16px 0;width:calc(100% - 32px)', onclick: turnOn },
    '🔔 ' + t('allowNotifications', getLang()));

  if (device && device.fcmToken && Notification.permission === 'granted') {
    register(store, vapidKey).catch(e => { console.error(e); slot.replaceChildren(button()); });
    return;
  }
  slot.replaceChildren(button());
}
