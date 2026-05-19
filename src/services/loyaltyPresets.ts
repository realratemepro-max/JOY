import { LoyaltyConfig, LoyaltyLevel, LoyaltyTheme, LoyaltyThemeBlock } from '../types';

export const LOYALTY_PRESETS: Record<Exclude<LoyaltyTheme, 'custom'>, { label: string; description: string; icon: string; levels: LoyaltyLevel[] }> = {
  chakras: {
    label: 'Chakras',
    description: '7 centros de energia — do enraizamento à iluminação',
    icon: '🧘',
    levels: [
      { name: 'Muladhara · Raiz', threshold: 0, color: '#C0392B', icon: '⚫', description: 'Estabilidade e segurança', motivation: 'Bem-vindo à tua jornada. Cada aula constrói raízes mais fortes.' },
      { name: 'Svadhishthana · Sacral', threshold: 10, color: '#E67E22', icon: '🔶', description: 'Criatividade e fluidez', motivation: 'Sentes a energia a fluir. Continua!' },
      { name: 'Manipura · Plexo Solar', threshold: 25, color: '#F1C40F', icon: '☀', description: 'Confiança e poder pessoal', motivation: 'O teu fogo interior está aceso.' },
      { name: 'Anahata · Coração', threshold: 50, color: '#27AE60', icon: '💚', description: 'Amor e compaixão', motivation: 'Praticas de coração aberto.' },
      { name: 'Vishuddha · Garganta', threshold: 100, color: '#3498DB', icon: '🔷', description: 'Verdade e expressão', motivation: 'Encontraste a tua voz autêntica.' },
      { name: 'Ajna · Terceiro Olho', threshold: 150, color: '#6C3483', icon: '👁', description: 'Intuição e clareza', motivation: 'A tua visão interior é cristalina.' },
      { name: 'Sahasrara · Coroa', threshold: 200, color: '#8E44AD', icon: '👑', description: 'Conexão e iluminação', motivation: 'Atingiste a coroa dos chakras. Namaste 🙏' },
    ],
  },
  lotus: {
    label: 'Lótus',
    description: 'O florescimento da prática, da semente à flor de mil pétalas',
    icon: '🪷',
    levels: [
      { name: 'Semente', threshold: 250, color: '#8B4513', icon: '🌰', description: 'Pronto para uma nova fase', motivation: 'Plantaste uma nova semente. Cuida dela.' },
      { name: 'Raiz', threshold: 300, color: '#5D4037', icon: '🌱', description: 'A enraizar-te mais fundo', motivation: 'As tuas raízes aprofundam-se.' },
      { name: 'Caule', threshold: 350, color: '#4CAF50', icon: '🎋', description: 'A crescer com força', motivation: 'O caule é firme e flexível.' },
      { name: 'Botão', threshold: 425, color: '#81C784', icon: '🌿', description: 'Prestes a florescer', motivation: 'Algo lindo está a abrir.' },
      { name: 'Meia-flor', threshold: 500, color: '#FFB6C1', icon: '🌸', description: 'Em plena abertura', motivation: 'Estás a abrir-te ao mundo.' },
      { name: 'Flor Aberta', threshold: 575, color: '#FF69B4', icon: '🌺', description: 'Beleza em pleno', motivation: 'A tua prática brilha.' },
      { name: 'Lótus Maduro', threshold: 650, color: '#FF1493', icon: '🪷', description: 'Maturidade plena', motivation: 'Atingiste profundidade.' },
      { name: 'Mil Pétalas', threshold: 750, color: '#C71585', icon: '✨', description: 'Iluminação plena', motivation: 'Mil pétalas abertas — Sahasrara renovado.' },
    ],
  },
  limbs: {
    label: '8 Membros do Yoga',
    description: 'Os 8 passos de Patanjali, do comportamento ético à união',
    icon: '🕉',
    levels: [
      { name: 'Yamas', threshold: 800, color: '#90A4AE', icon: '①', description: 'Princípios éticos', motivation: 'Os fundamentos da jornada profunda.' },
      { name: 'Niyamas', threshold: 950, color: '#78909C', icon: '②', description: 'Disciplinas pessoais', motivation: 'A disciplina cria liberdade.' },
      { name: 'Asanas', threshold: 1100, color: '#FF9800', icon: '③', description: 'Posturas físicas', motivation: 'O corpo é o teu templo.' },
      { name: 'Pranayama', threshold: 1300, color: '#00BCD4', icon: '④', description: 'Controlo da respiração', motivation: 'A respiração é a chave.' },
      { name: 'Pratyahara', threshold: 1500, color: '#2196F3', icon: '⑤', description: 'Retirada dos sentidos', motivation: 'O silêncio interior abre-se.' },
      { name: 'Dharana', threshold: 1700, color: '#3F51B5', icon: '⑥', description: 'Concentração', motivation: 'Foco como uma chama firme.' },
      { name: 'Dhyana', threshold: 1850, color: '#673AB7', icon: '⑦', description: 'Meditação', motivation: 'A mente flui em meditação contínua.' },
      { name: 'Samadhi', threshold: 2000, color: '#9C27B0', icon: '⑧', description: 'União', motivation: 'Atingiste a união. Namaste 🙏' },
    ],
  },
};

