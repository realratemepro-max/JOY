import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import app, { db } from './firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

let messagingInstance: Messaging | null = null;

async function getMsg(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  try {
    if (!(await isSupported())) return null;
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (e) {
    console.warn('Firebase Messaging not supported:', e);
    return null;
  }
}

/**
 * Request notification permission and register the device's FCM token on the user document.
 * Returns the token or null on failure.
 */
export async function registerPushNotifications(userId: string): Promise<string | null> {
  if (!VAPID_KEY) {
    console.warn('VITE_FIREBASE_VAPID_KEY not set — skipping push registration');
    return null;
  }
  if (typeof Notification === 'undefined') {
    console.warn('Notifications API not available');
    return null;
  }

  const msg = await getMsg();
  if (!msg) return null;

  let permission: NotificationPermission = Notification.permission;
  if (permission === 'default') {
    try { permission = await Notification.requestPermission(); }
    catch (e) { console.warn('Permission request failed', e); return null; }
  }
  if (permission !== 'granted') return null;

  try {
    // Register the dedicated FCM service worker
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    const token = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (!token) {
      console.warn('No FCM token returned');
      return null;
    }
    // Save token on user doc (array — supports multiple devices)
    try {
      await updateDoc(doc(db, 'users', userId), { fcmTokens: arrayUnion(token) });
    } catch (e) {
      console.warn('Could not save FCM token to user doc', e);
    }
    return token;
  } catch (e) {
    console.error('Failed to get FCM token', e);
    return null;
  }
}

/** Listen for foreground messages. Returns an unsubscribe function. */
export async function listenForeground(cb: (payload: any) => void): Promise<() => void> {
  const msg = await getMsg();
  if (!msg) return () => {};
  return onMessage(msg, cb);
}

/** Remove a token from the user doc (e.g. on logout). */
export async function unregisterPushNotifications(userId: string, token: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), { fcmTokens: arrayRemove(token) });
  } catch (e) {
    console.warn('Could not remove FCM token', e);
  }
}

/** Probe: is FCM supported in this browser? */
export async function isPushSupported(): Promise<boolean> {
  try {
    if (typeof Notification === 'undefined') return false;
    return await isSupported();
  } catch { return false; }
}
