import type { Display, ErrorCode, Results } from './protocol';
import { ANIMALS, ANIMAL_KEYS, AWESOME } from './constants';

// Survey mode: a self-paced feedback form that stays open for days. It shares the socket, the join flow and the
// visualisations with the live game, but none of the game's state: its own tables, messages and screens.

export type SurveyType = 'poll' | 'multi' | 'scale' | 'awesome' | 'animal' | 'wordcloud' | 'open';

export interface SurveyQuestion {
  id: string; // unique within its survey (assigned by the server)
  type: SurveyType;
  text: string;
  hint: string; // optional line under the question
  required: boolean;
  options: string[]; // poll/multi: 2–8 labels; animal: 2–12 keys of ANIMALS; otherwise []
  maxPicks: number; // multi: 2..options.length; otherwise 1
  maxEntries: number; // wordcloud: 1–3; otherwise 1
  min: number; // scale: 0 or 1; awesome: 1
  max: number; // scale: min + 2 … 10; awesome: 5
  minLabel: string; // scale end labels
  maxLabel: string;
  display: Display; // default chart in the host's results
}

// One answer per question; a skipped optional question is simply absent from SurveyAnswers.
export type SurveyAnswer =
  | { choice: number } // poll, animal
  | { choices: number[] } // multi: unique, ascending
  | { rating: number } // scale, awesome
  | { texts: string[] } // wordcloud: 1..maxEntries entries
  | { text: string }; // open

export type SurveyAnswers = Record<string, SurveyAnswer>;

// The editable part of a survey (what the builder sends).
export interface SurveyDraft {
  id: string; // '' = create
  title: string;
  intro: string;
  thanks: string;
  questions: SurveyQuestion[];
}

export type SurveyStatus = 'draft' | 'live' | 'closed';

// Hosts: the definition plus its lifecycle. Never contains the fingerprint key.
export interface AdminSurvey extends SurveyDraft {
  createdAt: number;
  anonymous: boolean;
  k: number; // anonymous: responses are revealed in groups of at least k (1 = instantly)
  days: number; // planned duration in days (closesAt is the source of truth)
  endOfDay: boolean; // deadlines snap to 11:59 pm IST
  opensAt: number | null; // null = draft
  closesAt: number | null;
  finalized: boolean; // closed for good: the respondent fingerprints are erased, so it can't reopen
  rev: number; // bumps on every change; a host's screen refetches results when it changes
  n: number; // responses received, including hidden and sealed ones
  pending: number; // anonymous: sealed responses, waiting to be revealed with others
}

// Respondents: only the live survey, only what the form needs.
export interface PublicSurvey {
  id: string;
  title: string;
  intro: string;
  thanks: string;
  anonymous: boolean;
  k: number;
  closesAt: number;
  questions: SurveyQuestion[];
}

export interface SurveyCard {
  id: string; // random, so listing anonymous responses by id is a stable shuffle
  hidden: boolean;
  who: { name: string; avatar: string } | null; // null when anonymous
  at: number | null; // submission time; null when anonymous
  answers: SurveyAnswers;
}

export interface SurveyData {
  sid: string;
  rev: number;
  n: number; // all responses
  released: number; // responses the host may see
  sealed: number; // anonymous: not revealed yet (they wait for a group of k)
  hidden: number; // released but hidden by a host; excluded from results and exports
  perDay: { day: string; n: number }[]; // IST dates, all responses, counts only
  questions: { qid: string; answered: number; results: Results }[]; // over released, visible responses
  cards: SurveyCard[]; // released responses (hidden ones flagged)
}

export type SurveyClientMsg =
  // players
  | { t: 'survey:check'; sid: string; device: string } // "did this device respond?" (never checks names)
  | { t: 'survey:submit'; ref: string; sid: string; device: string; answers: SurveyAnswers }
  // hosts
  | { t: 'survey:save'; survey: SurveyDraft }
  | { t: 'survey:launch'; id: string; days: number; endOfDay: boolean; anonymous: boolean; k: number }
  | { t: 'survey:extend'; id: string; days: number } // live: push the deadline; closed: reopen
  | { t: 'survey:close'; id: string }
  | { t: 'survey:finalize'; id: string }
  | { t: 'survey:duplicate'; id: string }
  | { t: 'survey:delete'; id: string }
  | { t: 'survey:reset'; id: string } // delete its responses and fingerprints (after a test run)
  | { t: 'survey:hide'; id: string; rid: string; hidden: boolean }
  | { t: 'survey:data'; id: string };

export type SurveyServerMsg =
  | { t: 'survey'; now: number; survey: PublicSurvey | null } // every socket, including ones that haven't joined
  | { t: 'survey:me'; sid: string; done: boolean; n: number }
  | { t: 'survey:ack'; ref: string; ok: boolean; code?: ErrorCode }
  | { t: 'surveys'; now: number; list: AdminSurvey[] } // hosts
  | { t: 'survey:data'; now: number; data: SurveyData }; // hosts, on request

export const isSurveyClientMsg = (m: { t: string }): m is SurveyClientMsg => m.t.startsWith('survey:');