/** Default journey: 3 themes stacked (chakras → lotus → 8 limbs). */
export const DEFAULT_THEMES: LoyaltyThemeBlock[] = [
  { id: 'chakras', name: LOYALTY_PRESETS.chakras.label, theme: 'chakras', icon: LOYALTY_PRESETS.chakras.icon, description: LOYALTY_PRESETS.chakras.description, levels: LOYALTY_PRESETS.chakras.levels },
  { id: 'lotus',   name: LOYALTY_PRESETS.lotus.label,   theme: 'lotus',   icon: LOYALTY_PRESETS.lotus.icon,   description: LOYALTY_PRESETS.lotus.description,   levels: LOYALTY_PRESETS.lotus.levels },
  { id: 'limbs',   name: LOYALTY_PRESETS.limbs.label,   theme: 'limbs',   icon: LOYALTY_PRESETS.limbs.icon,   description: LOYALTY_PRESETS.limbs.description,   levels: LOYALTY_PRESETS.limbs.levels },
];

export const DEFAULT_LOYALTY: LoyaltyConfig = {
  enabled: true,
  themes: DEFAULT_THEMES,
  decayDaysWarning: 30,
  decayDaysInactive: 90,
};

/** Migrates legacy single-theme config → multi-theme. Non-destructive. */
export function normaliseLoyaltyConfig(cfg?: LoyaltyConfig | null): LoyaltyConfig {
  if (!cfg) return DEFAULT_LOYALTY;
  if (cfg.themes && cfg.themes.length > 0) {
    return {
      enabled: cfg.enabled !== false,
      themes: cfg.themes,
      decayDaysWarning: cfg.decayDaysWarning ?? 30,
      decayDaysInactive: cfg.decayDaysInactive ?? 90,
    };
  }
  // Legacy single theme → wrap into one block
  if (cfg.levels && cfg.levels.length > 0) {
    const presetKey = (cfg.theme && cfg.theme !== 'custom' ? cfg.theme : 'chakras') as Exclude<LoyaltyTheme, 'custom'>;
    const preset = LOYALTY_PRESETS[presetKey];
    return {
      enabled: cfg.enabled !== false,
      themes: [{
        id: cfg.theme || 'custom',
        name: preset?.label || 'Programa',
        theme: cfg.theme || 'custom',
        icon: preset?.icon,
        description: preset?.description,
        levels: cfg.levels,
      }],
      decayDaysWarning: 30,
      decayDaysInactive: 90,
    };
  }
  return DEFAULT_LOYALTY;
}

/** Returns the current level (last one whose threshold <= attendances) and the next level (or null). */
export function getCurrentLevel(attendances: number, levels: LoyaltyLevel[]): { current: LoyaltyLevel | null; next: LoyaltyLevel | null; index: number } {
  if (!levels || levels.length === 0) return { current: null, next: null, index: -1 };
  const sorted = [...levels].sort((a, b) => a.threshold - b.threshold);
  let current: LoyaltyLevel | null = null;
  let currentIdx = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (attendances >= sorted[i].threshold) { current = sorted[i]; currentIdx = i; }
    else break;
  }
  const next = currentIdx + 1 < sorted.length ? sorted[currentIdx + 1] : null;
  return { current, next, index: currentIdx };
}

/**
 * Across all themes, find what the student has earned vs what's next.
 * Each level in each theme is independent — a level is "earned" if attendances >= threshold.
 * Returns:
 *  - per theme: status (locked|inProgress|complete), earnedCount, totalCount
 *  - currentLevel: the highest-threshold level earned across all themes (drives the hero card)
 *  - nextLevel: the lowest-threshold level not yet earned across all themes
 */
