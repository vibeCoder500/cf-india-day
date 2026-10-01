import { DurableObject } from 'cloudflare:workers';
import type {
  AdminMsg, AdminPlayer, AnimalPick, AnswerValue, Asked, ClientMsg, ErrorCode, EventInfo, GameState, LeaderRow, LiveMsg, Me, ModItem,
  Question, Results, ServerMsg, ViewMsg,
} from '../shared/protocol';
import { AVATARS, DEFAULT_ADMIN_SUFFIX, FLUSH_MS, FORMATS, GRACE_MS, LIMITS, REACTIONS } from '../shared/constants';
import { isSurveyClientMsg } from '../shared/survey';
import { clean, len, parseAnswer, parseName, parseQuestion } from './validate';
import { Surveys } from './surveys';

type Att = { kind: 'anon'; joins: number } | { kind: 'player'; pid: string } | { kind: 'admin'; token: string; name: string };
type Dirty = 'admin' | 'questions' | 'players' | 'live';

interface Player {
  id: string;
  token: string;
  name: string;
  key: string;
  avatar: string;
  score: number;
  streak: number;
  kicked: boolean;
  joinedAt: number;
}

interface Answer {
  id: number;
  pid: string;
  ref: string;
  value: AnswerValue;
  at: number;
  elapsed: number;
  points: number;
  hidden: boolean;
}

// sql.exec<T> requires `type` aliases here; interfaces don't satisfy its Record<string, SqlStorageValue> constraint.
type PlayerRow = {
  id: string; token: string; name: string; name_key: string; avatar: string;
  score: number; streak: number; kicked: number; joined_at: number;
};
type AnswerRow = { id: number; pid: string; ref: string; value: string; at: number; elapsed: number; points: number; hidden: number };

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, token TEXT NOT NULL, name TEXT NOT NULL, name_key TEXT NOT NULL, avatar TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0, kicked INTEGER NOT NULL DEFAULT 0, joined_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS admins (token TEXT PRIMARY KEY, name TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, pos INTEGER NOT NULL, data TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS answers (id INTEGER PRIMARY KEY, qid TEXT NOT NULL, pid TEXT NOT NULL, ref TEXT NOT NULL, value TEXT NOT NULL, at INTEGER NOT NULL, elapsed INTEGER NOT NULL, points INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0)',
  'CREATE INDEX IF NOT EXISTS answers_qid ON answers (qid)',
];

const NUMBER_PRIZES = [1000, 750, 500];
const ID_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789'; // 32 chars, so b % 32 is unbiased

const freshGame = (reactions = true, eventId: string | null = null): GameState => ({
  phase: 'lobby', eventId, qid: null, startedAt: 0, endsAt: null, liveOnScreen: true, reactions, draw: null,
});
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => ID_CHARS[b % 32]).join('');
const randomInt = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Kahoot-style: 500–1000 by speed (1000 if untimed), times the multiplier, plus +100 per streak step (max +500).
function quizPoints(elapsedMs: number, timerSec: number, multiplier: number, streak: number): number {
  const speed = timerSec > 0 ? 1 - Math.min(elapsedMs / (timerSec * 1000), 1) / 2 : 1;
  return Math.round(1000 * speed) * multiplier + Math.min(Math.max(streak - 1, 0), 5) * 100;
}