export const SURVEY_LIMITS = {
  surveys: 10, // kept at once (drafts + live + closed)
  questions: 20,
  openQuestions: 5, // comment questions per survey: keeps a response under ~3.5 KB
  title: 60,
  intro: 300,
  thanks: 200,
  hint: 120,
  option: 120,
  optionsMax: 8,
  text: 500, // comment length
  responses: 1500, // per survey (= the player cap: one response per person)
  days: 30, // per launch or extension
  totalDays: 90, // from launch to the final deadline
};

export const DAY_MS = 86_400_000;
export const IST_MS = 19_800_000; // UTC+5:30 all year (India has no daylight saving)
export const DAY_PRESETS = [1, 2, 3, 5, 7, 14];
export const K_CHOICES = [1, 3, 5, 10];
export const DEFAULT_K = 5;
export const SURVEY_GRACE_MS = 120_000; // answers still count this long after the deadline (people mid-submit)
export const AUTO_FINALIZE_DAYS = 7; // fingerprints are erased this long after closing
export const DEVICE_RE = /^[A-Za-z0-9_-]{16,64}$/;

export const SURVEY_FORMATS: Record<SurveyType, Display[]> = {
  poll: ['bars', 'columns', 'donut', 'bubbles', 'versus'],
  multi: ['bars', 'columns', 'bubbles'], // no donut: picks add up to more than 100 %
  animal: ['bars', 'columns', 'donut', 'bubbles'],
  scale: ['histogram', 'gauge', 'average'],
  awesome: ['histogram', 'gauge', 'average'],
  wordcloud: ['cloud', 'bubbles', 'list'],
  open: ['wall'], // shown as a full comment list; "wall" is only the stored default
};

export const SURVEY_TYPE_INFO: Record<SurveyType, { label: string; icon: string; hint: string }> = {
  poll: { label: 'Single choice', icon: '📊', hint: 'Pick one option' },
  multi: { label: 'Multiple choice', icon: '☑️', hint: 'Pick up to N options' },
  scale: { label: 'Rating', icon: '🎚️', hint: 'Emoji faces (1–5) or 0–10' },
  awesome: { label: 'Awesome scale', icon: '🤩', hint: 'Five levels of awesome' },
  animal: { label: 'Spirit animal', icon: '🐾', hint: 'Pick an animal card' },
  wordcloud: { label: 'One word', icon: '☁️', hint: 'A word or two → word cloud' },
  open: { label: 'Comment', icon: '💬', hint: `Free text, up to ${SURVEY_LIMITS.text} characters` },
};

export function defaultSurveyQuestion(type: SurveyType): SurveyQuestion {
  const base: SurveyQuestion = {
    id: '', type, text: '', hint: '', required: type !== 'open', options: [], maxPicks: 1, maxEntries: 1,
    min: 1, max: 5, minLabel: '', maxLabel: '', display: SURVEY_FORMATS[type][0],
  };
  switch (type) {
    case 'poll':
      return { ...base, options: ['', ''] };
    case 'multi':
      return { ...base, options: ['', '', ''], maxPicks: 2 };
    case 'scale':
      return { ...base, minLabel: 'Meh', maxLabel: 'Loved it!' };
    case 'animal':
      return { ...base, options: [...ANIMAL_KEYS] };
    default:
      return base; // awesome (1–5), wordcloud (1 entry), open
  }
}

export function surveyStatus(s: { opensAt: number | null; closesAt: number | null }, now: number): SurveyStatus {
  if (s.opensAt === null || s.closesAt === null) return 'draft';
  return now < s.closesAt ? 'live' : 'closed';
}

const SECONDS: Record<SurveyType, number> = { poll: 8, multi: 12, scale: 6, awesome: 6, animal: 10, wordcloud: 15, open: 40 };
export const surveyMinutes = (qs: SurveyQuestion[]) => Math.max(1, Math.round(qs.reduce((sum, q) => sum + SECONDS[q.type], 20) / 60));

export const istDay = (ms: number) => new Date(ms + IST_MS).toISOString().slice(0, 10);
// 11:59 pm IST on the IST day that contains `ms`.
export const endOfIstDay = (ms: number) => Math.floor((ms + IST_MS) / DAY_MS) * DAY_MS - IST_MS + DAY_MS - 60_000;

export const animalLabel = (key: string | undefined) => (key && ANIMALS[key] ? `${ANIMALS[key].emoji} ${ANIMALS[key].name}` : '');

// Human-readable answer, used by the review step, response cards, CSV export and the summary.
export function answerLabel(q: SurveyQuestion, a: SurveyAnswer | undefined): string {
  if (!a) return '';
  if ('choice' in a) return q.type === 'animal' ? animalLabel(q.options[a.choice]) : (q.options[a.choice] ?? '');
  if ('choices' in a) return a.choices.map((i) => q.options[i] ?? '').join(' | ');
  if ('rating' in a) {
    const level = q.type === 'awesome' ? AWESOME[a.rating - 1] : undefined;
    return level ? `${level.emoji} ${level.label}` : String(a.rating);
  }
  if ('texts' in a) return a.texts.join(' | ');
  return a.text;
}