export interface ThemeProgress {
  block: LoyaltyThemeBlock;
  status: 'locked' | 'inProgress' | 'complete';
  earnedCount: number;
  totalCount: number;
  themeStartThreshold: number;   // first level's threshold within this theme
  themeEndThreshold: number;     // last level's threshold within this theme
}

export interface JourneyProgress {
  themes: ThemeProgress[];
  currentLevel: LoyaltyLevel | null;
  currentThemeBlock: LoyaltyThemeBlock | null;
  currentLevelIndexInTheme: number;       // 0-based within its theme
  nextLevel: LoyaltyLevel | null;
  nextThemeBlock: LoyaltyThemeBlock | null;
  toNextLevel: number;
  earnedTotal: number;                    // total levels earned across all themes
  totalLevels: number;                    // sum of levels across all themes
}

export function computeJourney(attendances: number, themes: LoyaltyThemeBlock[]): JourneyProgress {
  const themeProgress: ThemeProgress[] = [];
  let currentLevel: LoyaltyLevel | null = null;
  let currentThemeBlock: LoyaltyThemeBlock | null = null;
  let currentLevelIndexInTheme = -1;
  let nextLevel: LoyaltyLevel | null = null;
  let nextThemeBlock: LoyaltyThemeBlock | null = null;
  let earnedTotal = 0;
  let totalLevels = 0;

  for (const t of themes) {
    const sortedLevels = [...t.levels].sort((a, b) => a.threshold - b.threshold);
    totalLevels += sortedLevels.length;
    let earnedInTheme = 0;

    for (let i = 0; i < sortedLevels.length; i++) {
      const lvl = sortedLevels[i];
      if (attendances >= lvl.threshold) {
        earnedInTheme++;
        earnedTotal++;
        // Track highest-threshold earned across whole journey
        if (!currentLevel || lvl.threshold >= currentLevel.threshold) {
          currentLevel = lvl;
          currentThemeBlock = t;
          currentLevelIndexInTheme = i;
        }
      } else if (!nextLevel) {
        nextLevel = lvl;
        nextThemeBlock = t;
      }
    }

    const status: ThemeProgress['status'] = earnedInTheme === 0 ? 'locked' : earnedInTheme === sortedLevels.length ? 'complete' : 'inProgress';
    themeProgress.push({
      block: t,
      status,
      earnedCount: earnedInTheme,
      totalCount: sortedLevels.length,
      themeStartThreshold: sortedLevels[0]?.threshold ?? 0,
      themeEndThreshold: sortedLevels[sortedLevels.length - 1]?.threshold ?? 0,
    });
  }

  const toNextLevel = nextLevel ? Math.max(0, nextLevel.threshold - attendances) : 0;

  return {
    themes: themeProgress,
    currentLevel,
    currentThemeBlock,
    currentLevelIndexInTheme,
    nextLevel,
    nextThemeBlock,
    toNextLevel,
    earnedTotal,
    totalLevels,
  };
}

/** Status of a student based on days since last attended class. */
export type ActivityStatus = 'active' | 'paused' | 'inactive' | 'never';

export function getActivityStatus(
  lastAttendanceAt: Date | null | undefined,
  warningDays = 30,
  inactiveDays = 90
): { status: ActivityStatus; daysSince: number | null } {
  if (!lastAttendanceAt) return { status: 'never', daysSince: null };
  const last = lastAttendanceAt instanceof Date ? lastAttendanceAt : new Date(lastAttendanceAt);
  const diffMs = Date.now() - last.getTime();
  const days = Math.floor(diffMs / (24 * 3600 * 1000));
  if (days < warningDays) return { status: 'active', daysSince: days };
  if (days < inactiveDays) return { status: 'paused', daysSince: days };
  return { status: 'inactive', daysSince: days };
}

/** Visual opacity & filter factor per status (CSS filter string). */
export function getStatusVisual(status: ActivityStatus): { opacity: number; filter: string; label: string; color: string } {
  switch (status) {
    case 'active':   return { opacity: 1,    filter: 'none',                       label: 'Ativo',     color: '#10b981' };
    case 'paused':   return { opacity: 0.6,  filter: 'grayscale(40%) brightness(0.95)', label: 'Em pausa', color: '#f59e0b' };
    case 'inactive': return { opacity: 0.4,  filter: 'grayscale(100%)',            label: 'Inativo',   color: '#9ca3af' };
    case 'never':    return { opacity: 1,    filter: 'none',                       label: 'Primeira aula',  color: '#7c9a72' };
  }
}
