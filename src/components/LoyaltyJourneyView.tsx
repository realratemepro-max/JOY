import React from 'react';
import { Lock, Check, Sparkles, AlertCircle } from 'lucide-react';
import { LoyaltyConfig, LoyaltyLevel, LoyaltyThemeBlock } from '../types';
import { computeJourney, getActivityStatus, getStatusVisual, normaliseLoyaltyConfig } from '../services/loyaltyPresets';

interface Props {
  totalAttended: number;
  lastAttendanceAt?: Date | null;
  loyalty: LoyaltyConfig;
  showName?: string;            // optional — admin preview shows student name
}

/**
 * Reusable journey view — shown to the client on /app/conquistas AND inside the
 * admin client detail (Conquistas tab). Same component, same numbers.
 */
export function LoyaltyJourneyView({ totalAttended, lastAttendanceAt, loyalty, showName }: Props) {
  const cfg = normaliseLoyaltyConfig(loyalty);
  const themes: LoyaltyThemeBlock[] = cfg.themes || [];

  if (!cfg.enabled || themes.length === 0 || themes.every(t => t.levels.length === 0)) {
    return (
      <div className="ljv-empty">
        <Sparkles size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
        <h3>Programa de fidelidade desativado</h3>
        <p>O estúdio ainda não ativou o programa de níveis.</p>
        <style>{styles}</style>
      </div>
    );
  }

  const journey = computeJourney(totalAttended, themes);
  const activity = getActivityStatus(
    lastAttendanceAt || null,
    cfg.decayDaysWarning ?? 30,
    cfg.decayDaysInactive ?? 90,
  );
  const visual = getStatusVisual(activity.status);

  const heroColor = journey.currentLevel?.color || '#7c9a72';
  const heroIcon = journey.currentLevel?.icon || journey.currentThemeBlock?.icon || '🌱';

  return (
    <div className="ljv">
      {showName && (
        <div className="ljv-name-banner">A ver a conta de <strong>{showName}</strong></div>
      )}

      {/* Hero card */}
      <div className="ljv-hero" style={{ background: `linear-gradient(135deg, ${heroColor}cc, ${heroColor})` }}>
        <div className="ljv-hero-icon" style={{ opacity: visual.opacity, filter: visual.filter }}>{heroIcon}</div>
        <div className="ljv-hero-info">
          <div className="ljv-hero-status" style={{ background: visual.color }}>
            {activity.status === 'active' && '● ATIVO'}
            {activity.status === 'paused' && '● EM PAUSA'}
            {activity.status === 'inactive' && '● INATIVO'}
            {activity.status === 'never' && '● PRIMEIRA AULA'}
            {activity.daysSince !== null && activity.status !== 'never' && (
              <span style={{ opacity: 0.9, fontWeight: 400, marginLeft: '0.5rem' }}>· {activity.daysSince}d sem aulas</span>
            )}
          </div>
          <div className="ljv-hero-meta">
            {journey.currentThemeBlock?.name || '—'}
            {journey.currentLevel ? ` · Nível ${journey.currentLevelIndexInTheme + 1} de ${journey.currentThemeBlock?.levels.length}` : ''}
          </div>
          <h2 className="ljv-hero-name">{journey.currentLevel?.name || 'Por desbloquear'}</h2>
          {journey.currentLevel?.description && <p className="ljv-hero-desc">{journey.currentLevel.description}</p>}
        </div>
        <div className="ljv-hero-count">
          <span className="ljv-hero-num">{totalAttended}</span>
          <span className="ljv-hero-label">aulas frequentadas</span>
        </div>
      </div>

      {/* Decay message */}
      {(activity.status === 'paused' || activity.status === 'inactive') && (
        <div className={`ljv-decay-msg ljv-decay-${activity.status}`}>
          <AlertCircle size={16} />
          {activity.status === 'paused' && (
            <span>Os teus selos estão a perder cor. <strong>Marca a tua próxima aula</strong> para os recuperar.</span>
          )}
          {activity.status === 'inactive' && (
            <span>Os teus selos esperam por ti. <strong>Volta à prática</strong> para os reativar.</span>
          )}
        </div>
      )}

      {/* Progress to next */}
      {journey.nextLevel && (
        <div className="ljv-progress-card">
          <div className="ljv-progress-head">
            <span>Próximo: <strong>{journey.nextLevel.name}</strong>
              {journey.nextThemeBlock && journey.nextThemeBlock !== journey.currentThemeBlock && (
                <em style={{ marginLeft: '0.4rem', color: 'var(--text-muted)', fontStyle: 'normal' }}>· {journey.nextThemeBlock.icon} {journey.nextThemeBlock.name}</em>
              )}
            </span>
            <span>{journey.toNextLevel} aulas</span>
          </div>
          <div className="ljv-progress-bar">
            <div
              className="ljv-progress-fill"
              style={{
                width: `${(() => {
                  // Find previous earned threshold as start
                  const prevT = journey.currentLevel?.threshold ?? 0;
                  const span = Math.max(1, journey.nextLevel.threshold - prevT);
                  const done = Math.max(0, Math.min(totalAttended - prevT, span));
                  return (done / span) * 100;
                })()}%`,
                background: journey.nextLevel.color,
              }}
            />
          </div>
          {journey.nextLevel.description && (
            <p className="ljv-progress-hint">{journey.nextLevel.description}</p>
          )}
        </div>
      )}

      {/* Themes journey */}
      <h3 className="ljv-section-title"><Sparkles size={18} /> A tua jornada</h3>
      {journey.themes.map(tp => (
        <ThemeSection
          key={tp.block.id}
          themeBlock={tp.block}
          status={tp.status}
          earnedCount={tp.earnedCount}
          totalAttended={totalAttended}
          visualFilter={visual.filter}
          visualOpacity={visual.opacity}
        />
      ))}

      <style>{styles}</style>
    </div>
  );
}

