import type { Display, Question, QuestionType } from './protocol';

export const ROOM_NAME = 'cf-india-day';
export const DEFAULT_ADMIN_SUFFIX = '_adminControl';
export const SPLASH_TEXT = 'Yayyyyyyyy, itssss CorpFun Dayyyy 🥳🤩';
export const SPLASH_MS = 10_000;

export const LIMITS = {
  players: 1500,
  questions: 150, // across all events
  events: 20,
  eventName: 40,
  nameMin: 2,
  nameMax: 20,
  question: 200,
  option: 200,
  optionsMin: 2,
  optionsMax: 6,
  word: 25,
  text: 140,
  label: 30,
  unit: 12,
};

export const GRACE_MS = 1000; // late answers accepted this long after the timer ends (network latency)
export const FLUSH_MS = 250; // server batching window for live/admin updates
export const DRAW_SPIN_MS = 4500;
export const DRAW_SHOW_MS = 15_000;

export const AVATARS: string[] = [
  '🦁', '🐯', '🐼', '🦊', '🐸', '🐵', '🦄', '🐙', '🦉', '🐧', '🐨', '🐶',
  '🐱', '🐰', '🦖', '🐝', '🦋', '🐬', '🌻', '🍕', '🚀', '⚡', '🎸', '🏏',
];
export const REACTIONS: string[] = ['❤️', '😂', '🔥', '👏', '🎉', '🤯'];

export interface Animal {
  emoji: string;
  name: string;
  trait: string;
  tags: [string, string];
  color: string;
  ink: string; // text colour on `color`
  wild?: boolean;
}

// The "Meet the animals" deck, in slide order.
export const ANIMALS: Record<string, Animal> = {
  ant: { emoji: '🐜', name: 'Ant', trait: 'Collaborative', tags: ['Persistent', 'Methodical'], color: '#00a3a0', ink: '#fff' },
  elephant: { emoji: '🐘', name: 'Elephant', trait: 'Wise', tags: ['Dependable', 'Big-picture'], color: '#3478f6', ink: '#fff' },
  tiger: { emoji: '🐯', name: 'Tiger', trait: 'Ambitious', tags: ['Decisive', 'Competitive'], color: '#ec6461', ink: '#fff' },
  eagle: { emoji: '🦅', name: 'Eagle', trait: 'Visionary', tags: ['Aspirational', 'High standards'], color: '#f39a35', ink: '#fff' },
  owl: { emoji: '🦉', name: 'Owl', trait: 'Analytical', tags: ['Observant', 'Thoughtful'], color: '#7952d9', ink: '#fff' },
  bee: { emoji: '🐝', name: 'Bee', trait: 'Active', tags: ['Connected', 'Community-minded'], color: '#f6c543', ink: '#120a2a' },
  dog: { emoji: '🐕', name: 'Dog', trait: 'Dependable', tags: ['Supportive', 'Loyal'], color: '#3478f6', ink: '#fff' },
  cat: { emoji: '🐈', name: 'Cat', trait: 'Self-directed', tags: ['Focused', 'Independent'], color: '#7952d9', ink: '#fff' },
  monkey: { emoji: '🐒', name: 'Monkey', trait: 'Curious', tags: ['Playful', 'Inventive'], color: '#4ba869', ink: '#fff' },
  peacock: { emoji: '🦚', name: 'Peacock', trait: 'Expressive', tags: ['Confident', 'Visible'], color: '#ec6461', ink: '#fff' },
  tortoise: { emoji: '🐢', name: 'Tortoise', trait: 'Patient', tags: ['Steady', 'Methodical'], color: '#00a3a0', ink: '#fff' },
  badger: { emoji: '🦡', name: 'Honey Badger', trait: 'Fearless', tags: ['Unconventional', 'Relentless'], color: '#e46c0b', ink: '#fff', wild: true },
};
export const ANIMAL_KEYS = Object.keys(ANIMALS);

export interface Level {
  emoji: string;
  label: string;
  color: string; // dark text reads on it
}

