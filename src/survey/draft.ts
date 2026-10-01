import type { SurveyAnswer, SurveyAnswers, SurveyQuestion } from '../../shared/survey';

// Answers in progress stay on this device only (nothing is sent before Send), so people can finish later.
const PREFIX = 'cfid.survey.';
const KEY = (sid: string) => `${PREFIX}v1.${sid}`;

export type SurveyStep = 'intro' | 'review' | number; // number = question index

export interface Draft {
  answers: SurveyAnswers;
  step: SurveyStep;
}

// Drafts come from localStorage, so they are untrusted: keep answers that fit their (current) question, clamp the step.
function fits(q: SurveyQuestion, a: unknown): a is SurveyAnswer {
  if (!a || typeof a !== 'object') return false;
  const o = a as Record<string, unknown>;
  const index = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < q.options.length;
  switch (q.type) {
    case 'poll':
    case 'animal':
      return index(o.choice);
    case 'multi':
      return Array.isArray(o.choices) && o.choices.length <= q.maxPicks && o.choices.every(index);
    case 'scale':
    case 'awesome':
      return Number.isInteger(o.rating) && (o.rating as number) >= q.min && (o.rating as number) <= q.max;
    case 'wordcloud':
      return Array.isArray(o.texts) && o.texts.length <= q.maxEntries && o.texts.every((t) => typeof t === 'string');
    case 'open':
      return typeof o.text === 'string';
  }
}

export function loadDraft(sid: string, questions: SurveyQuestion[]): Draft | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(sid)) ?? 'null') as { answers?: unknown; step?: unknown } | null;
    if (!raw || typeof raw !== 'object' || !raw.answers || typeof raw.answers !== 'object') return null;
    const saved = raw.answers as Record<string, unknown>;
    const answers: SurveyAnswers = {};
    for (const q of questions) if (fits(q, saved[q.id])) answers[q.id] = saved[q.id] as SurveyAnswer;
    const step: SurveyStep =
      raw.step === 'review' ? 'review' : Number.isInteger(raw.step) ? Math.min(Math.max(raw.step as number, 0), questions.length - 1) : 'intro';
    return { answers, step };
  } catch {
    return null;
  }
}

export function saveDraft(sid: string, d: Draft) {
  try {
    localStorage.setItem(KEY(sid), JSON.stringify(d));
  } catch {
    // storage full or blocked: the draft lives in memory only
  }
}

// After that survey's response is stored.
export function clearDraft(sid: string) {
  try {
    localStorage.removeItem(KEY(sid));
  } catch {
    // ignore
  }
}

// On every logout, forced ones included, so the next person on a shared device never sees them.
export function clearDrafts() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}
