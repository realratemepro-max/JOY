import React, { createContext, useCallback, useContext, useState } from 'react';
import { Check, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback so components don't crash when rendered outside provider — fall back to alerts
    return {
      toast: (m) => alert(m),
      success: (m) => console.log('✅', m),
      error: (m) => console.error('❌', m),
      warning: (m) => console.warn('⚠️', m),
      info: (m) => console.log('ℹ️', m),
    };
  }
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4500);
  }, [dismiss]);

  const value: ToastContextValue = {
    toast: push,
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    warning: (m) => push(m, 'warning'),
    info: (m) => push(m, 'info'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
            {t.type === 'success' && <Check size={16} />}
            {t.type === 'error' && <AlertTriangle size={16} />}
            {t.type === 'warning' && <AlertTriangle size={16} />}
            {t.type === 'info' && <Info size={16} />}
            <span className="toast-msg">{t.message}</span>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Fechar"><X size={14} /></button>
          </div>
        ))}
      </div>
      <style>{`
        .toast-stack { position: fixed; top: 1rem; right: 1rem; display: flex; flex-direction: column; gap: 0.5rem; z-index: 4000; max-width: 420px; }
        .toast { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 0.625rem 0.75rem 0.875rem; border-radius: var(--radius-lg, 12px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); font-size: 0.875rem; font-weight: 500; animation: toast-slide-in 0.25s ease-out; min-width: 260px; max-width: 100%; }
        @keyframes toast-slide-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .toast-msg { flex: 1; line-height: 1.4; }
        .toast-close { background: none; border: none; cursor: pointer; padding: 0.25rem; opacity: 0.6; display: flex; }
        .toast-close:hover { opacity: 1; }
        .toast-success { background: white; color: #166534; border-left: 4px solid #16a34a; }
        .toast-success svg:first-child { color: #16a34a; }
        .toast-error { background: white; color: #991b1b; border-left: 4px solid #dc2626; }
        .toast-error svg:first-child { color: #dc2626; }
        .toast-warning { background: white; color: #92400e; border-left: 4px solid #f59e0b; }
        .toast-warning svg:first-child { color: #f59e0b; }
        .toast-info { background: white; color: var(--text-primary, #1a1a1a); border-left: 4px solid var(--primary, #7c9a72); }
        .toast-info svg:first-child { color: var(--primary, #7c9a72); }
        @media (max-width: 640px) { .toast-stack { left: 0.5rem; right: 0.5rem; max-width: none; } }
      `}</style>
    </ToastContext.Provider>
  );
}
