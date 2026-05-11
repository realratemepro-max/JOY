import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isPushSupported, registerPushNotifications } from '../services/messaging';
import { Bell, X } from 'lucide-react';

const STORAGE_KEY_DISMISSED = 'joy_push_prompt_dismissed_v1';

/**
 * Asks the logged-in user once if they want push notifications. If yes, registers FCM token.
 * If user already granted/denied at the browser level, we skip the prompt.
 * Dismissible — won't ask again for 30 days.
 */
export function PushPermissionPrompt() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      // Check support
      if (!(await isPushSupported())) return;
      // Already granted? Auto-register silently and don't show prompt
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        await registerPushNotifications(user.uid).catch(() => {});
        return;
      }
      // Already denied at browser level? Don't ask
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return;
      // User dismissed recently?
      try {
        const dismissed = localStorage.getItem(STORAGE_KEY_DISMISSED);
        if (dismissed) {
          const ts = parseInt(dismissed, 10);
          if (!Number.isNaN(ts) && Date.now() - ts < 30 * 24 * 3600 * 1000) return;
        }
      } catch {/* ignore */}
      if (!cancelled) {
        // Wait a bit before showing so it doesn't appear instantly
        setTimeout(() => { if (!cancelled) setShow(true); }, 4000);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const accept = async () => {
    if (!user) return;
    setRequesting(true);
    try {
      const token = await registerPushNotifications(user.uid);
      if (token) {
        setShow(false);
      } else {
        // Permission denied or unsupported — close prompt and remember dismissal
        try { localStorage.setItem(STORAGE_KEY_DISMISSED, String(Date.now())); } catch {}
        setShow(false);
      }
    } finally {
      setRequesting(false);
    }
  };

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY_DISMISSED, String(Date.now())); } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="push-prompt" role="dialog">
      <div className="push-prompt-icon"><Bell size={22} /></div>
      <div className="push-prompt-body">
        <strong>Ativar notificações?</strong>
        <p>Sê notificado quando o estúdio cancela uma aula, há nova mensagem ou subes de nível.</p>
      </div>
      <div className="push-prompt-actions">
        <button className="push-prompt-skip" onClick={dismiss}>Mais tarde</button>
        <button className="push-prompt-accept" onClick={accept} disabled={requesting}>
          {requesting ? 'A pedir...' : 'Ativar'}
        </button>
      </div>
      <button className="push-prompt-close" onClick={dismiss} aria-label="Fechar"><X size={14} /></button>

      <style>{`
        .push-prompt { position: fixed; bottom: 1.25rem; left: 1.25rem; right: 1.25rem; max-width: 420px; margin: 0 auto; background: white; border-radius: var(--radius-xl, 16px); box-shadow: 0 12px 40px rgba(0,0,0,0.15); padding: 0.875rem 1rem; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.75rem; z-index: 1900; border: 1px solid var(--sand, #ddd); animation: push-prompt-slide 0.3s ease-out; }
        @keyframes push-prompt-slide { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .push-prompt-icon { width: 40px; height: 40px; border-radius: 50%; background: rgba(124,154,114,0.12); color: var(--primary, #7c9a72); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .push-prompt-body { min-width: 0; }
        .push-prompt-body strong { display: block; font-size: 0.9375rem; }
        .push-prompt-body p { margin: 0.125rem 0 0; font-size: 0.8125rem; color: var(--text-secondary, #555); line-height: 1.35; }
        .push-prompt-actions { display: flex; gap: 0.4rem; flex-shrink: 0; }
        .push-prompt-skip { background: none; border: 1.5px solid var(--sand, #ddd); border-radius: var(--radius-md, 8px); padding: 0.4rem 0.75rem; cursor: pointer; font-size: 0.8125rem; color: var(--text-secondary, #555); }
        .push-prompt-accept { background: var(--primary, #7c9a72); color: white; border: none; border-radius: var(--radius-md, 8px); padding: 0.4rem 0.875rem; cursor: pointer; font-size: 0.8125rem; font-weight: 600; }
        .push-prompt-accept:hover { background: var(--primary-dark, #5d7855); }
        .push-prompt-close { background: none; border: none; cursor: pointer; padding: 0.25rem; color: var(--text-muted, #999); position: absolute; top: 0.5rem; right: 0.5rem; display: none; }
        @media (max-width: 640px) {
          .push-prompt { grid-template-columns: auto 1fr; padding: 1rem; }
          .push-prompt-actions { grid-column: 1 / -1; justify-content: flex-end; }
        }
      `}</style>
    </div>
  );
}
