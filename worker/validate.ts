import type { AnswerValue, Display, Question, QuestionType } from '../shared/protocol';
import { ANIMALS, FORMATS, LIMITS, defaultQuestion } from '../shared/constants';

// Control chars, zero-width chars (except ZWJ U+200D used by emoji), bidi overrides, BOM.
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

export function clean(v: unknown): string {
  return typeof v === 'string' ? v.normalize('NFKC').replace(/\s+/g, ' ').replace(INVISIBLE, '').trim() : '';
}

export const len = (s: string) => Array.from(s).length;
export const cut = (s: string, n: number) => Array.from(s).slice(0, n).join('');

const int = (v: unknown, min: number, max: number, fallback: number) =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : fallback;
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export type NameResult = { ok: true; name: string; key: string; admin: boolean } | { ok: false; error: string };

export function parseName(raw: unknown, suffix: string): NameResult {
  const s = clean(raw);
  if (suffix && s.length > suffix.length && s.slice(-suffix.length).toLowerCase() === suffix.toLowerCase()) {
    return { ok: true, name: cut(s.slice(0, -suffix.length).trim() || 'Host', LIMITS.nameMax), key: '', admin: true };
  }
  const n = len(s);
  if (n < LIMITS.nameMin) return { ok: false, error: `Please enter at least ${LIMITS.nameMin} characters` };
  if (n > LIMITS.nameMax) return { ok: false, error: `Please keep it to ${LIMITS.nameMax} characters` };
  return { ok: true, name: s, key: s.toLowerCase(), admin: false };
}

export function parseAnswer(q: Question, raw: unknown): AnswerValue | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  switch (q.type) {
    case 'poll':
    case 'quiz':
    case 'animal':
      return Number.isInteger(o.choice) && (o.choice as number) >= 0 && (o.choice as number) < q.options.length
        ? { choice: o.choice as number }
        : null;
    case 'wordcloud':
    case 'open': {
      const text = clean(o.text);
      const max = q.type === 'wordcloud' ? LIMITS.word : LIMITS.text;
      return text && len(text) <= max ? { text } : null;
    }
    case 'scale':
    case 'awesome':
      return Number.isInteger(o.rating) && (o.rating as number) >= q.min && (o.rating as number) <= q.max
        ? { rating: o.rating as number }
        : null;
    case 'number':
      return typeof o.number === 'number' && Number.isFinite(o.number) && o.number >= q.min && o.number <= q.max
        ? { number: Math.round(o.number * 100) / 100 }
        : null;
  }
}

export function parseQuestion(raw: unknown): Question | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.type !== 'string' || !Object.hasOwn(FORMATS, o.type)) return null;
  const q = defaultQuestion(o.type as QuestionType);
  q.id = typeof o.id === 'string' && /^[a-z0-9]{1,16}$/.test(o.id) ? o.id : '';
  q.text = clean(o.text);
  if (!q.text || len(q.text) > LIMITS.question) return null;
  q.timer = int(o.timer, 0, 300, q.timer);

  if (q.type === 'poll' || q.type === 'quiz') {
    const opts = Array.isArray(o.options) ? o.options.map(clean) : [];
    if (opts.length < LIMITS.optionsMin || opts.length > LIMITS.optionsMax) return null;
    if (opts.some((x) => !x || len(x) > LIMITS.option)) return null;
    q.options = opts;
  }
  if (q.type === 'quiz') {
    if (!Number.isInteger(o.correct) || (o.correct as number) < 0 || (o.correct as number) >= q.options.length) return null;
    q.correct = o.correct as number;
  }
  if (q.type === 'animal') {
    const keys = Array.isArray(o.options) ? o.options.filter((k): k is string => typeof k === 'string' && Object.hasOwn(ANIMALS, k)) : [];
    q.options = [...new Set(keys)];
    if (q.options.length < LIMITS.optionsMin) return null;
  }
  if (q.type === 'quiz' || q.type === 'number') {
    q.points = o.points === 0 || o.points === 1 || o.points === 2 ? o.points : q.points;
  }
  if (q.type === 'wordcloud' || q.type === 'open') {
    q.maxEntries = int(o.maxEntries, 1, 3, q.maxEntries);
    q.moderate = o.moderate === true;
  }
  if (q.type === 'scale') {
    q.min = int(o.min, 0, 1, q.min);
    q.max = int(o.max, q.min + 2, 10, q.max);
    q.minLabel = cut(clean(o.minLabel), LIMITS.label);
    q.maxLabel = cut(clean(o.maxLabel), LIMITS.label);
  }
  if (q.type === 'number') {
    q.min = num(o.min, q.min);
    q.max = num(o.max, q.max);
    if (q.max <= q.min) return null;
    q.unit = cut(clean(o.unit), LIMITS.unit);
    const c = o.correct;
    q.correct = typeof c === 'number' && Number.isFinite(c) && c >= q.min && c <= q.max ? c : null;
  }
  if (q.type === 'poll' || q.type === 'scale' || q.type === 'awesome') q.showOnPhones = o.showOnPhones !== false;

  const d = o.display as Display;
  if (FORMATS[q.type].includes(d) && !(d === 'versus' && q.options.length !== 2)) q.display = d;
  return q;
}
