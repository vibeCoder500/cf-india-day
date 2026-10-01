import type { SurveyClientMsg, SurveyServerMsg } from './survey';

export type QuestionType = 'poll' | 'quiz' | 'wordcloud' | 'open' | 'scale' | 'awesome' | 'number' | 'animal';

export type Display =
  | 'bars' | 'columns' | 'donut' | 'bubbles' | 'versus'
  | 'cloud' | 'list'
  | 'wall' | 'spotlight'
  | 'histogram' | 'gauge' | 'average'
  | 'dots' | 'closest'
  | 'spirit';

export interface Question {
  id: string;
  eventId: string; // the event this question belongs to (assigned by the server)
  type: QuestionType;
  text: string;
  options: string[]; // poll/quiz: 2–6 labels; animal: 2–12 keys of ANIMALS; otherwise []
  correct: number | null; // quiz: correct option index; number: the true value. Sent as null to phones until results
  timer: number; // seconds; 0 = host closes manually
  points: 0 | 1 | 2; // quiz/number: 0 = practice, 1 = normal, 2 = double
  maxEntries: number; // wordcloud/open: entries per person (1–3); others 1
  min: number; // scale/number range; awesome is always 1–5
  max: number;
  minLabel: string; // scale end labels
  maxLabel: string;
  unit: string; // number, e.g. "km"
  display: Display;
  showOnPhones: boolean; // poll/scale/awesome: mirror live results on phones
  moderate: boolean; // wordcloud/open: host approves each entry before it is shown
}

export type Phase = 'lobby' | 'question' | 'results' | 'leaderboard' | 'podium';

export interface EventInfo {
  id: string;
  name: string;
}

export interface Draw {
  winnerId: string;
  name: string;
  avatar: string;
  at: number; // server ms; also the unique key of this draw
  pool: string[]; // up to 30 shuffled names (includes the winner) for the slot animation
}

export interface GameState {
  phase: Phase;
  eventId: string | null; // the live event: only its questions can be launched
  qid: string | null; // current / last question
  startedAt: number;
  endsAt: number | null;
  liveOnScreen: boolean;
  reactions: boolean;
  draw: Draw | null;
}

export type AnswerValue = { choice: number } | { text: string } | { rating: number } | { number: number };

export interface Closest {
  name: string;
  avatar: string;
  value: number;
}

export interface AnimalPick {
  id: number; // answer id: stays the same when the player changes their pick
  name: string;
  avatar: string;
  choice: number;
}

export type Results =
  | { kind: 'choice'; counts: number[]; total: number; fastest: { name: string; ms: number } | null }
  | { kind: 'words'; words: { text: string; count: number }[]; total: number }
  | { kind: 'texts'; items: { id: number; text: string }[]; total: number }
  | { kind: 'scale'; counts: number[]; avg: number; total: number }
  | { kind: 'numbers'; values: number[]; median: number | null; closest: Closest[]; total: number }
  | { kind: 'animals'; counts: number[]; picks: AnimalPick[]; total: number };

export interface LeaderRow {
  id: string;
  name: string;
  avatar: string;
  score: number;
  rank: number;
  streak: number;
}

export interface Me {
  id: string;
  name: string;
  avatar: string;
  score: number;
  rank: number;
  streak: number;
  answers: AnswerValue[]; // my submissions for the current question
  result: { correct: boolean; points: number } | null; // quiz/number in the results phase
}

export interface AdminPlayer {
  id: string;
  name: string;
  avatar: string;
  score: number;
  online: boolean;
  joinedAt: number;
}

export interface ModItem {
  id: number;
  text: string;
  name: string;
  hidden: boolean;
  at: number;
}

export interface Asked {
  n: number; // players who answered
  at: number; // closed at
}

