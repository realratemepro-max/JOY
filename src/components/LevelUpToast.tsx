import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { LoyaltyConfig, LoyaltyLevel } from '../types';
import { computeJourney, normaliseLoyaltyConfig } from '../services/loyaltyPresets';
import { Trophy, X } from 'lucide-react';

/**
 * Detects when a client crosses a loyalty level threshold and shows a celebratory toast.
 * Compares current `totalAttendances` against `lastSeenLoyaltyThreshold` stored on the user doc.
 * After showing, updates `lastSeenLoyaltyThreshold` so the toast doesn't repeat.
 */
export function LevelUpToast() {
  const { user } = useAuth();
  const [shown, setShown] = useState<LoyaltyLevel | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [userDoc, mainCfg] = await Promise.all([
          getDoc(doc(db, 'users', user.uid)),
          getDoc(doc(db, 'siteConfig', 'main')),
        ]);
        if (cancelled) return;
        if (!userDoc.exists() || !mainCfg.exists()) return;
        const raw = mainCfg.data().loyalty as LoyaltyConfig | undefined;
        const loyalty = normaliseLoyaltyConfig(raw);
        if (!loyalty.enabled || !(loyalty.themes || []).length) return;

        const totalAttendances = userDoc.data()?.totalAttendances || 0;
        const lastSeen = userDoc.data()?.lastSeenLoyaltyThreshold ?? -1;
        const { currentLevel } = computeJourney(totalAttendances, loyalty.themes || []);
        if (!currentLevel) return;

        if (currentLevel.threshold > lastSeen) {
          setShown(currentLevel);
          // Mark as seen
          try {
            await updateDoc(doc(db, 'users', user.uid), { lastSeenLoyaltyThreshold: currentLevel.threshold });
          } catch (e) { /* non-blocking */ }
        }
      } catch (e) { console.warn('LevelUpToast check failed', e); }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!shown) return null;

  return (
    <div className="levelup-toast" role="status">
      <div className="levelup-icon" style={{ background: shown.color }}>
        <span style={{ fontSize: '1.75rem' }}>{shown.icon || '🎉'}</span>
      </div>
      <div className="levelup-body">
        <div className="levelup-meta">Subiste de nível!</div>
        <div className="levelup-name">{shown.name}</div>
        {shown.motivation && <p className="levelup-msg">{shown.motivation}</p>}
        <Link to="/app/conquistas" className="levelup-link" onClick={() => setShown(null)}>
          <Trophy size={14} /> Ver progresso
        </Link>
      </div>
      <button className="levelup-close" onClick={() => setShown(null)} aria-label="Fechar"><X size={16} /></button>

      <style>{`
        .levelup-toast {
          position: fixed;
          top: 1.5rem;
          right: 1.5rem;
          z-index: 2500;
          background: white;
          border-radius: var(--radius-xl);
          box-shadow: 0 16px 50px rgba(0,0,0,0.18);
          padding: 1rem 1.25rem 1rem 1rem;
          display: flex;
          gap: 0.875rem;
          align-items: flex-start;
          max-width: 380px;
          width: calc(100% - 2rem);
          animation: levelup-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes levelup-in {
          from { opacity: 0; transform: translateY(-20px) scale(0.92); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .levelup-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
          animation: levelup-pulse 1.6s ease-in-out infinite;
        }
        @keyframes levelup-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        .levelup-body { flex: 1; min-width: 0; }
        .levelup-meta { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--primary); font-weight: 700; }
        .levelup-name { font-family: var(--font-heading); font-size: 1.25rem; font-weight: 600; margin: 0.125rem 0 0; line-height: 1.15; }
        .levelup-msg { margin: 0.375rem 0 0.5rem; font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.45; }
        .levelup-link { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.8125rem; color: var(--primary); font-weight: 600; text-decoration: none; }
        .levelup-link:hover { text-decoration: underline; }
        .levelup-close {
          background: none; border: none; cursor: pointer; padding: 0.25rem;
          color: var(--text-muted); align-self: flex-start;
        }
        .levelup-close:hover { color: var(--text-primary); }
        @media (max-width: 640px) {
          .levelup-toast { left: 1rem; right: 1rem; top: 1rem; max-width: none; width: auto; }
        }
      `}</style>
    </div>
  );
}
