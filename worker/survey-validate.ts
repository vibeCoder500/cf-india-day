import type { Display } from '../shared/protocol';
import type { SurveyAnswer, SurveyAnswers, SurveyDraft, SurveyQuestion, SurveyType } from '../shared/survey';
import { SURVEY_FORMATS, SURVEY_LIMITS, defaultSurveyQuestion } from '../shared/survey';
import { ANIMALS, LIMITS } from '../shared/constants';
import { clean, cut, len } from './validate';

const ID_RE = /^[a-z0-9]{1,16}$/;
const int = (v: unknown, min: number, max: number, fallback: number) =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : fallback;

export function parseSurveyQuestion(raw: unknown): SurveyQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.type !== 'string' || !Object.hasOwn(SURVEY_FORMATS, o.type)) return null;
  const q = defaultSurveyQuestion(o.type as SurveyType);
  q.id = typeof o.id === 'string' && ID_RE.test(o.id) ? o.id : '';
  q.text = clean(o.text);
  if (!q.text || len(q.text) > LIMITS.question) return null;
  q.hint = cut(clean(o.hint), SURVEY_LIMITS.hint);
  if (typeof o.required === 'boolean') q.required = o.required;

  if (q.type === 'poll' || q.type === 'multi') {
    const opts = Array.isArray(o.options) ? o.options.map(clean) : [];
    if (opts.length < LIMITS.optionsMin || opts.length > SURVEY_LIMITS.optionsMax) return null;
    if (opts.some((x) => !x || len(x) > SURVEY_LIMITS.option)) return null;
    q.options = opts;
  }
  if (q.type === 'multi') q.maxPicks = int(o.maxPicks, 2, q.options.length, Math.min(2, q.options.length));
  if (q.type === 'animal') {
    const keys = Array.isArray(o.options) ? o.options.filter((k): k is string => typeof k === 'string' && Object.hasOwn(ANIMALS, k)) : [];
    q.options = [...new Set(keys)];
    if (q.options.length < LIMITS.optionsMin) return null;
  }
  if (q.type === 'wordcloud') q.maxEntries = int(o.maxEntries, 1, 3, q.maxEntries);
  if (q.type === 'scale') {
    q.min = int(o.min, 0, 1, q.min);
    q.max = int(o.max, q.min + 2, 10, q.max);
    q.minLabel = cut(clean(o.minLabel), LIMITS.label);
    q.maxLabel = cut(clean(o.maxLabel), LIMITS.label);
  }
  const d = o.display as Display;
  if (SURVEY_FORMATS[q.type].includes(d) && !(d === 'versus' && q.options.length !== 2)) q.display = d;
  return q;
}

// All or nothing, so a save is never half-applied. Questions without a valid unique id get a fresh one.
export function parseSurveyDraft(raw: unknown, newId: () => string): SurveyDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const title = clean(o.title);
  if (!title || len(title) > SURVEY_LIMITS.title) return null;
  const list = Array.isArray(o.questions) ? o.questions : [];
  if (list.length > SURVEY_LIMITS.questions) return null;
  const questions: SurveyQuestion[] = [];
  const seen = new Set<string>();
  for (const r of list) {
    const q = parseSurveyQuestion(r);
    if (!q) return null;
    if (!q.id || seen.has(q.id)) q.id = newId();
    seen.add(q.id);
    questions.push(q);
  }
  if (questions.filter((q) => q.type === 'open').length > SURVEY_LIMITS.openQuestions) return null;
  return {
    id: typeof o.id === 'string' && ID_RE.test(o.id) ? o.id : '',
    title,
    intro: cut(clean(o.intro), SURVEY_LIMITS.intro),
    thanks: cut(clean(o.thanks), SURVEY_LIMITS.thanks),
    questions,
  };
}

// Text that is empty once cleaned counts as skipped, so stray invisible characters never block a submission.
type Parsed = SurveyAnswer | 'empty' | null;

function parseOne(q: SurveyQuestion, raw: unknown): Parsed {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  switch (q.type) {
    case 'poll':
    case 'animal':
      return Number.isInteger(o.choice) && (o.choice as number) >= 0 && (o.choice as number) < q.options.length
        ? { choice: o.choice as number }
        : null;
    case 'multi': {
      const c = o.choices;
      if (!Array.isArray(c) || c.length < 1 || c.length > q.maxPicks) return null;
      if (!c.every((i) => Number.isInteger(i) && i >= 0 && i < q.options.length)) return null;
      const picks = [...new Set(c as number[])].sort((a, b) => a - b);
      return picks.length === c.length ? { choices: picks } : null;
    }
    case 'scale':
    case 'awesome':
      return Number.isInteger(o.rating) && (o.rating as number) >= q.min && (o.rating as number) <= q.max
        ? { rating: o.rating as number }
        : null;
    case 'wordcloud': {
      if (!Array.isArray(o.texts) || o.texts.length > q.maxEntries) return null;
      const seen = new Set<string>();
      const texts: string[] = [];
      for (const t of o.texts.map(clean)) {
        if (len(t) > LIMITS.word) return null;
        if (!t || seen.has(t.toLowerCase())) continue;
        seen.add(t.toLowerCase());
        texts.push(t);
      }
      return texts.length > 0 ? { texts } : 'empty';
    }
    case 'open': {
      const text = clean(o.text);
      if (len(text) > SURVEY_LIMITS.text) return null;
      return text ? { text } : 'empty';
    }
  }
}

// Unknown keys are ignored; a missing required answer or any invalid answer rejects the whole submission.
export function parseSurveyAnswers(questions: SurveyQuestion[], raw: unknown): SurveyAnswers | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: SurveyAnswers = {};
  for (const q of questions) {
    const v = Object.hasOwn(o, q.id) ? o[q.id] : undefined;
    const a = v === undefined || v === null ? 'empty' : parseOne(q, v);
    if (a === null) return null;
    if (a === 'empty') {
      if (q.required) return null;
      continue;
    }
    out[q.id] = a;
  }
  return out;
}