export type ErrorCode =
  | 'BAD_REQUEST' | 'NAME_INVALID' | 'NAME_TAKEN' | 'SESSION_INVALID' | 'KICKED' | 'ROOM_FULL'
  | 'NOT_ALLOWED' | 'CLOSED' | 'ALREADY_ANSWERED' | 'LIMIT' | 'RATE_LIMIT' | 'NOT_FOUND';

export interface ViewMsg {
  t: 'view';
  now: number;
  game: GameState;
  q: Question | null;
  me: Me;
  results: Results | null;
  online: number;
  answered: number;
  top: LeaderRow[];
}

export interface LiveMsg {
  t: 'live';
  now: number;
  qid: string | null;
  online: number;
  answered: number;
  results: Results | null;
}

export interface AdminMsg {
  t: 'admin';
  now: number;
  game: GameState;
  questions?: Question[]; // only when changed (or on first send)
  events?: EventInfo[]; // sent together with questions
  asked?: Record<string, Asked>;
  players?: AdminPlayer[]; // only when changed (or on first send)
  results: Results | null; // presenter-safe: hidden entries excluded, no names on texts
  mod: ModItem[] | null; // all text entries incl. hidden, with names (host console only)
  online: number;
  total: number;
  answered: number;
  top: LeaderRow[];
}

export type AdminState = Omit<AdminMsg, 'questions' | 'events' | 'asked' | 'players'> & {
  questions: Question[];
  events: EventInfo[];
  asked: Record<string, Asked>;
  players: AdminPlayer[];
};

export type ServerMsg =
  | { t: 'welcome'; token: string; role: 'player' | 'admin'; id: string; name: string; avatar: string }
  | ViewMsg
  | LiveMsg
  | AdminMsg
  | { t: 'rx'; r: Record<string, number> }
  | { t: 'celebrate'; at: number } // host asked the big screens to replay the celebration
  | { t: 'ack'; ref: string; ok: boolean; code?: ErrorCode }
  | { t: 'error'; code: ErrorCode; message: string }
  | SurveyServerMsg;

export type ClientMsg =
  // anyone (anonymous socket)
  | { t: 'join'; name: string; avatar: string }
  // players
  | { t: 'rename'; name: string }
  | { t: 'avatar'; avatar: string }
  | { t: 'answer'; ref: string; qid: string; value: AnswerValue }
  | { t: 'react'; r: Record<string, number> }
  // players + hosts: ask for a fresh snapshot (sent when the tab becomes visible again)
  | { t: 'sync' }
  // players + hosts: log out; a player leaves the game (name and points released), a host token is revoked
  | { t: 'leave' }
  // hosts only
  | { t: 'q:save'; q: Question } // id '' = create
  | { t: 'q:delete'; id: string }
  | { t: 'q:move'; id: string; dir: -1 | 1 }
  | { t: 'q:import'; questions: Question[]; replace: boolean; eventId: string } // replace = only that event's questions
  | { t: 'q:clear'; id: string } // delete a question's answers and points, as if it was never asked
  | { t: 'event:save'; event: EventInfo } // id '' = create
  | { t: 'event:delete'; id: string } // also deletes its questions
  | { t: 'event:live'; id: string } // switch the live event; everyone goes back to the lobby
  | { t: 'launch'; qid: string }
  | { t: 'close' }
  | { t: 'extend'; seconds: number }
  | { t: 'phase'; phase: 'lobby' | 'leaderboard' | 'podium' }
  | { t: 'display'; display: Display } // current question
  | { t: 'toggle'; key: 'liveOnScreen' | 'reactions' | 'showOnPhones'; value: boolean }
  | { t: 'hide'; answerId: number; hidden: boolean }
  | { t: 'kick'; playerId: string }
  | { t: 'draw' }
  | { t: 'draw:clear' }
  | { t: 'celebrate' }
  | { t: 'reset'; scope: 'answers' | 'players' | 'wipe' }
  // survey mode (players: check/submit; hosts: everything else)
  | SurveyClientMsg;
