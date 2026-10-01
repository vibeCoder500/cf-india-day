import { useSyncExternalStore } from 'react';
import { WebSocket as ReconnectingWebSocket } from 'partysocket';
import type { AdminState, AnswerValue, ClientMsg, ErrorCode, ServerMsg, ViewMsg } from '../../shared/protocol';
import type { AdminSurvey, PublicSurvey, SurveyAnswers, SurveyData } from '../../shared/survey';
import { clearDraft, clearDrafts } from '../survey/draft';
import { deviceId } from './device';

export interface Session {
  token: string;
  role: 'player' | 'admin';
  id: string;
  name: string;
  avatar: string;
}

export interface ClientState {
  status: 'connecting' | 'open' | 'closed';
  session: Session | null;
  view: ViewMsg | null;
  admin: AdminState | null;
  error: { code: ErrorCode; message: string; at: number } | null;
  offset: number; // serverNow - Date.now()
  pending: Record<string, true>; // answer refs awaiting ack
  survey: PublicSurvey | null; // the live survey (sent to the survey site, which never logs in)
  surveyHeard: boolean; // the server has said which survey is live (possibly none)
  surveyMe: Record<string, { done: boolean }>; // per survey id: has this device responded?
  surveySending: { ref: string; sid: string } | null; // a submission awaiting its ack
  surveys: AdminSurvey[] | null; // hosts
  surveyData: SurveyData | null; // hosts: results of the survey that is open
}

const SESSION_KEY = 'cfid.session.v1';

// The survey site lives at /survey (respond, never logged in) and /surveyAdmin (the hosts' studio). Neither touches the
// game: a phone's saved game session is left alone, and the studio only uses a host session.
const PATH = location.pathname.toLowerCase();
export const SURVEY_ROUTE: 'respond' | 'admin' | null = PATH.startsWith('/surveyadmin')
  ? 'admin'
  : /^\/surveys?(\/|$)/.test(PATH)
    ? 'respond'
    : null;

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const s = raw ? (JSON.parse(raw) as Session) : null;
    if (SURVEY_ROUTE === 'respond') return null;
    if (SURVEY_ROUTE === 'admin') return s?.role === 'admin' ? s : null;
    return s;
  } catch {
    return null;
  }
}

function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage blocked (private mode): the session lives in memory for this tab only
  }
}

const FRIENDLY: Partial<Record<ErrorCode, string>> = {
  CLOSED: 'Too late — voting just closed ⏰',
  ALREADY_ANSWERED: 'You already answered this one 🔒',
  LIMIT: "That's the max for this question",
  RATE_LIMIT: 'Whoa, slow down a little 🙂',
  BAD_REQUEST: "Hmm, that didn't work — try again",
};

const SURVEY_FRIENDLY: Partial<Record<ErrorCode, string>> = {
  CLOSED: 'Sorry, this survey has closed ⏰',
  LIMIT: 'This survey is full',
  RATE_LIMIT: 'Too many responses from here — reload the page and try again',
  BAD_REQUEST: "Hmm, that didn't work — please check your answers",
};

// Not security-sensitive: only used to de-duplicate retried answers.
const randomRef = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

