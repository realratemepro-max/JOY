// JOY - Firebase Cloud Messaging Service Worker
// This file is loaded by Firebase Messaging at /firebase-messaging-sw.js
// to handle background notifications.

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDA1eHtXsTs3jvi8xmide3qxyBMtmVslxE',
  authDomain: 'realrateme-731f1.firebaseapp.com',
  projectId: 'realrateme-731f1',
  storageBucket: 'realrateme-731f1.firebasestorage.app',
  messagingSenderId: '689412859878',
  appId: '1:689412859878:web:fbbb603242c7900eb45827',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'JOY';
  const body = payload.notification?.body || payload.data?.body || '';
  const icon = '/icons/icon-192.svg';
  const url = payload.data?.url || payload.fcmOptions?.link || '/app';
  self.registration.showNotification(title, {
    body,
    icon,
    badge: icon,
    tag: payload.data?.tag || 'joy-notification',
    data: { url },
    requireInteraction: false,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/app';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((winClients) => {
      // Focus existing tab if open
      for (const client of winClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
