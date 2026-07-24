export function levelFromXp(xp: number): number {
  return Math.max(1, 1 + Math.floor(Math.sqrt(Math.max(xp, 0)) / 20));
}

export function xpForLevel(level: number): number {
  const n = Math.max(level - 1, 0);
  return Math.floor(Math.pow(n * 20, 2));
}

export function xpProgress(xp: number): {
  level: number;
  intoLevel: number;
  span: number;
  percent: number;
  toNext: number;
} {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const span = Math.max(ceil - floor, 1);
  const intoLevel = Math.max(xp - floor, 0);
  const percent = Math.min(100, Math.round((intoLevel / span) * 100));
  return { level, intoLevel, span, percent, toNext: Math.max(ceil - xp, 0) };
}

export const TIER_COLORS: Record<string, { ring: string; text: string; glow: string; label: string }> = {
  bronze: { ring: 'ring-amber-700/60', text: 'text-amber-600', glow: 'shadow-amber-900/30', label: 'Bronz' },
  silver: { ring: 'ring-slate-400/60', text: 'text-slate-300', glow: 'shadow-slate-500/30', label: 'Gümüş' },
  gold: { ring: 'ring-yellow-400/70', text: 'text-yellow-400', glow: 'shadow-yellow-500/40', label: 'Altın' },
  platinum: { ring: 'ring-cyan-300/70', text: 'text-cyan-300', glow: 'shadow-cyan-400/40', label: 'Platin' },
  diamond: { ring: 'ring-teal-300/80', text: 'text-teal-200', glow: 'shadow-teal-300/50', label: 'Elmas' },
};