// The awesome scale rates 1–5, and every step is a good feeling.
export const AWESOME: Level[] = [
  { emoji: '😀', label: 'Awesome', color: '#22c55e' },
  { emoji: '😍', label: 'Amazing', color: '#2dd4bf' },
  { emoji: '🤩', label: 'Fantastic', color: '#38bdf8' },
  { emoji: '🤯', label: 'Incredible', color: '#a78bfa' },
  { emoji: '👑', label: 'Legendary', color: '#facc15' },
];
export const awesomeAt = (avg: number): Level => AWESOME[Math.min(AWESOME.length - 1, Math.max(0, Math.round(avg) - 1))];
export const OPTION_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#864cbf', '#0aa3a3'];
export const PALETTE = ['#FF9933', '#22c55e', '#38bdf8', '#f472b6', '#facc15', '#a78bfa', '#fb7185', '#2dd4bf', '#f97316', '#60a5fa'];

export const FORMATS: Record<QuestionType, Display[]> = {
  poll: ['bars', 'columns', 'donut', 'bubbles', 'versus'],
  quiz: ['bars', 'columns', 'donut'],
  wordcloud: ['cloud', 'bubbles', 'list'],
  open: ['wall', 'spotlight'],
  scale: ['histogram', 'gauge', 'average'],
  awesome: ['histogram', 'gauge', 'average'],
  number: ['dots', 'histogram', 'closest'],
  animal: ['spirit'],
};

export const DISPLAY_LABELS: Record<Display, string> = {
  bars: '📊 Bars',
  columns: '📶 Columns',
  donut: '🍩 Donut',
  bubbles: '🫧 Bubbles',
  versus: '⚔️ Versus',
  cloud: '☁️ Cloud',
  list: '📋 Ranked list',
  wall: '🗒️ Sticky wall',
  spotlight: '🔦 Spotlight',
  histogram: '📶 Histogram',
  gauge: '🎚️ Gauge',
  average: '🔢 Big average',
  dots: '•••• Number line',
  closest: '🎯 Closest guesses',
  spirit: '🫧 Floating bubbles',
};

export const TYPE_INFO: Record<QuestionType, { label: string; icon: string; hint: string }> = {
  poll: { label: 'Poll', icon: '📊', hint: 'Pick one — no wrong answers' },
  quiz: { label: 'Quiz', icon: '🏆', hint: 'Right + fast = more points' },
  wordcloud: { label: 'Word cloud', icon: '☁️', hint: 'A word or two' },
  open: { label: 'Open text', icon: '💬', hint: 'Share a short thought' },
  scale: { label: 'Rating', icon: '🎚️', hint: 'Tap your rating' },
  awesome: { label: 'Awesome scale', icon: '🤩', hint: 'Pick your level of awesome ✨' },
  number: { label: 'Guess the number', icon: '🔢', hint: 'Closest guess wins' },
  animal: { label: 'Spirit animal', icon: '🐾', hint: 'Tap the animal that fits how you work' },
};

export function defaultQuestion(type: QuestionType): Question {
  const base: Question = {
    id: '', eventId: '', type, text: '', options: [], correct: null, timer: 0, points: 0, maxEntries: 1,
    min: 1, max: 5, minLabel: '', maxLabel: '', unit: '',
    display: FORMATS[type][0], showOnPhones: false, moderate: false,
  };
  switch (type) {
    case 'poll':
      return { ...base, options: ['', ''], showOnPhones: true };
    case 'quiz':
      return { ...base, options: ['', '', '', ''], correct: 0, timer: 20, points: 1 };
    case 'wordcloud':
      return { ...base, maxEntries: 3 };
    case 'open':
      return base;
    case 'scale':
      return { ...base, minLabel: 'Meh', maxLabel: 'Love it!', showOnPhones: true };
    case 'awesome':
      return { ...base, showOnPhones: true };
    case 'number':
      return { ...base, min: 0, max: 1000, timer: 30, points: 1 };
    case 'animal':
      return { ...base, options: [...ANIMAL_KEYS] };
  }
}
