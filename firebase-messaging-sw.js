// Push service worker. Firebase config arrives in this file's URL (?config=...),
// because a classic worker cannot import firebase-config.js.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const config = JSON.parse(new URL(self.location).searchParams.get('config') || '{}');
if (config.apiKey) {
  firebase.initializeApp(config);
  firebase.messaging(); // messages with a notification part are shown automatically when the app is closed
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return clients.openWindow('./');
  }));
});