class GameClient {
  state: ClientState = {
    status: 'connecting', session: loadSession(), view: null, admin: null, error: null, offset: 0, pending: {},
    survey: null, surveyHeard: false, surveyMe: {}, surveySending: null, surveys: null, surveyData: null,
  };
  private listeners = new Set<() => void>();
  private rxListeners = new Set<(r: Record<string, number>) => void>();
  private celebrateListeners = new Set<() => void>();
  private ws: ReconnectingWebSocket;
  private lastMsgAt = Date.now();
  private rxBatch: Record<string, number> = {};
  private rxTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.ws = new ReconnectingWebSocket(() => this.url(), [], {
      minReconnectionDelay: 300 + Math.random() * 1200, // jitter so 400 phones don't reconnect in lockstep
      maxReconnectionDelay: 5000,
      reconnectionDelayGrowFactor: 1.5,
      connectionTimeout: 5000,
      maxEnqueuedMessages: 20,
    });
    this.ws.addEventListener('open', () => {
      this.lastMsgAt = Date.now();
      this.set({ status: 'open' });
    });
    this.ws.addEventListener('close', () => this.set({ status: 'closed' }));
    this.ws.addEventListener('message', (e) => this.onMessage(String(e.data)));
    setInterval(() => this.heartbeat(), 15_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.wake();
    });
    window.addEventListener('online', () => this.wake());
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  onReactions(fn: (r: Record<string, number>) => void) {
    this.rxListeners.add(fn);
    return () => {
      this.rxListeners.delete(fn);
    };
  }

  onCelebrate(fn: () => void) {
    this.celebrateListeners.add(fn);
    return () => {
      this.celebrateListeners.delete(fn);
    };
  }

  send(m: ClientMsg) {
    this.ws.send(JSON.stringify(m));
  }

  join(name: string, avatar: string) {
    this.set({ error: null });
    this.send({ t: 'join', name, avatar });
  }

  answer(qid: string, value: AnswerValue) {
    const ref = randomRef();
    const msg: ClientMsg = { t: 'answer', ref, qid, value };
    this.set({ pending: { ...this.state.pending, [ref]: true } });
    this.send(msg);
    setTimeout(() => {
      if (this.state.pending[ref]) this.send(msg); // same ref, so the server de-duplicates
    }, 5000);
    setTimeout(() => {
      if (!this.state.pending[ref]) return;
      const pending = { ...this.state.pending };
      delete pending[ref];
      this.set({ pending, error: { code: 'BAD_REQUEST', message: "Couldn't reach the game — check your connection and tap again", at: Date.now() } });
    }, 12_000);
  }

  react(emoji: string) {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.rxBatch[emoji] = (this.rxBatch[emoji] ?? 0) + 1;
    this.rxTimer ??= setTimeout(() => {
      this.send({ t: 'react', r: this.rxBatch });
      this.rxBatch = {};
      this.rxTimer = null;
    }, 400);
  }

  clearError() {
    this.set({ error: null });
  }

  // The survey site only: the server answers with survey:me (has this device responded?).
  surveyCheck() {
    const s = this.state.survey;
    if (s && SURVEY_ROUTE === 'respond') this.send({ t: 'survey:check', sid: s.id, device: deviceId() });
  }

  // `sid` comes from the form, which keeps working for a moment after the survey closes (the server's grace period).
  surveySubmit(sid: string, answers: SurveyAnswers) {
    const ref = randomRef();
    const msg: ClientMsg = { t: 'survey:submit', ref, sid, device: deviceId(), answers };
    this.set({ surveySending: { ref, sid }, error: null });
    this.send(msg);
    setTimeout(() => {
      if (this.state.surveySending?.ref === ref) this.send(msg); // a retry of a stored response comes back ALREADY_ANSWERED = done
    }, 5000);
    setTimeout(() => {
      if (this.state.surveySending?.ref !== ref) return;
      this.set({ surveySending: null, error: { code: 'BAD_REQUEST', message: "Couldn't reach the server — check your connection and tap Send again", at: Date.now() } });
    }, 12_000);
  }

  leave() {
    if (this.state.session) this.send({ t: 'leave' });
    saveSession(null);
    clearDrafts();
    this.set({ session: null, view: null, admin: null, surveyMe: {}, surveySending: null, surveys: null, surveyData: null });
    this.ws.reconnect();
  }

  private url() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const t = this.state.session?.token;
    return `${proto}://${location.host}/api/ws${t ? `?t=${encodeURIComponent(t)}` : ''}`;
  }

  private heartbeat() {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    if (Date.now() - this.lastMsgAt > 40_000) {
      this.ws.reconnect(); // the socket looks open but is dead (common after a phone sleeps)
      return;
    }
    this.ws.send('ping');
  }

  private wake() {
    if (this.ws.readyState !== WebSocket.OPEN) {
      this.ws.reconnect();
      return;
    }
    const before = this.lastMsgAt;
    this.ws.send('ping');
    if (this.state.session) this.send({ t: 'sync' });
    setTimeout(() => {
      if (this.lastMsgAt === before) this.ws.reconnect();
    }, 4000);
  }

  private onMessage(data: string) {
    this.lastMsgAt = Date.now();
    if (data === 'pong') return;
    let m: ServerMsg;
    try {
      m = JSON.parse(data) as ServerMsg;
    } catch {
      return;
    }
    const offset = 'now' in m ? m.now - Date.now() : this.state.offset;
    switch (m.t) {
      case 'welcome': {
        const session: Session = { token: m.token, role: m.role, id: m.id, name: m.name, avatar: m.avatar };
        saveSession(session);
        this.set({ session, error: null });
        return;
      }
      case 'view':
        this.set({ view: m, offset });
        return;
      case 'live': {
        const v = this.state.view;
        if (!v) return;
        const same = v.game.qid === m.qid;
        this.set({
          offset,
          view: {
            ...v,
            online: m.online,
            answered: same ? m.answered : v.answered,
            results: same && v.game.phase === 'question' ? m.results : v.results,
          },
        });
        return;
      }
      case 'admin': {
        const prev = this.state.admin;
        this.set({
          offset,
          admin: {
            ...m,
            questions: m.questions ?? prev?.questions ?? [],
            events: m.events ?? prev?.events ?? [],
            asked: m.asked ?? prev?.asked ?? {},
            players: m.players ?? prev?.players ?? [],
          },
        });
        return;
      }
      case 'rx':
        this.rxListeners.forEach((fn) => fn(m.r));
        return;
      case 'celebrate':
        this.celebrateListeners.forEach((fn) => fn());
        return;
      case 'survey':
        this.set({ survey: m.survey, surveyHeard: true, offset });
        this.surveyCheck(); // also after a host reset, so a stale "done" clears
        return;
      case 'survey:me':
        this.set({ surveyMe: { ...this.state.surveyMe, [m.sid]: { done: m.done } } });
        return;
      case 'survey:ack': {
        const sending = this.state.surveySending;
        if (sending?.ref !== m.ref) return;
        if (m.ok || m.code === 'ALREADY_ANSWERED') {
          clearDraft(sending.sid);
          this.set({ surveySending: null, surveyMe: { ...this.state.surveyMe, [sending.sid]: { done: true } } });
        } else {
          const code = m.code ?? 'BAD_REQUEST';
          this.set({ surveySending: null, error: { code, message: SURVEY_FRIENDLY[code] ?? 'Something went wrong', at: Date.now() } });
        }
        return;
      }
      case 'surveys':
        this.set({ surveys: m.list, offset });
        return;
      case 'survey:data':
        this.set({ surveyData: m.data, offset });
        return;
      case 'ack': {
        const pending = { ...this.state.pending };
        delete pending[m.ref];
        const code = m.code ?? 'BAD_REQUEST';
        this.set({ pending, error: m.ok ? this.state.error : { code, message: FRIENDLY[code] ?? 'Something went wrong', at: Date.now() } });
        return;
      }
      case 'error':
        if (m.code === 'SESSION_INVALID' || m.code === 'KICKED') {
          saveSession(null);
          clearDrafts();
          this.set({
            session: null, view: null, admin: null, surveyMe: {}, surveySending: null, surveys: null, surveyData: null,
            error: { code: m.code, message: m.message, at: Date.now() },
          });
        } else {
          this.set({ error: { code: m.code, message: m.message, at: Date.now() } });
        }
    }
  }

  private set(patch: Partial<ClientState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
}

export const client = new GameClient();

// Logging out removes a player from the game (their name becomes free again), so ask first.
export function confirmLeave(): boolean {
  const { session, view } = client.state;
  if (!session) return false;
  const score = view?.me.score ?? 0;
  const message =
    session.role === 'admin'
      ? 'Log out of the host console on this device?'
      : score > 0
        ? `Log out? You'll leave the game and lose your ${score.toLocaleString('en-IN')} points.`
        : 'Log out of the game?';
  if (!confirm(message)) return false;
  client.leave();
  return true;
}

// Selectors must return existing references or primitives (never build new objects/arrays here).
export function useGame<T>(select: (s: ClientState) => T): T {
  return useSyncExternalStore(client.subscribe, () => select(client.state));
}
