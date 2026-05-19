/**
 * Shared PWA install state. The `beforeinstallprompt` event fires once globally —
 * we capture it module-level so banner + sidebar button can both react.
 */
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Platform = 'ios' | 'android' | 'desktop' | 'unsupported';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

function notify() { subscribers.forEach(fn => fn()); }

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'unsupported';
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  if (isIOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window.navigator as any).standalone === true) return true;
  return window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/**
 * Hook that exposes whether the app can be installed and a trigger function.
 * - iOS: always returns canInstall=true (unless already installed) — install() opens manual instructions modal.
 * - Android/desktop: canInstall=true only after the browser fires beforeinstallprompt.
 */
export function useInstallPrompt() {
  const platform = detectPlatform();
  const installed = isStandalone();
  const [, force] = useState(0);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    const tick = () => force(x => x + 1);
    subscribers.add(tick);
    return () => { subscribers.delete(tick); };
  }, []);

  const hasDeferred = deferredPrompt !== null;
  const canInstall = !installed && (platform === 'ios' || hasDeferred);

  const install = async (): Promise<'installed' | 'dismissed' | 'ios-modal' | 'unavailable'> => {
    if (installed) return 'installed';
    if (platform === 'ios') {
      setShowIosModal(true);
      return 'ios-modal';
    }
    if (!deferredPrompt) return 'unavailable';
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        deferredPrompt = null;
        notify();
        return 'installed';
      }
      return 'dismissed';
    } catch {
      return 'dismissed';
    }
  };

  return {
    platform,
    installed,
    canInstall,
    install,
    showIosModal,
    closeIosModal: () => setShowIosModal(false),
  };
}
