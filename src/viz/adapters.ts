import type { Question, Results } from '../../shared/protocol';
import { AWESOME, OPTION_COLORS, PALETTE } from '../../shared/constants';

export type Size = 'sm' | 'lg';

export interface Item {
  key: string;
  label: string;
  count: number;
  color: string;
  highlight?: boolean;
}

type Of<K extends Results['kind']> = Extract<Results, { kind: K }>;

export const EASE = 'cubic-bezier(.2,.8,.2,1)';
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// FNV-1a 32-bit over UTF-16 code units: deterministic colours, tilts and lanes.
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function choiceItems(q: Question, r: Of<'choice'>, revealed: boolean): Item[] {
  return q.options.map((label, i) => ({
    key: String(i),
    label,
    count: r.counts[i] ?? 0,
    color: OPTION_COLORS[i % OPTION_COLORS.length],
    highlight: revealed && q.type === 'quiz' ? i === q.correct : undefined,
  }));
}

export function wordItems(r: Of<'words'>): Item[] {
  return r.words.map((w) => ({ key: w.text, label: w.text, count: w.count, color: PALETTE[hash(w.text) % PALETTE.length] }));
}

export function scaleItems(q: Question, r: Of<'scale'>): Item[] {
  const n = r.counts.length;
  return r.counts.map((count, i) => {
    const level = q.type === 'awesome' ? AWESOME[i] : undefined;
    return {
      key: String(q.min + i),
      label: level ? `${level.emoji} ${level.label}` : String(q.min + i),
      count,
      color: level?.color ?? `hsl(${n > 1 ? Math.round((i / (n - 1)) * 120) : 60} 75% 50%)`, // red → green
    };
  });
}

export function numberBins(q: Question, r: Of<'numbers'>): Item[] {
  const step = (q.max - q.min) / 10;
  const counts = Array.from({ length: 10 }, () => 0);
  for (const v of r.values) counts[Math.min(9, Math.max(0, Math.floor((v - q.min) / step)))]++;
  return counts.map((count, i) => {
    const start = q.min + i * step;
    return {
      key: String(i),
      label: (step >= 1 ? Math.round(start) : Math.round(start * 100) / 100).toLocaleString('en-IN'),
      count,
      color: '#FF9933',
    };
  });
}
