import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'joy_cookie_consent_v1';

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setShow(true);
    } catch {
      // localStorage may be blocked — fail silently, don't show banner
    }
  }, []);

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, at: new Date().toISOString() })); } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Aviso de cookies">
      <div className="cookie-content">
        <div className="cookie-icon"><Cookie size={20} /></div>
        <p className="cookie-text">
          Usamos apenas cookies técnicos essenciais (autenticação) — não rastreamos para marketing.
          {' '}<Link to="/privacidade" className="cookie-link">Saber mais</Link>
        </p>
        <div className="cookie-actions">
          <button className="cookie-btn-accept" onClick={accept}>Entendi</button>
          <button className="cookie-btn-close" onClick={accept} aria-label="Fechar"><X size={16} /></button>
        </div>
      </div>

      <style>{`
        .cookie-banner {
          position: fixed;
          bottom: 1rem;
          left: 1rem;
          right: 1rem;
          z-index: 1500;
          max-width: 720px;
          margin: 0 auto;
          background: var(--gray-900, #1a1a1a);
          color: rgba(255,255,255,0.9);
          border-radius: var(--radius-xl, 16px);
          box-shadow: 0 10px 40px rgba(0,0,0,0.25);
          animation: cookie-slide-up 0.3s ease-out;
        }
        @keyframes cookie-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cookie-content {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 0.875rem 1.25rem;
          flex-wrap: wrap;
        }
        .cookie-icon {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          background: rgba(255,255,255,0.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f5d97f;
        }
        .cookie-text {
          flex: 1;
          min-width: 240px;
          margin: 0;
          font-size: 0.875rem;
          line-height: 1.5;
        }
        .cookie-link {
          color: #f5d97f;
          text-decoration: underline;
        }
        .cookie-link:hover {
          color: white;
        }
        .cookie-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        .cookie-btn-accept {
          background: white;
          color: #1a1a1a;
          border: none;
          font-weight: 600;
          font-size: 0.875rem;
          padding: 0.5rem 1.25rem;
          border-radius: 999px;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .cookie-btn-accept:hover {
          opacity: 0.85;
        }
        .cookie-btn-close {
          background: none;
          border: none;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          padding: 0.375rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s, background 0.2s;
        }
        .cookie-btn-close:hover {
          color: white;
          background: rgba(255,255,255,0.1);
        }
        @media (max-width: 640px) {
          .cookie-banner { left: 0.5rem; right: 0.5rem; bottom: 0.5rem; }
          .cookie-content { padding: 0.75rem 1rem; }
          .cookie-text { font-size: 0.8125rem; }
        }
      `}</style>
    </div>
  );
}
