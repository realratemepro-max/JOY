import { LoyaltyConfig, LoyaltyLevel, LoyaltyTheme } from '../types';

export const LOYALTY_PRESETS: Record<Exclude<LoyaltyTheme, 'custom'>, { label: string; description: string; icon: string; levels: LoyaltyLevel[] }> = {
  chakras: {
    label: 'Chakras',
    description: '7 centros de energia — do enraizamento à iluminação',
    icon: '🧘',
    levels: [
      { name: 'Muladhara · Raiz', threshold: 0, color: '#C0392B', icon: '⚫', description: 'Estabilidade e segurança', motivation: 'Bem-vindo à tua jornada. Cada aula constrói raízes mais fortes.' },
      { name: 'Svadhishthana · Sacral', threshold: 5, color: '#E67E22', icon: '🔶', description: 'Criatividade e fluidez', motivation: 'Sentes a energia a fluir. Continua!' },
      { name: 'Manipura · Plexo Solar', threshold: 12, color: '#F1C40F', icon: '☀', description: 'Confiança e poder pessoal', motivation: 'O teu fogo interior está aceso.' },
      { name: 'Anahata · Coração', threshold: 25, color: '#27AE60', icon: '💚', description: 'Amor e compaixão', motivation: 'Praticas de coração aberto.' },
      { name: 'Vishuddha · Garganta', threshold: 40, color: '#3498DB', icon: '🔷', description: 'Verdade e expressão', motivation: 'Encontraste a tua voz autêntica.' },
      { name: 'Ajna · Terceiro Olho', threshold: 60, color: '#6C3483', icon: '👁', description: 'Intuição e clareza', motivation: 'A tua visão interior é cristalina.' },
      { name: 'Sahasrara · Coroa', threshold: 100, color: '#8E44AD', icon: '👑', description: 'Conexão e iluminação', motivation: 'Atingiste o ápice da prática. Namaste 🙏' },
    ],
  },
  lotus: {
    label: 'Lótus',
    description: 'O florescimento da prática, da semente à flor de mil pétalas',
    icon: '🪷',
    levels: [
      { name: 'Semente', threshold: 0, color: '#8B4513', icon: '🌰', description: 'O início de tudo', motivation: 'Plantaste a semente. Cuida dela.' },
      { name: 'Raiz', threshold: 5, color: '#5D4037', icon: '🌱', description: 'Estás a enraizar-te', motivation: 'As tuas raízes estão a aprofundar-se.' },
      { name: 'Caule', threshold: 12, color: '#4CAF50', icon: '🎋', description: 'A crescer com força', motivation: 'O caule é firme e flexível, como tu.' },
      { name: 'Botão', threshold: 25, color: '#81C784', icon: '🌿', description: 'Prestes a florescer', motivation: 'Sentes que algo lindo está a abrir.' },
      { name: 'Meia-flor', threshold: 40, color: '#FFB6C1', icon: '🌸', description: 'Em plena abertura', motivation: 'Estás a abrir-te ao mundo.' },
      { name: 'Flor Aberta', threshold: 60, color: '#FF69B4', icon: '🌺', description: 'Beleza em pleno', motivation: 'A tua prática brilha.' },
      { name: 'Lótus de Mil Pétalas', threshold: 100, color: '#FF1493', icon: '🪷', description: 'Iluminação plena', motivation: 'Mil pétalas abertas — Sahasrara.' },
    ],
  },
  limbs: {
    label: '8 Membros do Yoga',
    description: 'Os 8 passos de Patanjali, do comportamento ético à união',
    icon: '🕉',
    levels: [
      { name: 'Yamas', threshold: 0, color: '#90A4AE', icon: '①', description: 'Princípios éticos', motivation: 'Começa pelos fundamentos.' },
      { name: 'Niyamas', threshold: 5, color: '#78909C', icon: '②', description: 'Disciplinas pessoais', motivation: 'A disciplina cria liberdade.' },
      { name: 'Asanas', threshold: 12, color: '#FF9800', icon: '③', description: 'Posturas físicas', motivation: 'O corpo é o teu templo.' },
      { name: 'Pranayama', threshold: 25, color: '#00BCD4', icon: '④', description: 'Controlo da respiração', motivation: 'A respiração é a chave.' },
      { name: 'Pratyahara', threshold: 40, color: '#2196F3', icon: '⑤', description: 'Retirada dos sentidos', motivation: 'O silêncio interior abre-se.' },
      { name: 'Dharana', threshold: 60, color: '#3F51B5', icon: '⑥', description: 'Concentração', motivation: 'Foco como uma chama firme.' },
      { name: 'Dhyana', threshold: 80, color: '#673AB7', icon: '⑦', description: 'Meditação', motivation: 'A mente flui em meditação contínua.' },
      { name: 'Samadhi', threshold: 120, color: '#9C27B0', icon: '⑧', description: 'União', motivation: 'Atingiste a união. Namaste 🙏' },
    ],
  },
  belts: {
    label: 'Cinturões',
    description: 'Estilo das artes marciais — progressão clara e tangível',
    icon: '🥋',
    levels: [
      { name: 'Branco', threshold: 0, color: '#ECEFF1', icon: '⬜', description: 'Iniciante — pureza e potencial', motivation: 'Toda a jornada começa com o primeiro passo.' },
      { name: 'Amarelo', threshold: 5, color: '#FBC02D', icon: '🟨', description: 'Os primeiros raios de sol', motivation: 'Estás a brilhar.' },
      { name: 'Laranja', threshold: 12, color: '#F57C00', icon: '🟧', description: 'Energia e determinação', motivation: 'Sentes-te mais forte.' },
      { name: 'Verde', threshold: 25, color: '#388E3C', icon: '🟩', description: 'Crescimento estável', motivation: 'Cresces em harmonia.' },
      { name: 'Castanho', threshold: 50, color: '#6D4C41', icon: '🟫', description: 'Maturidade', motivation: 'A tua prática está bem enraizada.' },
      { name: 'Preto', threshold: 100, color: '#212121', icon: '⬛', description: 'Mestria', motivation: 'Atingiste o cinturão preto. Mas a jornada continua.' },
    ],
  },
};

export const DEFAULT_LOYALTY: LoyaltyConfig = {
  enabled: true,
  theme: 'chakras',
  levels: LOYALTY_PRESETS.chakras.levels,
};

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