function ThemeSection({ themeBlock, status, earnedCount, totalAttended, visualFilter, visualOpacity }: {
  themeBlock: LoyaltyThemeBlock;
  status: 'locked' | 'inProgress' | 'complete';
  earnedCount: number;
  totalAttended: number;
  visualFilter: string;
  visualOpacity: number;
}) {
  const sorted = [...themeBlock.levels].sort((a, b) => a.threshold - b.threshold);
  const statusBadge = {
    locked:     { text: 'BLOQUEADO',    color: '#9ca3af', bg: '#f3f4f6' },
    inProgress: { text: 'EM PROGRESSO', color: '#1d4ed8', bg: '#dbeafe' },
    complete:   { text: 'COMPLETO ✓',   color: '#065f46', bg: '#d1fae5' },
  }[status];
  const firstThreshold = sorted[0]?.threshold ?? 0;
  const isThemeLocked = status === 'locked' && totalAttended < firstThreshold;

  return (
    <div className="ljv-theme">
      <div className="ljv-theme-head">
        <div className="ljv-theme-name">
          <span className="ljv-theme-icon">{themeBlock.icon || '✨'}</span>
          {themeBlock.name}
        </div>
        <span className="ljv-theme-badge" style={{ background: statusBadge.bg, color: statusBadge.color }}>
          {statusBadge.text}
        </span>
      </div>
      {themeBlock.description && <p className="ljv-theme-desc">{themeBlock.description}</p>}

      {isThemeLocked && (
        <p className="ljv-theme-locked-msg">
          🔒 Atinge <strong>{firstThreshold} aulas</strong> para desbloquear este tema.
        </p>
      )}

      <div className="ljv-grid">
        {sorted.map((lvl, i) => {
          const unlocked = totalAttended >= lvl.threshold;
          return (
            <div
              key={i}
              className={`ljv-card ${unlocked ? 'unlocked' : 'locked'}`}
              style={unlocked ? { borderColor: lvl.color, opacity: visualOpacity, filter: visualFilter } : {}}
            >
              <div className="ljv-card-icon" style={unlocked ? { background: lvl.color } : {}}>
                {unlocked ? <span style={{ fontSize: '1.5rem' }}>{lvl.icon || '✓'}</span> : <Lock size={20} />}
              </div>
              <div className="ljv-card-body">
                <div className="ljv-card-num">Nível {i + 1}</div>
                <div className="ljv-card-name">{unlocked ? lvl.name : '???'}</div>
                {unlocked && lvl.description && <p className="ljv-card-desc">{lvl.description}</p>}
                <div className="ljv-card-threshold">
                  {unlocked && <Check size={12} />}
                  {lvl.threshold === 0 ? 'Inicial' : `${lvl.threshold} aulas`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="ljv-theme-footer">
        {earnedCount} de {sorted.length} selos conquistados
      </div>
    </div>
  );
}

const styles = `
  .ljv-empty { text-align: center; padding: 3rem 1.5rem; background: white; border-radius: var(--radius-xl); }
  .ljv-empty h3 { font-family: var(--font-body); font-size: 1.25rem; margin: 0 0 0.5rem; }
  .ljv-empty p { color: var(--text-secondary); }
  .ljv-name-banner { background: rgba(124,154,114,0.08); border: 1px solid rgba(124,154,114,0.25); color: var(--primary-dark); border-radius: var(--radius-md); padding: 0.5rem 0.875rem; font-size: 0.875rem; margin-bottom: 1rem; }

  .ljv-hero { color: white; border-radius: var(--radius-xl); padding: 1.75rem; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 1.25rem; box-shadow: var(--shadow-lg); }
  .ljv-hero-icon { font-size: 3rem; line-height: 1; }
  .ljv-hero-info { min-width: 0; }
  .ljv-hero-status { display: inline-block; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.08em; padding: 0.2rem 0.55rem; border-radius: 999px; }
  .ljv-hero-meta { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.9; margin-top: 0.5rem; }
  .ljv-hero-name { margin: 0.25rem 0 0; font-family: var(--font-heading); font-size: 1.75rem; font-weight: 600; line-height: 1.1; }
  .ljv-hero-desc { margin: 0.5rem 0 0; opacity: 0.9; font-size: 0.9375rem; }
  .ljv-hero-count { text-align: right; }
  .ljv-hero-num { font-family: var(--font-heading); font-size: 2.25rem; font-weight: 700; display: block; line-height: 1; }
  .ljv-hero-label { font-size: 0.75rem; opacity: 0.8; }

  .ljv-decay-msg { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.875rem; padding: 0.625rem 0.875rem; border-radius: var(--radius-md); font-size: 0.875rem; }
  .ljv-decay-paused   { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
  .ljv-decay-inactive { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }

  .ljv-progress-card { background: white; border-radius: var(--radius-lg); padding: 1rem 1.25rem; margin-top: 1rem; box-shadow: var(--shadow-sm); }
  .ljv-progress-head { display: flex; justify-content: space-between; font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem; gap: 0.5rem; flex-wrap: wrap; }
  .ljv-progress-bar { height: 10px; background: var(--bg-secondary); border-radius: 999px; overflow: hidden; }
  .ljv-progress-fill { height: 100%; transition: width 0.6s ease; border-radius: 999px; }
  .ljv-progress-hint { margin: 0.625rem 0 0; font-size: 0.8125rem; color: var(--text-muted); font-style: italic; }

  .ljv-section-title { display: flex; align-items: center; gap: 0.4rem; font-family: var(--font-body); font-size: 1.0625rem; font-weight: 600; margin: 2rem 0 0.875rem; color: var(--text-primary); }

  .ljv-theme { background: white; border-radius: var(--radius-xl); padding: 1.25rem; margin-bottom: 1rem; box-shadow: var(--shadow-sm); }
  .ljv-theme-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; gap: 0.75rem; flex-wrap: wrap; }
  .ljv-theme-name { display: flex; align-items: center; gap: 0.5rem; font-family: var(--font-body); font-size: 1.0625rem; font-weight: 600; }
  .ljv-theme-icon { font-size: 1.25rem; }
  .ljv-theme-badge { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.04em; padding: 0.2rem 0.55rem; border-radius: 999px; }
  .ljv-theme-desc { margin: 0.25rem 0 0.75rem; color: var(--text-secondary); font-size: 0.875rem; }
  .ljv-theme-locked-msg { background: var(--bg-secondary); border: 1px dashed var(--sand); border-radius: var(--radius-md); padding: 0.625rem 0.875rem; font-size: 0.875rem; color: var(--text-secondary); margin: 0.25rem 0 0.875rem; }

  .ljv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; }
  .ljv-card { background: white; border-radius: var(--radius-lg); padding: 0.875rem; display: flex; gap: 0.75rem; align-items: flex-start; border: 2px solid transparent; transition: transform var(--transition-fast); }
  .ljv-card.unlocked { box-shadow: var(--shadow-sm); }
  .ljv-card.unlocked:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .ljv-card.locked { opacity: 0.55; background: var(--bg-secondary); }

  .ljv-card-icon { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: white; background: var(--text-muted); }
  .ljv-card-body { flex: 1; min-width: 0; }
  .ljv-card-num { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); font-weight: 600; }
  .ljv-card-name { font-family: var(--font-body); font-size: 0.9375rem; font-weight: 600; margin-top: 0.125rem; }
  .ljv-card-desc { font-size: 0.75rem; color: var(--text-secondary); margin: 0.375rem 0 0; line-height: 1.4; }
  .ljv-card-threshold { display: inline-flex; align-items: center; gap: 0.25rem; margin-top: 0.5rem; padding: 0.1rem 0.4rem; background: var(--bg-secondary); border-radius: 999px; font-size: 0.625rem; font-weight: 600; color: var(--text-secondary); }
  .ljv-card.unlocked .ljv-card-threshold { background: #d1fae5; color: #166534; }

  .ljv-theme-footer { margin-top: 0.875rem; padding-top: 0.5rem; border-top: 1px solid var(--beige); font-size: 0.75rem; color: var(--text-muted); text-align: right; }

  @media (max-width: 640px) {
    .ljv-hero { grid-template-columns: 1fr; text-align: center; }
    .ljv-hero-count { text-align: center; }
    .ljv-hero-name { font-size: 1.4rem; }
  }
`;