export class GameRoom extends DurableObject<Env> {
  private sql: SqlStorage;
  private game: GameState;
  private questions: Question[];
  private events: EventInfo[];
  private asked: Record<string, Asked>;
  private winners: string[];
  private players = new Map<string, Player>();
  private byToken = new Map<string, string>();
  private byKey = new Map<string, string>();
  private admins = new Map<string, string>(); // token -> host display name
  private answers: Answer[] = []; // answers of game.qid only
  private ranked: Player[] | null = null;
  private rankOf = new Map<string, number>();
  private dirty = new Set<Dirty>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private rx: Record<string, number> = {};
  private buckets = new WeakMap<WebSocket, { tokens: number; at: number }>();
  private surveys: Surveys;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    for (const s of SCHEMA) this.sql.exec(s);
    this.game = this.meta<GameState>('game') ?? freshGame();
    this.asked = this.meta<Record<string, Asked>>('asked') ?? {};
    this.winners = this.meta<string[]>('winners') ?? [];
    this.questions = this.sql
      .exec<{ data: string }>('SELECT data FROM questions ORDER BY pos')
      .toArray()
      .map((r) => JSON.parse(r.data) as Question);
    for (const r of this.sql.exec<PlayerRow>('SELECT * FROM players')) {
      this.remember({
        id: r.id, token: r.token, name: r.name, key: r.name_key, avatar: r.avatar,
        score: r.score, streak: r.streak, kicked: r.kicked === 1, joinedAt: r.joined_at,
      });
    }
    for (const r of this.sql.exec<{ token: string; name: string }>('SELECT token, name FROM admins')) {
      this.admins.set(r.token, r.name);
    }
    this.events = this.meta<EventInfo[]>('events') ?? [];
    this.ensureEvents();
    if (this.game.qid) this.loadAnswers(this.game.qid);
    this.surveys = new Surveys(ctx, this.sql, {
      sockets: () => this.conns().map(({ ws, att }) => ({ ws, kind: att?.kind ?? 'anon' })),
    });
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request: Request): Promise<Response> {
    const token = new URL(request.url).searchParams.get('t') ?? '';
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const att = this.resume(token);
    server.serializeAttachment(att ?? { kind: 'anon', joins: 0 });
    if (att) this.welcome(server, att);
    else if (token) this.fail(server, this.byToken.has(token) ? 'KICKED' : 'SESSION_INVALID', 'Please join again');
    if (!att) this.surveys.helloPublic(server); // the survey site answers the live survey without logging in
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const att = ws.deserializeAttachment() as Att | null;
    // A survey with long comments can be up to ~22 KB; every other player message keeps the 4 KB cap (checked below).
    if (!att || typeof raw !== 'string' || raw.length > (att.kind === 'admin' ? 512_000 : 32_000)) return;
    if (att.kind !== 'admin' && !this.allow(ws)) return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw) as ClientMsg;
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== 'string') return;
    if (att.kind !== 'admin' && raw.length > 4_000 && msg.t !== 'survey:submit') return;
    try {
      if (att.kind === 'anon') {
        if (msg.t === 'join') this.join(ws, att, msg);
        // The survey site (/survey) never logs in: respondents are anonymous, one response per device.
        else if (msg.t === 'survey:check' || msg.t === 'survey:submit') await this.surveys.onMessage(ws, { kind: 'public' }, msg);
        return;
      }
      if (isSurveyClientMsg(msg)) {
        return await this.surveys.onMessage(ws, att.kind === 'admin' ? { kind: 'admin' } : { kind: 'public' }, msg);
      }
      if (msg.t === 'sync') return this.welcome(ws, att);
      if (msg.t === 'leave') return this.leave(ws, att);
      if (att.kind === 'player') this.onPlayer(ws, att.pid, msg);
      else await this.onAdmin(ws, msg);
    } catch (err) {
      console.error('message failed', msg.t, err);
      this.fail(ws, 'BAD_REQUEST', 'Something went wrong');
    }
  }

  async webSocketClose() {
    this.touch('players', 'live');
  }

  async webSocketError() {
    this.touch('players', 'live');
  }

  async alarm() {
    if (this.game.phase !== 'question' || this.game.endsAt === null) return;
    if (Date.now() < this.game.endsAt + GRACE_MS - 100) {
      await this.ctx.storage.setAlarm(this.game.endsAt + GRACE_MS);
      return;
    }
    await this.closeQuestion();
  }

  // Token bucket per socket: burst 20, refill 5 msg/s. Resets on hibernation, which is fine.
  private allow(ws: WebSocket): boolean {
    const now = Date.now();
    const b = this.buckets.get(ws) ?? { tokens: 20, at: now };
    b.tokens = Math.min(20, b.tokens + ((now - b.at) / 1000) * 5);
    b.at = now;
    this.buckets.set(ws, b);
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  private join(ws: WebSocket, att: { kind: 'anon'; joins: number }, msg: { name: string; avatar: string; hostOnly?: boolean }) {
    if (att.joins >= 10) return this.fail(ws, 'RATE_LIMIT', 'Too many attempts — please refresh the page');
    ws.serializeAttachment({ kind: 'anon', joins: att.joins + 1 });
    const parsed = parseName(msg.name, this.env.ADMIN_SUFFIX || DEFAULT_ADMIN_SUFFIX);
    if (!parsed.ok) return this.fail(ws, 'NAME_INVALID', parsed.error);
    if (msg.hostOnly === true && !parsed.admin) return this.fail(ws, 'NOT_ALLOWED', "That name doesn't have host access");
    if (parsed.admin) {
      const token = crypto.randomUUID();
      this.sql.exec('INSERT INTO admins (token, name) VALUES (?, ?)', token, parsed.name);
      this.admins.set(token, parsed.name);
      return this.attach(ws, { kind: 'admin', token, name: parsed.name });
    }
    if (this.byKey.has(parsed.key)) {
      return this.fail(ws, 'NAME_TAKEN', `“${parsed.name}” is already taken — add an initial or an emoji`);
    }
    if (this.players.size >= LIMITS.players) return this.fail(ws, 'ROOM_FULL', 'Sorry, the room is full');
    const p: Player = {
      id: randomId(),
      token: crypto.randomUUID(),
      name: parsed.name,
      key: parsed.key,
      avatar: AVATARS.includes(msg.avatar) ? msg.avatar : AVATARS[randomInt(AVATARS.length)],
      score: 0,
      streak: 0,
      kicked: false,
      joinedAt: Date.now(),
    };
    this.sql.exec(
      'INSERT INTO players (id, token, name, name_key, avatar, joined_at) VALUES (?, ?, ?, ?, ?, ?)',
      p.id, p.token, p.name, p.key, p.avatar, p.joinedAt,
    );
    this.remember(p);
    this.ranked = null;
    this.attach(ws, { kind: 'player', pid: p.id });
  }

  private attach(ws: WebSocket, att: Att) {
    ws.serializeAttachment(att);
    this.welcome(ws, att);
  }

  private resume(token: string): Att | null {
    if (!token) return null;
    const host = this.admins.get(token);
    if (host !== undefined) return { kind: 'admin', token, name: host };
    const p = this.players.get(this.byToken.get(token) ?? '');
    return p && !p.kicked ? { kind: 'player', pid: p.id } : null;
  }

  private welcome(ws: WebSocket, att: Att) {
    if (att.kind === 'admin') {
      this.send(ws, { t: 'welcome', token: att.token, role: 'admin', id: 'host', name: att.name, avatar: '🎤' });
      this.raw(ws, this.adminMsg(true));
      this.surveys.helloAdmin(ws);
    } else if (att.kind === 'player') {
      const p = this.players.get(att.pid);
      if (!p) return;
      this.send(ws, { t: 'welcome', token: p.token, role: 'player', id: p.id, name: p.name, avatar: p.avatar });
      this.raw(ws, this.viewMsg(p));
      this.touch('players', 'live');
    }
  }

  // ---------- player actions ----------

  private onPlayer(ws: WebSocket, pid: string, msg: ClientMsg) {
    const p = this.players.get(pid);
    if (!p || p.kicked) return;
    switch (msg.t) {
      case 'answer':
        return this.answer(ws, p, msg.ref, msg.qid, msg.value);
      case 'react':
        return this.react(msg.r);
      case 'avatar': {
        if (!AVATARS.includes(msg.avatar)) return;
        p.avatar = msg.avatar;
        this.sql.exec('UPDATE players SET avatar = ? WHERE id = ?', p.avatar, p.id);
        return this.refresh(p, true);
      }
      case 'rename': {
        const n = parseName(msg.name, this.env.ADMIN_SUFFIX || DEFAULT_ADMIN_SUFFIX);
        if (!n.ok) return this.fail(ws, 'NAME_INVALID', n.error);
        if (n.admin) return this.fail(ws, 'NAME_INVALID', 'That name is reserved');
        if (n.key !== p.key && this.byKey.has(n.key)) return this.fail(ws, 'NAME_TAKEN', `“${n.name}” is already taken`);
        this.byKey.delete(p.key);
        p.name = n.name;
        p.key = n.key;
        this.byKey.set(p.key, p.id);
        this.sql.exec('UPDATE players SET name = ?, name_key = ? WHERE id = ?', p.name, p.key, p.id);
        return this.refresh(p, true);
      }
      default:
        return this.fail(ws, 'NOT_ALLOWED', 'Not allowed');
    }
  }

  private answer(ws: WebSocket, p: Player, ref: unknown, qid: unknown, value: unknown) {
    if (typeof ref !== 'string' || !ref || ref.length > 40) return;
    const q = this.current();
    const g = this.game;
    const now = Date.now();
    if (!q || g.phase !== 'question' || q.id !== qid || (g.endsAt !== null && now > g.endsAt + GRACE_MS)) {
      return this.ack(ws, ref, false, 'CLOSED');
    }
    const mine = this.answers.filter((a) => a.pid === p.id);
    if (mine.some((a) => a.ref === ref)) return this.ack(ws, ref, true); // retry of an answer we already stored
    const v = parseAnswer(q, value);
    if (!v) return this.ack(ws, ref, false, 'BAD_REQUEST');
    const elapsed = Math.max(0, now - g.startedAt);
    if ((q.type === 'poll' || q.type === 'scale' || q.type === 'awesome' || q.type === 'animal') && mine.length > 0) {
      const a = mine[0];
      Object.assign(a, { value: v, ref, at: now, elapsed });
      this.sql.exec(
        'UPDATE answers SET value = ?, ref = ?, at = ?, elapsed = ? WHERE id = ?',
        JSON.stringify(v), ref, now, elapsed, a.id,
      );
    } else {
      if (mine.length >= q.maxEntries) {
        return this.ack(ws, ref, false, q.type === 'quiz' || q.type === 'number' ? 'ALREADY_ANSWERED' : 'LIMIT');
      }
      const row = this.sql
        .exec<{ id: number }>(
          'INSERT INTO answers (qid, pid, ref, value, at, elapsed, hidden) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
          q.id, p.id, ref, JSON.stringify(v), now, elapsed, q.moderate ? 1 : 0,
        )
        .one();
      this.answers.push({ id: row.id, pid: p.id, ref, value: v, at: now, elapsed, points: 0, hidden: q.moderate });
    }
    this.ack(ws, ref, true);
    this.refresh(p);
    this.touch('live');
  }

  private react(r: unknown) {
    if (!this.game.reactions || !r || typeof r !== 'object') return;
    for (const [emoji, n] of Object.entries(r)) {
      if (REACTIONS.includes(emoji) && Number.isInteger(n) && n > 0) {
        this.rx[emoji] = (this.rx[emoji] ?? 0) + Math.min(n, 10);
      }
    }
    this.touch();
  }

  private refresh(p: Player, withWelcome = false) {
    const view = this.viewMsg(p);
    for (const { ws, att } of this.conns()) {
      if (att?.kind !== 'player' || att.pid !== p.id) continue;
      if (withWelcome) this.send(ws, { t: 'welcome', token: p.token, role: 'player', id: p.id, name: p.name, avatar: p.avatar });
      this.raw(ws, view);
    }
    if (withWelcome) this.touch('players');
  }

  // ---------- host actions (the socket attachment already proved kind === 'admin') ----------

  private async onAdmin(ws: WebSocket, msg: ClientMsg) {
    switch (msg.t) {
      case 'q:save':
        return this.saveQuestion(ws, msg.q);
      case 'q:delete': {
        if (this.game.phase === 'question' && this.game.qid === msg.id) {
          return this.fail(ws, 'NOT_ALLOWED', 'Close the question first');
        }
        this.questions = this.questions.filter((q) => q.id !== msg.id);
        return this.persistQuestions();
      }
      case 'q:move': {
        // Swap with the neighbour in the same event; other events' questions are skipped.
        const i = this.questions.findIndex((q) => q.id === msg.id);
        if (i < 0) return;
        const step = msg.dir === -1 ? -1 : 1;
        let j = i + step;
        while (j >= 0 && j < this.questions.length && this.questions[j].eventId !== this.questions[i].eventId) j += step;
        if (j < 0 || j >= this.questions.length) return;
        [this.questions[i], this.questions[j]] = [this.questions[j], this.questions[i]];
        return this.persistQuestions();
      }
      case 'q:import': {
        const target = this.eventIdOr(msg.eventId);
        if (msg.replace && this.game.phase === 'question' && this.current()?.eventId === target) {
          return this.fail(ws, 'NOT_ALLOWED', 'Close the question first');
        }
        const list = Array.isArray(msg.questions) ? msg.questions.map((q) => parseQuestion(q)) : [];
        const valid = list.filter((q): q is Question => q !== null).map((q) => ({ ...q, id: randomId(), eventId: target }));
        const kept = msg.replace ? this.questions.filter((q) => q.eventId !== target) : this.questions;
        const added = valid.slice(0, Math.max(0, LIMITS.questions - kept.length));
        this.questions = [...kept, ...added];
        this.persistQuestions();
        if (added.length < list.length) {
          this.fail(ws, 'BAD_REQUEST', `${list.length - added.length} question(s) skipped (invalid, or over the ${LIMITS.questions}-question limit)`);
        }
        return;
      }
      case 'q:clear':
        return this.clearQuestion(msg.id);
      case 'event:save':
        return this.saveEvent(ws, msg.event);
      case 'event:delete':
        return this.deleteEvent(ws, msg.id);
      case 'event:live':
        return this.goLive(ws, msg.id);
      case 'launch':
        return this.launch(ws, msg.qid);
      case 'close':
        return this.closeQuestion();
      case 'extend':
        return this.extend(msg.seconds);
      case 'phase':
        return this.setPhase(msg.phase);
      case 'display': {
        const q = this.current();
        if (!q || !FORMATS[q.type].includes(msg.display)) return;
        if (msg.display === 'versus' && q.options.length !== 2) return;
        q.display = msg.display;
        return this.updateQuestion(q, false);
      }
      case 'toggle': {
        const value = msg.value === true;
        if (msg.key === 'showOnPhones') {
          const q = this.current();
          if (!q) return;
          q.showOnPhones = value;
          return this.updateQuestion(q, true);
        }
        if (msg.key === 'liveOnScreen') this.game = { ...this.game, liveOnScreen: value };
        else if (msg.key === 'reactions') this.game = { ...this.game, reactions: value };
        else return;
        this.saveGame();
        return this.broadcast();
      }
      case 'hide': {
        const a = this.answers.find((x) => x.id === msg.answerId);
        if (!a) return;
        a.hidden = msg.hidden === true;
        this.sql.exec('UPDATE answers SET hidden = ? WHERE id = ?', a.hidden ? 1 : 0, a.id);
        return this.touch('live');
      }
      case 'kick':
        return this.kick(msg.playerId);
      case 'draw':
        return this.draw(ws);
      case 'draw:clear': {
        this.game = { ...this.game, draw: null };
        this.saveGame();
        return this.broadcast();
      }
      case 'celebrate': {
        const s = JSON.stringify({ t: 'celebrate', at: Date.now() } satisfies ServerMsg);
        for (const { ws, att } of this.conns()) if (att?.kind === 'admin') this.raw(ws, s);
        return;
      }
      case 'reset':
        return this.reset(msg.scope);
      default:
        return this.fail(ws, 'NOT_ALLOWED', 'Unknown action');
    }
  }

  private saveQuestion(ws: WebSocket, raw: unknown) {
    const q = parseQuestion(raw);
    if (!q) return this.fail(ws, 'BAD_REQUEST', 'Please check the question — something is missing or too long');
    q.eventId = this.eventIdOr((raw as { eventId?: unknown }).eventId);
    const i = this.questions.findIndex((x) => x.id === q.id);
    if (i >= 0) {
      if (q.eventId === this.questions[i].eventId) {
        this.questions[i] = q;
        return this.updateQuestion(q, this.game.qid === q.id);
      }
      if (this.game.qid === q.id && (this.game.phase === 'question' || this.game.phase === 'results')) {
        return this.fail(ws, 'NOT_ALLOWED', 'Close this question before moving it to another event');
      }
      // Moved to another event: it goes to the end of that event's list.
      this.questions.splice(i, 1);
      this.questions.push(q);
      return this.persistQuestions();
    }
    if (this.questions.length >= LIMITS.questions) return this.fail(ws, 'LIMIT', 'Question limit reached');
    this.questions.push({ ...q, id: randomId() });
    this.persistQuestions();
  }

  // A valid event id from a host message, else the live event.
  private eventIdOr(id: unknown): string {
    return typeof id === 'string' && this.events.some((e) => e.id === id) ? id : (this.game.eventId ?? this.events[0].id);
  }

  // Data from before events existed: put every question in a default event and make sure one event is live.
  private ensureEvents() {
    if (this.events.length === 0) {
      this.events = [{ id: randomId(), name: 'Main event' }];
      this.setMeta('events', this.events);
    }
    const ids = new Set(this.events.map((e) => e.id));
    for (const q of this.questions) {
      if (ids.has(q.eventId)) continue;
      q.eventId = this.events[0].id;
      this.sql.exec('UPDATE questions SET data = ? WHERE id = ?', JSON.stringify(q), q.id);
    }
    if (!this.game.eventId || !ids.has(this.game.eventId)) {
      this.game = { ...this.game, eventId: this.events[0].id };
      this.saveGame();
    }
  }

  private saveEvent(ws: WebSocket, raw: unknown) {
    const o = (raw ?? {}) as { id?: unknown; name?: unknown };
    const name = clean(o.name);
    if (!name || len(name) > LIMITS.eventName) return this.fail(ws, 'BAD_REQUEST', `Event names need 1–${LIMITS.eventName} characters`);
    const existing = this.events.find((e) => e.id === o.id);
    const clash = this.events.find((e) => e !== existing && e.name.toLowerCase() === name.toLowerCase());
    if (clash) return this.fail(ws, 'BAD_REQUEST', `There's already an event called “${clash.name}”`);
    if (existing) existing.name = name;
    else if (this.events.length >= LIMITS.events) return this.fail(ws, 'LIMIT', `Up to ${LIMITS.events} events`);
    else this.events.push({ id: randomId(), name });
    this.setMeta('events', this.events);
    this.touch('questions');
  }

  private deleteEvent(ws: WebSocket, id: unknown) {
    const ev = this.events.find((e) => e.id === id);
    if (!ev) return;
    if (this.events.length === 1) return this.fail(ws, 'NOT_ALLOWED', 'Keep at least one event (rename it instead)');
    if (this.game.phase === 'question' && this.current()?.eventId === ev.id) return this.fail(ws, 'NOT_ALLOWED', 'Close the question first');
    this.events = this.events.filter((e) => e !== ev);
    this.setMeta('events', this.events);
    this.questions = this.questions.filter((q) => q.eventId !== ev.id);
    this.persistQuestions();
    if (this.game.eventId === ev.id) {
      this.answers = [];
      this.game = { ...this.game, eventId: this.events[0].id, phase: 'lobby', qid: null, draw: null };
      this.saveGame();
      this.broadcast();
    }
  }

  private goLive(ws: WebSocket, id: unknown) {
    const ev = this.events.find((e) => e.id === id);
    if (!ev || ev.id === this.game.eventId) return;
    if (this.game.phase === 'question') return this.fail(ws, 'NOT_ALLOWED', 'Close the current question first');
    this.answers = [];
    this.game = { ...this.game, eventId: ev.id, phase: 'lobby', qid: null, draw: null };
    this.saveGame();
    this.broadcast();
  }

  private updateQuestion(q: Question, notifyPlayers: boolean) {
    this.sql.exec('UPDATE questions SET data = ? WHERE id = ?', JSON.stringify(q), q.id);
    this.touch('questions');
    if (notifyPlayers) this.broadcast();
  }

  // Rewrites the whole list (≤ 150 rows) so the order is always consistent; about 2 rows written per question per save.
  private persistQuestions() {
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM questions');
      this.questions.forEach((q, pos) => {
        this.sql.exec('INSERT INTO questions (id, pos, data) VALUES (?, ?, ?)', q.id, pos, JSON.stringify(q));
      });
    });
    this.touch('questions');
  }

  private kick(playerId: unknown) {
    const p = typeof playerId === 'string' ? this.players.get(playerId) : undefined;
    if (!p || p.kicked) return;
    p.kicked = true;
    this.sql.exec('UPDATE players SET kicked = 1 WHERE id = ?', p.id);
    for (const a of this.answers) {
      if (a.pid !== p.id || a.hidden) continue;
      a.hidden = true;
      this.sql.exec('UPDATE answers SET hidden = 1 WHERE id = ?', a.id);
    }
    for (const { ws, att } of this.conns()) {
      if (att?.kind !== 'player' || att.pid !== p.id) continue;
      this.fail(ws, 'KICKED', 'The host removed you from the game');
      ws.serializeAttachment({ kind: 'anon', joins: 0 });
    }
    this.ranked = null;
    this.touch('players', 'live');
  }

  private draw(ws: WebSocket) {
    const online = this.onlinePids();
    const eligible = (skipPastWinners: boolean) =>
      [...this.players.values()].filter(
        (p) => !p.kicked && online.has(p.id) && !(skipPastWinners && this.winners.includes(p.id)),
      );
    let pool = eligible(true);
    if (pool.length === 0) {
      this.winners = [];
      pool = eligible(false);
    }
    if (pool.length === 0) return this.fail(ws, 'NOT_FOUND', 'Nobody is online to pick from');
    const winner = pool[randomInt(pool.length)];
    this.winners.push(winner.id);
    this.setMeta('winners', this.winners);
    const others = shuffle(pool.filter((p) => p.id !== winner.id)).slice(0, 29).map((p) => p.name);
    this.game = {
      ...this.game,
      draw: { winnerId: winner.id, name: winner.name, avatar: winner.avatar, at: Date.now(), pool: shuffle([...others, winner.name]) },
    };
    this.saveGame();
    this.broadcast();
  }

  // ---------- game flow ----------

  private async launch(ws: WebSocket, qid: string) {
    const q = this.questions.find((x) => x.id === qid);
    if (!q) return;
    if (q.eventId !== this.game.eventId) return this.fail(ws, 'NOT_ALLOWED', 'That question belongs to another event. Make its event live first.');
    if (this.game.phase === 'question') this.finishQuestion();
    this.clearAnswers(q.id); // re-running a question starts it fresh and takes back its points
    this.answers = [];
    const now = Date.now();
    this.game = {
      ...this.game,
      phase: 'question',
      qid: q.id,
      startedAt: now,
      endsAt: q.timer > 0 ? now + q.timer * 1000 : null,
      liveOnScreen: q.type !== 'quiz' && q.type !== 'number',
      draw: null,
    };
    this.saveGame();
    this.broadcast();
    if (this.game.endsAt !== null) await this.ctx.storage.setAlarm(this.game.endsAt + GRACE_MS);
    else await this.ctx.storage.deleteAlarm();
  }

  private clearAnswers(qid: string) {
    const scored = this.sql
      .exec<{ pid: string; points: number }>('SELECT pid, points FROM answers WHERE qid = ? AND points > 0', qid)
      .toArray();
    this.ctx.storage.transactionSync(() => {
      for (const r of scored) {
        const p = this.players.get(r.pid);
        if (!p) continue;
        p.score = Math.max(0, p.score - r.points);
        this.sql.exec('UPDATE players SET score = ? WHERE id = ?', p.score, p.id);
      }
      this.sql.exec('DELETE FROM answers WHERE qid = ?', qid);
    });
    if (qid === this.game.qid) this.answers = [];
    if (this.asked[qid]) {
      delete this.asked[qid];
      this.setMeta('asked', this.asked);
    }
    this.recomputeStreaks();
    this.ranked = null;
  }

  // Streak = consecutive right answers over the scored quizzes in the order they closed, so clearing one question rebuilds it.
  private recomputeStreaks() {
    const quizzes = Object.entries(this.asked)
      .sort((a, b) => a[1].at - b[1].at)
      .map(([id]) => this.questions.find((q) => q.id === id))
      .filter((q): q is Question => q !== undefined && q.type === 'quiz' && q.points > 0 && q.correct !== null);
    const streak = new Map<string, number>();
    for (const q of quizzes) {
      const right = new Set(
        this.sql.exec<{ pid: string }>('SELECT DISTINCT pid FROM answers WHERE qid = ? AND points > 0', q.id).toArray().map((r) => r.pid),
      );
      for (const p of this.players.values()) streak.set(p.id, right.has(p.id) ? (streak.get(p.id) ?? 0) + 1 : 0);
    }
    this.ctx.storage.transactionSync(() => {
      for (const p of this.players.values()) {
        const s = streak.get(p.id) ?? 0;
        if (p.kicked || s === p.streak) continue;
        p.streak = s;
        this.sql.exec('UPDATE players SET streak = ? WHERE id = ?', s, p.id);
      }
    });
  }

  // Undo a question entirely; if it is on screen, everyone goes back to the lobby.
  private async clearQuestion(qid: unknown) {
    if (typeof qid !== 'string' || !this.questions.some((q) => q.id === qid)) return;
    const onScreen = this.game.qid === qid && (this.game.phase === 'question' || this.game.phase === 'results');
    this.clearAnswers(qid);
    if (onScreen) {
      this.game = { ...this.game, phase: 'lobby', endsAt: null };
      this.saveGame();
      await this.ctx.storage.deleteAlarm();
    }
    this.broadcast();
    this.touch('questions', 'players', 'live');
  }

  private leave(ws: WebSocket, att: Att) {
    if (att.kind === 'player') {
      const p = this.players.get(att.pid);
      if (p) {
        this.ctx.storage.transactionSync(() => {
          this.sql.exec('DELETE FROM answers WHERE pid = ?', p.id);
          this.sql.exec('DELETE FROM players WHERE id = ?', p.id);
        });
        this.players.delete(p.id);
        this.byToken.delete(p.token);
        this.byKey.delete(p.key);
        this.answers = this.answers.filter((a) => a.pid !== p.id);
        this.ranked = null;
      }
    } else if (att.kind === 'admin') {
      this.sql.exec('DELETE FROM admins WHERE token = ?', att.token);
      this.admins.delete(att.token);
    }
    // Other tabs of the same session on this device (e.g. the presenter) are logged out too.
    const who = (a: Att | null) => (a?.kind === 'player' ? `p:${a.pid}` : a?.kind === 'admin' ? `a:${a.token}` : '');
    for (const c of this.conns()) {
      if (who(c.att) !== who(att)) continue;
      c.ws.serializeAttachment({ kind: 'anon', joins: 0 });
      if (c.ws !== ws) this.fail(c.ws, 'SESSION_INVALID', 'You logged out on this device');
    }
    this.touch('players', 'live');
  }

  private finishQuestion() {
    const q = this.current();
    if (this.game.phase !== 'question' || !q) return;
    this.score(q);
    this.asked[q.id] = { n: this.answeredCount(), at: Date.now() };
    this.setMeta('asked', this.asked);
    this.game = { ...this.game, phase: 'results', endsAt: null };
    this.saveGame();
    this.touch('questions', 'players');
  }

  private async closeQuestion() {
    this.finishQuestion();
    this.broadcast();
    await this.ctx.storage.deleteAlarm();
  }

  private score(q: Question) {
    if (q.points === 0 || (q.type !== 'quiz' && q.type !== 'number') || q.correct === null) return;
    const target = q.correct;
    const earned = new Map<string, number>();
    if (q.type === 'quiz') {
      for (const a of this.answers) {
        const p = this.players.get(a.pid);
        if (!p || p.kicked || !('choice' in a.value) || a.value.choice !== target) continue;
        a.points = quizPoints(a.elapsed, q.timer, q.points, p.streak + 1);
        earned.set(a.pid, a.points);
      }
    } else {
      const guesses = this.answers
        .filter((a) => !a.hidden && 'number' in a.value)
        .map((a) => ({ a, d: Math.abs((a.value as { number: number }).number - target) }))
        .sort((x, y) => x.d - y.d || x.a.elapsed - y.a.elapsed);
      let place = 0;
      guesses.forEach((g, i) => {
        if (i > 0 && g.d !== guesses[i - 1].d) place = i; // ties share a place
        if (place < NUMBER_PRIZES.length) {
          g.a.points = NUMBER_PRIZES[place] * q.points;
          earned.set(g.a.pid, g.a.points);
        }
      });
    }
    this.ctx.storage.transactionSync(() => {
      for (const a of this.answers) {
        if (a.points > 0) this.sql.exec('UPDATE answers SET points = ? WHERE id = ?', a.points, a.id);
      }
      for (const p of this.players.values()) {
        if (p.kicked) continue;
        const pts = earned.get(p.id) ?? 0;
        const streak = q.type === 'quiz' ? (pts > 0 ? p.streak + 1 : 0) : p.streak;
        if (pts === 0 && streak === p.streak) continue;
        p.score += pts;
        p.streak = streak;
        this.sql.exec('UPDATE players SET score = ?, streak = ? WHERE id = ?', p.score, p.streak, p.id);
      }
    });
    this.ranked = null;
  }

  private async extend(seconds: unknown) {
    if (this.game.phase !== 'question' || !Number.isInteger(seconds)) return;
    const s = seconds as number;
    if (s < 5 || s > 120) return;
    const now = Date.now();
    const endsAt = Math.max(this.game.endsAt ?? now, now) + s * 1000; // untimed question: "close in s seconds"
    this.game = { ...this.game, endsAt };
    this.saveGame();
    this.broadcast();
    await this.ctx.storage.setAlarm(endsAt + GRACE_MS);
  }

  private async setPhase(phase: unknown) {
    if (phase !== 'lobby' && phase !== 'leaderboard' && phase !== 'podium') return;
    if (this.game.phase === 'question') {
      this.finishQuestion();
      await this.ctx.storage.deleteAlarm();
    }
    this.game = { ...this.game, phase };
    this.saveGame();
    this.broadcast();
  }

  private async reset(scope: unknown) {
    if (scope !== 'answers' && scope !== 'players' && scope !== 'wipe') return;
    await this.ctx.storage.deleteAlarm();
    if (scope === 'wipe') {
      // Game data only. Surveys live in their own tables and are run from /surveyAdmin, so a game wipe keeps them.
      this.ctx.storage.transactionSync(() => {
        for (const table of ['meta', 'players', 'admins', 'questions', 'answers']) this.sql.exec(`DELETE FROM ${table}`);
      });
      this.questions = [];
      this.admins.clear();
    } else {
      this.ctx.storage.transactionSync(() => {
        this.sql.exec('DELETE FROM answers');
        this.sql.exec(scope === 'players' ? 'DELETE FROM players' : 'UPDATE players SET score = 0, streak = 0');
        this.sql.exec("DELETE FROM meta WHERE k IN ('asked', 'winners')");
      });
    }
    if (scope === 'answers') {
      for (const p of this.players.values()) {
        p.score = 0;
        p.streak = 0;
      }
    } else {
      this.players.clear();
      this.byToken.clear();
      this.byKey.clear();
    }
    this.answers = [];
    this.asked = {};
    this.winners = [];
    this.ranked = null;
    this.game = freshGame(this.game.reactions, this.game.eventId);
    if (scope === 'wipe') {
      this.events = [];
      this.ensureEvents();
    }
    this.saveGame();
    for (const { ws, att } of this.conns()) {
      const drop = scope === 'wipe' ? att?.kind !== 'anon' : scope === 'players' && att?.kind === 'player';
      if (!drop) continue;
      this.fail(ws, 'SESSION_INVALID', 'The game was reset — please join again');
      ws.serializeAttachment({ kind: 'anon', joins: 0 });
    }
    this.broadcast();
    this.touch('questions', 'players');
  }

  // ---------- views ----------

  private current(): Question | null {
    return this.game.qid ? (this.questions.find((q) => q.id === this.game.qid) ?? null) : null;
  }

  private conns(): { ws: WebSocket; att: Att | null }[] {
    return this.ctx.getWebSockets().map((ws) => ({ ws, att: ws.deserializeAttachment() as Att | null }));
  }

  private onlinePids(): Set<string> {
    const s = new Set<string>();
    for (const { att } of this.conns()) if (att?.kind === 'player') s.add(att.pid);
    return s;
  }

  private answeredCount(): number {
    return new Set(this.answers.map((a) => a.pid)).size;
  }

  private byPlayer(): Map<string, Answer[]> {
    const m = new Map<string, Answer[]>();
    for (const a of this.answers) {
      const list = m.get(a.pid);
      if (list) list.push(a);
      else m.set(a.pid, [a]);
    }
    return m;
  }

  private ranking(): Player[] {
    if (this.ranked) return this.ranked;
    const list = [...this.players.values()]
      .filter((p) => !p.kicked)
      .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
    this.rankOf.clear();
    list.forEach((p, i) => {
      const prev = list[i - 1];
      this.rankOf.set(p.id, prev && prev.score === p.score ? (this.rankOf.get(prev.id) ?? i + 1) : i + 1);
    });
    this.ranked = list;
    return list;
  }

  private top(n: number): LeaderRow[] {
    return this.ranking()
      .slice(0, n)
      .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, rank: this.rankOf.get(p.id) ?? 0, streak: p.streak }));
  }

  private me(p: Player, byPid: Map<string, Answer[]>): Me {
    this.ranking();
    const q = this.current();
    const mine = byPid.get(p.id) ?? [];
    let result: Me['result'] = null;
    if (q && this.game.phase === 'results' && (q.type === 'quiz' || (q.type === 'number' && q.correct !== null))) {
      const a = mine[0];
      const correct = !!a && (q.type === 'quiz' ? 'choice' in a.value && a.value.choice === q.correct : a.points > 0);
      result = { correct, points: a?.points ?? 0 };
    }
    return {
      id: p.id, name: p.name, avatar: p.avatar, score: p.score,
      rank: this.rankOf.get(p.id) ?? 0, streak: p.streak, answers: mine.map((a) => a.value), result,
    };
  }

  private viewBase(): Omit<ViewMsg, 'me'> {
    const g = this.game;
    const q = this.current();
    const inQ = q !== null && (g.phase === 'question' || g.phase === 'results');
    // Phones get small aggregates only: no open-text walls, no raw number lists.
    const phoneResults =
      q !== null && inQ && q.type !== 'open' && q.type !== 'number' && q.type !== 'animal' &&
      (g.phase === 'results' || (q.showOnPhones && (q.type === 'poll' || q.type === 'scale' || q.type === 'awesome')));
    return {
      t: 'view',
      now: Date.now(),
      game: g,
      q: q && inQ ? (g.phase === 'question' ? { ...q, correct: null } : q) : null,
      results: q && phoneResults ? this.results(q) : null,
      online: this.onlinePids().size,
      answered: inQ ? this.answeredCount() : 0,
      top: g.phase === 'leaderboard' || g.phase === 'podium' ? this.top(5) : [],
    };
  }

  private viewMsg(p: Player): string {
    return JSON.stringify({ ...this.viewBase(), me: this.me(p, this.byPlayer()) } satisfies ViewMsg);
  }

  // Serialise the shared part once and splice each player's "me" in.
  private broadcast() {
    const head = JSON.stringify(this.viewBase()).slice(0, -1);
    const byPid = this.byPlayer();
    for (const { ws, att } of this.conns()) {
      if (att?.kind !== 'player') continue;
      const p = this.players.get(att.pid);
      if (p && !p.kicked) this.raw(ws, `${head},"me":${JSON.stringify(this.me(p, byPid))}}`);
    }
    this.touch('admin');
  }

  private results(q: Question): Results {
    const vis = this.answers.filter((a) => !a.hidden);
    if (q.type === 'poll' || q.type === 'quiz') {
      const counts = q.options.map(() => 0);
      let fastest: { name: string; ms: number } | null = null;
      for (const a of vis) {
        if (!('choice' in a.value) || a.value.choice >= counts.length) continue;
        counts[a.value.choice]++;
        const right = q.type === 'quiz' && this.game.phase !== 'question' && a.value.choice === q.correct;
        if (right && (!fastest || a.elapsed < fastest.ms)) fastest = { name: this.players.get(a.pid)?.name ?? '?', ms: a.elapsed };
      }
      return { kind: 'choice', counts, total: vis.length, fastest };
    }
    if (q.type === 'animal') {
      const counts = q.options.map(() => 0);
      const picks: AnimalPick[] = [];
      for (const a of vis) {
        if (!('choice' in a.value) || a.value.choice >= counts.length) continue;
        counts[a.value.choice]++;
        const p = this.players.get(a.pid);
        picks.push({ id: a.id, name: p?.name ?? '?', avatar: p?.avatar ?? '🙂', choice: a.value.choice });
      }
      return { kind: 'animals', counts, picks: picks.slice(-150), total: picks.length };
    }
    if (q.type === 'wordcloud') {
      const words = new Map<string, { text: string; count: number }>();
      for (const a of vis) {
        if (!('text' in a.value)) continue;
        const lower = a.value.text.toLowerCase();
        const key = lower.replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '') || lower;
        const hit = words.get(key);
        if (hit) hit.count++;
        else words.set(key, { text: a.value.text, count: 1 });
      }
      return { kind: 'words', words: [...words.values()].sort((x, y) => y.count - x.count).slice(0, 80), total: vis.length };
    }
    if (q.type === 'open') {
      const items = vis.slice(-150).reverse().flatMap((a) => ('text' in a.value ? [{ id: a.id, text: a.value.text }] : []));
      return { kind: 'texts', items, total: vis.length };
    }
    if (q.type === 'scale' || q.type === 'awesome') {
      const counts = Array.from({ length: q.max - q.min + 1 }, () => 0);
      let sum = 0;
      let n = 0;
      for (const a of vis) {
        if (!('rating' in a.value)) continue;
        const i = a.value.rating - q.min;
        if (i < 0 || i >= counts.length) continue;
        counts[i]++;
        sum += a.value.rating;
        n++;
      }
      return { kind: 'scale', counts, avg: n ? Math.round((sum / n) * 10) / 10 : 0, total: n };
    }
    const guesses = vis.flatMap((a) => ('number' in a.value ? [{ a, v: a.value.number }] : []));
    const sorted = guesses.map((g) => g.v).sort((x, y) => x - y);
    const target = q.correct;
    const closest =
      this.game.phase !== 'question' && target !== null
        ? [...guesses]
            .sort((x, y) => Math.abs(x.v - target) - Math.abs(y.v - target) || x.a.elapsed - y.a.elapsed)
            .slice(0, 3)
            .map(({ a, v }) => ({ name: this.players.get(a.pid)?.name ?? '?', avatar: this.players.get(a.pid)?.avatar ?? '🙂', value: v }))
        : [];
    return {
      kind: 'numbers',
      values: guesses.slice(0, 1000).map((g) => g.v),
      median: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
      closest,
      total: guesses.length,
    };
  }

  private modItems(): ModItem[] {
    return this.answers
      .slice(-300)
      .reverse()
      .flatMap((a) =>
        'text' in a.value ? [{ id: a.id, text: a.value.text, name: this.players.get(a.pid)?.name ?? '?', hidden: a.hidden, at: a.at }] : [],
      );
  }

  private roster(): AdminPlayer[] {
    const online = this.onlinePids();
    return this.ranking().map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, online: online.has(p.id), joinedAt: p.joinedAt }));
  }

  private adminMsg(full: boolean, dirty: Set<Dirty> = new Set()): string {
    const q = this.current();
    const inQ = q !== null && (this.game.phase === 'question' || this.game.phase === 'results');
    const msg: AdminMsg = {
      t: 'admin',
      now: Date.now(),
      game: this.game,
      results: q && inQ ? this.results(q) : null,
      mod: q && inQ && (q.type === 'open' || q.type === 'wordcloud') ? this.modItems() : null,
      online: this.onlinePids().size,
      total: this.ranking().length,
      answered: inQ ? this.answeredCount() : 0,
      top: this.top(10),
    };
    if (full || dirty.has('questions')) {
      msg.questions = this.questions;
      msg.events = this.events;
      msg.asked = this.asked;
    }
    if (full || dirty.has('players')) msg.players = this.roster();
    return JSON.stringify(msg);
  }

  // ---------- batching ----------

  private touch(...keys: Dirty[]) {
    for (const k of keys) this.dirty.add(k);
    this.flushTimer ??= setTimeout(() => this.flush(), FLUSH_MS);
  }

  private flush() {
    this.flushTimer = null;
    const dirty = this.dirty;
    this.dirty = new Set();
    const conns = this.conns();
    if (dirty.has('live') || dirty.has('players')) {
      const q = this.current();
      const inQ = q !== null && (this.game.phase === 'question' || this.game.phase === 'results');
      const live: LiveMsg = {
        t: 'live',
        now: Date.now(),
        qid: this.game.qid,
        online: this.onlinePids().size,
        answered: inQ ? this.answeredCount() : 0,
        results:
          q && this.game.phase === 'question' && q.showOnPhones && (q.type === 'poll' || q.type === 'scale' || q.type === 'awesome')
            ? this.results(q)
            : null,
      };
      const s = JSON.stringify(live);
      for (const { ws, att } of conns) if (att?.kind === 'player') this.raw(ws, s);
    }
    const hosts = conns.filter((c) => c.att?.kind === 'admin');
    if (hosts.length > 0 && dirty.size > 0) {
      const s = this.adminMsg(false, dirty);
      for (const { ws } of hosts) this.raw(ws, s);
    }
    if (hosts.length > 0 && Object.keys(this.rx).length > 0) {
      const s = JSON.stringify({ t: 'rx', r: this.rx } satisfies ServerMsg);
      for (const { ws } of hosts) this.raw(ws, s);
    }
    this.rx = {};
  }

  // ---------- storage + socket helpers ----------

  private remember(p: Player) {
    this.players.set(p.id, p);
    this.byToken.set(p.token, p.id);
    this.byKey.set(p.key, p.id);
  }

  private loadAnswers(qid: string) {
    this.answers = this.sql
      .exec<AnswerRow>('SELECT id, pid, ref, value, at, elapsed, points, hidden FROM answers WHERE qid = ? ORDER BY id', qid)
      .toArray()
      .map((r) => ({
        id: r.id, pid: r.pid, ref: r.ref, value: JSON.parse(r.value) as AnswerValue,
        at: r.at, elapsed: r.elapsed, points: r.points, hidden: r.hidden === 1,
      }));
  }

  private meta<T>(k: string): T | null {
    const row = this.sql.exec<{ v: string }>('SELECT v FROM meta WHERE k = ?', k).toArray()[0];
    return row ? (JSON.parse(row.v) as T) : null;
  }

  private setMeta(k: string, v: unknown) {
    this.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v', k, JSON.stringify(v));
  }

  private saveGame() {
    this.setMeta('game', this.game);
  }

  private send(ws: WebSocket, m: ServerMsg) {
    this.raw(ws, JSON.stringify(m));
  }

  private raw(ws: WebSocket, s: string) {
    try {
      ws.send(s);
    } catch {
      // socket is already closing; the reconnect path will resync it
    }
  }

  private fail(ws: WebSocket, code: ErrorCode, message: string) {
    this.send(ws, { t: 'error', code, message });
  }

  private ack(ws: WebSocket, ref: string, ok: boolean, code?: ErrorCode) {
    this.send(ws, { t: 'ack', ref, ok, code });
  }
}
