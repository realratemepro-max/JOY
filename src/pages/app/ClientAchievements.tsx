import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { LoyaltyConfig } from '../../types';
import { getCurrentLevel, DEFAULT_LOYALTY } from '../../services/loyaltyPresets';
import { Award, Lock, Check, ArrowLeft, Sparkles } from 'lucide-react';

export function ClientAchievements() {
  const { user } = useAuth();
  const [loyalty, setLoyalty] = useState<LoyaltyConfig>(DEFAULT_LOYALTY);
  const [totalAttended, setTotalAttended] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    try {
      const [mainCfg, userDoc] = await Promise.all([
        getDoc(doc(db, 'siteConfig', 'main')),
        getDoc(doc(db, 'users', user!.uid)),
      ]);
      if (mainCfg.exists() && mainCfg.data().loyalty) setLoyalty(mainCfg.data().loyalty as LoyaltyConfig);
      if (userDoc.exists()) setTotalAttended(userDoc.data()?.totalAttendances || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  if (!loyalty.enabled || loyalty.levels.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'white', borderRadius: 'var(--radius-xl)' }}>
        <Award size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
        <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '1.25rem' }}>Programa de fidelidade desativado</h2>
        <p style={{ color: 'var(--text-secondary)' }}>O estúdio ainda não ativou o programa de níveis.</p>
      </div>
    );
  }

  const sortedLevels = [...loyalty.levels].sort((a, b) => a.threshold - b.threshold);
  const { current, next, index: currentIdx } = getCurrentLevel(totalAttended, sortedLevels);
  const currentThreshold = current?.threshold || 0;
  const nextThreshold = next?.threshold || currentThreshold;
  const span = Math.max(1, nextThreshold - currentThreshold);
  const progress = next ? Math.min(100, ((totalAttended - currentThreshold) / span) * 100) : 100;

  return (
    <div className="achievements-page">
      <Link to="/app" className="ach-back"><ArrowLeft size={16} /> Dashboard</Link>

      <div className="ach-hero" style={{ background: `linear-gradient(135deg, ${current?.color || '#7c9a72'}cc, ${current?.color || '#7c9a72'})` }}>
        <div className="ach-hero-icon">{current?.icon || '🌱'}</div>
        <div>
          <div className="ach-hero-meta">Nível {currentIdx + 1} de {sortedLevels.length}</div>
          <h1 className="ach-hero-name">{current?.name || 'Sem nível'}</h1>
          {current?.description && <p className="ach-hero-desc">{current.description}</p>}
        </div>
        <div className="ach-hero-count">
          <span className="ach-hero-num">{totalAttended}</span>
          <span className="ach-hero-label">aulas frequentadas</span>
        </div>
      </div>

      {next && (
        <div className="ach-progress-card">
          <div className="ach-progress-head">
            <span>Próximo: <strong>{next.name}</strong></span>
            <span>{Math.max(0, nextThreshold - totalAttended)} aulas</span>
          </div>
          <div className="ach-progress-bar">
            <div className="ach-progress-fill" style={{ width: `${progress}%`, background: next.color }} />
          </div>
          {next.description && <p className="ach-progress-hint">{next.description}</p>}
        </div>
      )}

      <h2 className="ach-section-title"><Sparkles size={18} /> Todos os níveis</h2>
      <div className="ach-grid">
        {sortedLevels.map((lvl, i) => {
          const unlocked = totalAttended >= lvl.threshold;
          const isCurrent = i === currentIdx;
          return (
            <div key={i} className={`ach-card ${unlocked ? 'unlocked' : 'locked'} ${isCurrent ? 'current' : ''}`} style={unlocked ? { borderColor: lvl.color } : {}}>
              <div className="ach-card-icon" style={unlocked ? { background: lvl.color } : {}}>
                {unlocked ? <span style={{ fontSize: '1.5rem' }}>{lvl.icon || '✓'}</span> : <Lock size={20} />}
              </div>
              <div className="ach-card-body">
                <div className="ach-card-num">Nível {i + 1}</div>
                <div className="ach-card-name">{unlocked ? lvl.name : '???'}</div>
                {unlocked && lvl.description && <p className="ach-card-desc">{lvl.description}</p>}
                <div className="ach-card-threshold">
                  {unlocked ? <Check size={12} /> : null}
                  {lvl.threshold === 0 ? 'Inicial' : `${lvl.threshold} aulas`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .achievements-page { max-width: 920px; margin: 0 auto; }
        .ach-back { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.875rem; color: var(--text-secondary); text-decoration: none; margin-bottom: 1.25rem; }
        .ach-back:hover { color: var(--primary); }

        .ach-hero { color: white; border-radius: var(--radius-xl); padding: 1.75rem; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 1.25rem; box-shadow: var(--shadow-lg); }
        .ach-hero-icon { font-size: 3rem; line-height: 1; }
        .ach-hero-meta { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85; }
        .ach-hero-name { margin: 0.25rem 0 0; font-family: var(--font-heading); font-size: 1.875rem; font-weight: 600; line-height: 1.1; }
        .ach-hero-desc { margin: 0.5rem 0 0; opacity: 0.85; font-size: 0.9375rem; }
        .ach-hero-count { text-align: right; }
        .ach-hero-num { font-family: var(--font-heading); font-size: 2.25rem; font-weight: 700; display: block; line-height: 1; }
        .ach-hero-label { font-size: 0.75rem; opacity: 0.8; }

        .ach-progress-card { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; margin-top: 1rem; box-shadow: var(--shadow-sm); }
        .ach-progress-head { display: flex; justify-content: space-between; font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem; }
        .ach-progress-bar { height: 10px; background: var(--bg-secondary); border-radius: 999px; overflow: hidden; }
        .ach-progress-fill { height: 100%; transition: width 0.6s ease; border-radius: 999px; }
        .ach-progress-hint { margin: 0.625rem 0 0; font-size: 0.8125rem; color: var(--text-muted); font-style: italic; }

        .ach-section-title { display: flex; align-items: center; gap: 0.4rem; font-family: var(--font-body); font-size: 1.0625rem; font-weight: 600; margin: 2rem 0 0.875rem; color: var(--text-primary); }

        .ach-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.875rem; }
        .ach-card { background: white; border-radius: var(--radius-lg); padding: 1rem; display: flex; gap: 0.875rem; align-items: flex-start; border: 2px solid transparent; transition: transform var(--transition-fast); }
        .ach-card.unlocked { box-shadow: var(--shadow-sm); }
        .ach-card.unlocked:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .ach-card.locked { opacity: 0.55; background: var(--bg-secondary); }
        .ach-card.current { box-shadow: 0 0 0 3px rgba(124,154,114,0.25); }

        .ach-card-icon { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: white; background: var(--text-muted); }
        .ach-card.locked .ach-card-icon { background: var(--text-muted); }

        .ach-card-body { flex: 1; min-width: 0; }
        .ach-card-num { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); font-weight: 600; }
        .ach-card-name { font-family: var(--font-body); font-size: 1rem; font-weight: 600; margin-top: 0.125rem; }
        .ach-card-desc { font-size: 0.8125rem; color: var(--text-secondary); margin: 0.375rem 0 0; line-height: 1.4; }
        .ach-card-threshold { display: inline-flex; align-items: center; gap: 0.25rem; margin-top: 0.5rem; padding: 0.15rem 0.5rem; background: var(--bg-secondary); border-radius: 999px; font-size: 0.6875rem; font-weight: 600; color: var(--text-secondary); }
        .ach-card.unlocked .ach-card-threshold { background: #d1fae5; color: #166534; }

        @media (max-width: 640px) {
          .ach-hero { grid-template-columns: 1fr; text-align: center; }
          .ach-hero-count { text-align: center; }
          .ach-hero-name { font-size: 1.5rem; }
        }
      `}</style>
    </div>
  );
}
