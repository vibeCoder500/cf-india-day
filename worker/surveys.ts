import type { ErrorCode, Results, ServerMsg } from '../shared/protocol';
import type { AdminSurvey, PublicSurvey, SurveyAnswers, SurveyCard, SurveyClientMsg, SurveyData, SurveyQuestion } from '../shared/survey';
import {
  AUTO_FINALIZE_DAYS, DAY_MS, DEVICE_RE, SURVEY_GRACE_MS, SURVEY_LIMITS, endOfIstDay, istDay, surveyStatus,
} from '../shared/survey';
import { cut } from './validate';
import { parseSurveyAnswers, parseSurveyDraft } from './survey-validate';

// What the survey module needs from the GameRoom. It never reads or writes game state.
export interface SurveyHost {
  sockets(): { ws: WebSocket; kind: 'anon' | 'player' | 'admin' }[];
}

// Respondents never log in (the /survey site), so everyone who isn't a host is just "public".
export type SurveyCaller = { kind: 'public' } | { kind: 'admin' };

// Successful sends per connection: a real person sends one; this only slows down a script on a single socket.
const SENDS_PER_SOCKET = 3;

// Stored as JSON in surveys.data. The fingerprint key lives only in surveys.salt and never leaves this file.
type Rec = AdminSurvey;

// sql.exec<T> needs `type` aliases (PLAN.md §22.3).
type SurveyRow = { data: string; salt: string | null };
type IdRow = { id: string };
type DayRow = { day: string; n: number };
type ResponseRow = { id: string; released: number; at: number | null; who: string | null; answers: string; hidden: number };

interface Resp {
  id: string;
  released: boolean;
  at: number | null;
  who: { name: string; avatar: string } | null;
  answers: SurveyAnswers;
  hidden: boolean;
}

// WITHOUT ROWID + random keys: no table keeps insertion order, so fingerprints can't be lined up with responses,
// and anonymous responses carry no time at all (per-day totals are plain counters).
const SURVEY_SCHEMA = [
  'CREATE TABLE IF NOT EXISTS surveys (id TEXT PRIMARY KEY, data TEXT NOT NULL, salt TEXT)',
  'CREATE TABLE IF NOT EXISTS survey_responses (sid TEXT NOT NULL, id TEXT NOT NULL, released INTEGER NOT NULL, at INTEGER, who TEXT, answers TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (sid, id)) WITHOUT ROWID',
  'CREATE INDEX IF NOT EXISTS survey_sealed ON survey_responses (sid, released)',
  'CREATE TABLE IF NOT EXISTS survey_ballots (sid TEXT NOT NULL, h TEXT NOT NULL, PRIMARY KEY (sid, h)) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS survey_days (sid TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (sid, day)) WITHOUT ROWID',
];

const ID_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => ID_CHARS[b % 32]).join('');
const randomInt = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function fromB64(s: string): Uint8Array {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
}
const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(32)));

const toResp = (r: ResponseRow): Resp => ({
  id: r.id,
  released: r.released === 1,
  at: r.at,
  who: r.who ? (JSON.parse(r.who) as Resp['who']) : null,
  answers: JSON.parse(r.answers) as SurveyAnswers,
  hidden: r.hidden === 1,
});

export class Surveys {
  private list: Rec[] = [];
  private salts = new Map<string, string>(); // survey id -> secret, only while launched and not finalized
  private keys = new Map<string, Promise<CryptoKey>>(); // secret -> imported HMAC key
  private cache = new Map<string, Resp[]>(); // parsed responses, loaded when a host first asks
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastPublic = ''; // the live survey as phones last saw it
  private sends = new WeakMap<WebSocket, number>();

  constructor(
    private ctx: DurableObjectState,
    private sql: SqlStorage,
    private host: SurveyHost,
  ) {
    this.init();
  }

  // Constructor, and again after "Wipe everything" (deleteAll drops these tables too).
  init() {
    for (const s of SURVEY_SCHEMA) this.sql.exec(s);
    this.list = [];
    this.salts.clear();
    for (const r of this.sql.exec<SurveyRow>('SELECT data, salt FROM surveys')) {
      const s = JSON.parse(r.data) as Rec;
      // Responses are shown one by one now (no groups). Older surveys switch over unless some responses are still
      // sealed: those were promised a group, so they keep it until they're revealed at closing.
      if (s.k > 1 && s.pending === 0) {
        s.k = 1;
        this.sql.exec('UPDATE surveys SET data = ? WHERE id = ?', JSON.stringify(s), s.id);
      }
      this.list.push(s);
      if (r.salt) this.salts.set(s.id, r.salt);
    }
    this.list.sort((a, b) => a.createdAt - b.createdAt);
    this.cache.clear();
    this.keys.clear();
    this.lastPublic = '';
    this.sweep();
  }

  // ---------- greetings (called from GameRoom.fetch / welcome) ----------

  helloPublic(ws: WebSocket) {
    this.send(ws, { t: 'survey', now: Date.now(), survey: this.publicOf(this.live()) });
  }

  helloAdmin(ws: WebSocket) {
    this.sweep();
    this.send(ws, this.listMsg());
  }

  // ---------- messages ----------

  async onMessage(ws: WebSocket, caller: SurveyCaller, msg: SurveyClientMsg) {
    this.sweep(); // auto-finalize happens on the first activity after it is due
    if (caller.kind === 'public') {
      if (msg.t === 'survey:check') return this.check(ws, msg.sid, msg.device);
      if (msg.t === 'survey:submit') return this.submit(ws, msg);
      return this.fail(ws, 'NOT_ALLOWED', 'Not allowed');
    }
    switch (msg.t) {
      case 'survey:save':
        return this.save(ws, msg.survey);
      case 'survey:launch':
        return this.launch(ws, msg);
      case 'survey:extend':
        return this.extend(ws, msg.id, msg.days);
      case 'survey:close':
        return this.close(msg.id);
      case 'survey:finalize': {
        const s = this.byId(msg.id);
        if (!s || s.finalized || s.closesAt === null) return;
        if (Date.now() <= s.closesAt + SURVEY_GRACE_MS) {
          return this.fail(ws, 'NOT_ALLOWED', 'Close the survey first (late answers still count for 2 minutes after closing)');
        }
        return this.finalize(s);
      }
      case 'survey:duplicate':
        return this.duplicate(ws, msg.id);
      case 'survey:delete':
        return this.remove(msg.id);
      case 'survey:reset':
        return this.reset(msg.id);
      case 'survey:hide':
        return this.hide(msg.id, msg.rid, msg.hidden);
      case 'survey:data': {
        const s = this.byId(msg.id);
        if (s) this.send(ws, { t: 'survey:data', now: Date.now(), data: this.dataOf(s) });
        return;
      }
      default:
        return this.fail(ws, 'NOT_ALLOWED', 'Unknown action');
    }
  }

  // ---------- respondents ----------

  // Device only: checking a name would let anyone test whether a colleague has responded.
  private async check(ws: WebSocket, sid: unknown, device: unknown) {
    if (typeof device !== 'string' || !DEVICE_RE.test(device)) return;
    const s = this.byId(sid);
    if (!s || s.opensAt === null) return;
    const fp = await this.fingerprints(s, [`d:${device}`]);
    this.send(ws, { t: 'survey:me', sid: s.id, done: fp !== null && this.hasBallot(s.id, fp.hs[0]) });
  }

  // No logins: one response per device, recognised by a keyed fingerprint of the device id.
  private async submit(ws: WebSocket, msg: Extract<SurveyClientMsg, { t: 'survey:submit' }>) {
    const { ref, device } = msg;
    if (typeof ref !== 'string' || !ref || ref.length > 40) return;
    const ack = (ok: boolean, code?: ErrorCode) => this.send(ws, { t: 'survey:ack', ref, ok, code });
    if (typeof device !== 'string' || !DEVICE_RE.test(device)) return ack(false, 'BAD_REQUEST');
    const s = this.byId(msg.sid);
    if (!s || !this.accepting(s, Date.now())) return ack(false, 'CLOSED');
    const answers = parseSurveyAnswers(s.questions, msg.answers);
    if (!answers) return ack(false, 'BAD_REQUEST');
    if ((this.sends.get(ws) ?? 0) >= SENDS_PER_SOCKET) return ack(false, 'RATE_LIMIT');

    // Fingerprinting awaits crypto, and other messages can run meanwhile (input gates only cover storage). If a reset
    // swapped the secret during the await, fingerprint again with the new one, so dedupe never uses a stale key.
    let fp: { salt: string; hs: string[] } | null = null;
    for (let i = 0; i < 3 && (fp === null || this.salts.get(s.id) !== fp.salt); i++) {
      fp = await this.fingerprints(s, [`d:${device}`]);
      if (!fp) break;
    }

    // Synchronous from here on: no other message can run between the checks and the insert.
    const now = Date.now();
    if (!fp || this.salts.get(s.id) !== fp.salt || this.byId(s.id) !== s || !this.accepting(s, now)) return ack(false, 'CLOSED');
    const [hd] = fp.hs;
    if (this.hasBallot(s.id, hd)) return ack(false, 'ALREADY_ANSWERED'); // this device (also a retry whose ack got lost)
    if (s.n >= SURVEY_LIMITS.responses) return ack(false, 'LIMIT');
    const sealed = s.anonymous && s.k > 1;
    const r: Resp = { id: randomId(), released: !sealed, at: s.anonymous ? null : now, who: null, answers, hidden: false };
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('INSERT INTO survey_ballots (sid, h) VALUES (?, ?)', s.id, hd);
      this.sql.exec(
        'INSERT INTO survey_responses (sid, id, released, at, who, answers) VALUES (?, ?, ?, ?, NULL, ?)',
        s.id, r.id, r.released ? 1 : 0, r.at, JSON.stringify(answers),
      );
      this.sql.exec('INSERT INTO survey_days (sid, day, n) VALUES (?, ?, 1) ON CONFLICT (sid, day) DO UPDATE SET n = n + 1', s.id, istDay(now));
    });
    this.sends.set(ws, (this.sends.get(ws) ?? 0) + 1);
    this.cache.get(s.id)?.push(r);
    s.n++;
    if (sealed) s.pending++;
    // Older grouped surveys only: keep at least k sealed while live, so every reveal holds k or more responses.
    if (sealed && s.pending >= 2 * s.k) this.reveal(s, s.k);
    this.bump(s);
    ack(true);
    this.send(ws, { t: 'survey:me', sid: s.id, done: true });
    this.toAdminsSoon();
  }

  private accepting(s: Rec, now: number): boolean {
    return s.opensAt !== null && s.closesAt !== null && !s.finalized && now <= s.closesAt + SURVEY_GRACE_MS;
  }

  // The one survey phones can answer: live, or within its grace period (late answers still count).
  private busy(now = Date.now()): Rec | undefined {
    return this.list.find((s) => this.accepting(s, now));
  }

  private busyMessage(s: Rec): string {
    return surveyStatus(s, Date.now()) === 'live'
      ? `“${s.title}” is live — close it first`
      : `“${s.title}” just closed — late answers count for 2 more minutes, then try again`;
  }

  // Keyed one-way fingerprints: HMAC-SHA-256 with the survey's random secret.
  private async fingerprints(s: Rec, texts: string[]): Promise<{ salt: string; hs: string[] } | null> {
    const salt = this.salts.get(s.id);
    if (!salt) return null; // draft or finalized
    let key = this.keys.get(salt);
    if (!key) {
      key = crypto.subtle.importKey('raw', fromB64(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      this.keys.set(salt, key);
    }
    const k = await key;
    const enc = new TextEncoder();
    const hs = await Promise.all(texts.map(async (t) => b64(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(t))))));
    return { salt, hs };
  }

  // The survey's secret, in SQL and in memory: a new one at launch and on reset, none for drafts and once finalized.
  private setSalt(sid: string, salt: string | null) {
    const old = this.salts.get(sid);
    if (old) this.keys.delete(old);
    if (salt) this.salts.set(sid, salt);
    else this.salts.delete(sid);
    this.sql.exec('UPDATE surveys SET salt = ? WHERE id = ?', salt, sid);
  }

  private hasBallot(sid: string, h: string): boolean {
    return this.sql.exec('SELECT 1 FROM survey_ballots WHERE sid = ? AND h = ?', sid, h).toArray().length > 0;
  }

  // Reveals `count` random sealed responses (all of them when count >= pending). Caller bumps.
  private reveal(s: Rec, count: number) {
    const ids = this.sql.exec<IdRow>('SELECT id FROM survey_responses WHERE sid = ? AND released = 0', s.id).toArray().map((r) => r.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const pick = new Set(ids.slice(0, count));
    this.ctx.storage.transactionSync(() => {
      for (const id of pick) this.sql.exec('UPDATE survey_responses SET released = 1 WHERE sid = ? AND id = ?', s.id, id);
    });
    for (const r of this.cache.get(s.id) ?? []) if (pick.has(r.id)) r.released = true;
    s.pending = ids.length - pick.size;
  }

  // Once nobody can submit any more (deadline + grace), the sealed responses are revealed together, if there are
  // at least k of them. Fewer than k stay sealed for good: revealing them would point at the last few people.
  private settle(s: Rec): boolean {
    if (s.pending < s.k || s.closesAt === null || Date.now() <= s.closesAt + SURVEY_GRACE_MS) return false;
    this.reveal(s, s.pending);
    this.bump(s);
    return true;
  }

  // Closed for a week: reveal what can be revealed, then erase the fingerprints.
  private sweep() {
    const now = Date.now();
    let moved = false;
    for (const s of this.list) {
      if (s.closesAt === null || now <= s.closesAt + SURVEY_GRACE_MS) continue;
      moved = this.settle(s) || moved;
      if (!s.finalized && now > s.closesAt + AUTO_FINALIZE_DAYS * DAY_MS) {
        this.finalize(s);
        moved = true;
      }
    }
    if (moved) this.toAdminsSoon();
  }

  // ---------- hosts ----------

  private save(ws: WebSocket, raw: unknown) {
    const d = parseSurveyDraft(raw, randomId);
    if (!d) return this.fail(ws, 'BAD_REQUEST', 'Please check the survey — it needs a title, and every question needs its text and options');
    const s = this.byId(d.id);
    if (!s) {
      if (this.list.length >= SURVEY_LIMITS.surveys) return this.fail(ws, 'LIMIT', `Up to ${SURVEY_LIMITS.surveys} surveys — delete an old one first`);
      const rec: Rec = {
        ...d, id: randomId(), createdAt: Date.now(), anonymous: true, k: 1, days: 3, endOfDay: true,
        opensAt: null, closesAt: null, finalized: false, rev: 0, n: 0, pending: 0,
      };
      this.list.push(rec);
      this.sql.exec('INSERT INTO surveys (id, data, salt) VALUES (?, ?, NULL)', rec.id, JSON.stringify(rec));
      return this.toAdminsSoon();
    }
    // Once launched, answers point at the questions, so only the wording around them can change.
    Object.assign(s, { title: d.title, intro: d.intro, thanks: d.thanks }, s.opensAt === null ? { questions: d.questions } : {});
    this.bump(s);
    this.changed();
  }

  private launch(ws: WebSocket, msg: Extract<SurveyClientMsg, { t: 'survey:launch' }>) {
    const s = this.byId(msg.id);
    if (!s) return;
    if (s.opensAt !== null) return this.fail(ws, 'NOT_ALLOWED', 'Already launched — extend it, or duplicate it for a new run');
    if (s.questions.length === 0) return this.fail(ws, 'BAD_REQUEST', 'Add at least one question first');
    const other = this.busy();
    if (other) return this.fail(ws, 'NOT_ALLOWED', this.busyMessage(other));
    const days = msg.days;
    if (!Number.isInteger(days) || days < 1 || days > SURVEY_LIMITS.days) return this.fail(ws, 'BAD_REQUEST', `Pick 1–${SURVEY_LIMITS.days} days`);
    const now = Date.now();
    const endOfDay = msg.endOfDay !== false;
    const closesAt = endOfDay ? endOfIstDay(now + days * DAY_MS) : now + days * DAY_MS;
    // Always anonymous (nobody logs in to answer) and shown one by one, as each response arrives.
    const patch: Partial<Rec> = {
      anonymous: true,
      k: 1,
      days: Math.ceil((closesAt - now) / DAY_MS),
      endOfDay,
      opensAt: now,
      closesAt,
      finalized: false,
    };
    Object.assign(s, patch);
    this.setSalt(s.id, newSalt()); // the secret is born at launch
    this.bump(s);
    this.changed();
  }

  private extend(ws: WebSocket, id: unknown, days: unknown) {
    const s = this.byId(id);
    if (!s || s.opensAt === null || s.closesAt === null) return;
    if (!Number.isInteger(days) || (days as number) < 1 || (days as number) > SURVEY_LIMITS.days) {
      return this.fail(ws, 'BAD_REQUEST', `Pick 1–${SURVEY_LIMITS.days} days`);
    }
    if (s.finalized) return this.fail(ws, 'NOT_ALLOWED', 'This survey was finalized — duplicate it to run it again');
    const now = Date.now();
    const other = this.busy(now);
    if (other && other !== s) return this.fail(ws, 'NOT_ALLOWED', this.busyMessage(other));
    const target = Math.max(s.closesAt, now) + (days as number) * DAY_MS;
    const closesAt = s.endOfDay ? endOfIstDay(target) : target;
    if (closesAt - s.opensAt > SURVEY_LIMITS.totalDays * DAY_MS) {
      return this.fail(ws, 'LIMIT', `A survey can run for up to ${SURVEY_LIMITS.totalDays} days`);
    }
    Object.assign(s, { closesAt, days: Math.ceil((closesAt - s.opensAt) / DAY_MS) });
    this.bump(s);
    this.changed();
  }

  private close(id: unknown) {
    const s = this.byId(id);
    if (!s || surveyStatus(s, Date.now()) !== 'live') return;
    s.closesAt = Date.now();
    this.bump(s);
    this.changed();
  }

  // Erases the fingerprints and their secret: nobody can ever check who responded, and the survey can't reopen.
  // Callers make sure the grace period is over; whatever can be revealed is revealed first, so results stop changing.
  private finalize(s: Rec) {
    this.settle(s);
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM survey_ballots WHERE sid = ?', s.id);
      this.setSalt(s.id, null);
    });
    s.finalized = true;
    this.bump(s);
    this.changed();
  }

  private duplicate(ws: WebSocket, id: unknown) {
    const s = this.byId(id);
    if (!s) return;
    if (this.list.length >= SURVEY_LIMITS.surveys) return this.fail(ws, 'LIMIT', `Up to ${SURVEY_LIMITS.surveys} surveys — delete an old one first`);
    const copy: Rec = {
      id: randomId(), title: cut(`${s.title} (copy)`, SURVEY_LIMITS.title), intro: s.intro, thanks: s.thanks,
      questions: structuredClone(s.questions), createdAt: Date.now(), anonymous: true, k: 1, days: s.days,
      endOfDay: s.endOfDay, opensAt: null, closesAt: null, finalized: false, rev: 0, n: 0, pending: 0,
    };
    this.list.push(copy);
    this.sql.exec('INSERT INTO surveys (id, data, salt) VALUES (?, ?, NULL)', copy.id, JSON.stringify(copy));
    this.toAdminsSoon();
  }

  private remove(id: unknown) {
    const s = this.byId(id);
    if (!s) return;
    this.ctx.storage.transactionSync(() => {
      for (const t of ['survey_responses', 'survey_ballots', 'survey_days']) this.sql.exec(`DELETE FROM ${t} WHERE sid = ?`, s.id);
      this.sql.exec('DELETE FROM surveys WHERE id = ?', s.id);
    });
    this.list = this.list.filter((x) => x !== s);
    this.cache.delete(s.id);
    const salt = this.salts.get(s.id);
    if (salt) this.keys.delete(salt);
    this.salts.delete(s.id);
    this.changed();
  }

  // For test runs: responses, fingerprints and counters go (with a fresh secret); the survey and its deadline stay.
  private reset(id: unknown) {
    const s = this.byId(id);
    if (!s) return;
    this.ctx.storage.transactionSync(() => {
      for (const t of ['survey_responses', 'survey_ballots', 'survey_days']) this.sql.exec(`DELETE FROM ${t} WHERE sid = ?`, s.id);
      if (s.opensAt !== null && !s.finalized) this.setSalt(s.id, newSalt());
    });
    this.cache.delete(s.id);
    Object.assign(s, { n: 0, pending: 0 });
    this.bump(s);
    this.changed(true); // phones re-check, so "already responded" clears
  }

  private hide(id: unknown, rid: unknown, hidden: unknown) {
    const s = this.byId(id);
    if (!s || typeof rid !== 'string') return;
    const on = hidden === true;
    // Only revealed responses can be hidden: the host never gets ids of sealed ones.
    const hit = this.sql.exec('UPDATE survey_responses SET hidden = ? WHERE sid = ? AND id = ? AND released = 1 RETURNING id', on ? 1 : 0, s.id, rid).toArray();
    if (hit.length === 0) return;
    const r = this.cache.get(s.id)?.find((x) => x.id === rid);
    if (r) r.hidden = on;
    this.bump(s);
    this.toAdminsSoon();
  }

  // ---------- views ----------

  private byId(id: unknown): Rec | undefined {
    return typeof id === 'string' ? this.list.find((s) => s.id === id) : undefined;
  }

  private live(): Rec | undefined {
    const now = Date.now();
    return this.list.find((s) => surveyStatus(s, now) === 'live');
  }

  private publicOf(s: Rec | undefined): PublicSurvey | null {
    if (!s || s.closesAt === null) return null;
    return { id: s.id, title: s.title, intro: s.intro, thanks: s.thanks, anonymous: s.anonymous, k: s.k, closesAt: s.closesAt, questions: s.questions };
  }

  private listMsg(): ServerMsg {
    return { t: 'surveys', now: Date.now(), list: this.list };
  }

  private responses(sid: string): Resp[] {
    let list = this.cache.get(sid);
    if (!list) {
      list = this.sql
        .exec<ResponseRow>('SELECT id, released, at, who, answers, hidden FROM survey_responses WHERE sid = ?', sid)
        .toArray()
        .map(toResp);
      this.cache.set(sid, list);
    }
    return list;
  }

  private dataOf(s: Rec): SurveyData {
    if (this.settle(s)) this.toAdminsSoon();
    const released = this.responses(s.id)
      .filter((r) => r.released)
      .sort((a, b) => (s.anonymous ? (a.id < b.id ? -1 : 1) : (b.at ?? 0) - (a.at ?? 0)));
    const visible = released.filter((r) => !r.hidden);
    const perDay = this.sql.exec<DayRow>('SELECT day, n FROM survey_days WHERE sid = ? ORDER BY day', s.id).toArray();
    const cards: SurveyCard[] = released.map((r) => ({ id: r.id, hidden: r.hidden, who: r.who, at: r.at, answers: r.answers }));
    return {
      sid: s.id,
      rev: s.rev,
      n: s.n,
      released: released.length,
      sealed: s.pending,
      hidden: released.length - visible.length,
      perDay,
      questions: s.questions.map((q) => ({ qid: q.id, ...aggregate(q, visible) })),
      cards,
    };
  }

  // ---------- fan-out ----------

  private bump(s: Rec) {
    s.rev++;
    this.sql.exec('UPDATE surveys SET data = ? WHERE id = ?', JSON.stringify(s), s.id);
  }

  // Hosts get the (small) list and refetch results whose rev moved. The survey site (sockets that never log in) only
  // hears about the live survey, and only when what it would see changed (or when forced, so "already responded" is
  // re-checked after a reset). Game players and hosts don't need it.
  private changed(forcePlayers = false) {
    this.toPlayers(forcePlayers);
    this.toAdminsSoon();
  }

  private toPlayers(force = false) {
    const survey = this.publicOf(this.live());
    const key = JSON.stringify(survey);
    if (!force && key === this.lastPublic) return;
    this.lastPublic = key;
    const m = JSON.stringify({ t: 'survey', now: Date.now(), survey } satisfies ServerMsg);
    for (const c of this.host.sockets()) if (c.kind === 'anon') this.raw(c.ws, m);
  }

  private toAdminsSoon() {
    this.timer ??= setTimeout(() => {
      this.timer = null;
      const m = JSON.stringify(this.listMsg());
      for (const c of this.host.sockets()) if (c.kind === 'admin') this.raw(c.ws, m);
    }, 500);
  }

  private send(ws: WebSocket, m: ServerMsg) {
    this.raw(ws, JSON.stringify(m));
  }

  private raw(ws: WebSocket, s: string) {
    try {
      ws.send(s);
    } catch {
      // closing; the reconnect resyncs it
    }
  }

  private fail(ws: WebSocket, code: ErrorCode, message: string) {
    this.send(ws, { t: 'error', code, message });
  }
}

// Same shapes as the live game's results, so the existing charts render them unchanged.
function aggregate(q: SurveyQuestion, rs: Resp[]): { answered: number; results: Results } {
  const got = rs.flatMap((r) => (r.answers[q.id] ? [r.answers[q.id]] : []));
  const answered = got.length;
  switch (q.type) {
    case 'poll':
    case 'animal':
    case 'multi': {
      const counts = q.options.map(() => 0);
      for (const a of got) {
        for (const i of 'choice' in a ? [a.choice] : 'choices' in a ? a.choices : []) if (i >= 0 && i < counts.length) counts[i]++;
      }
      return { answered, results: { kind: 'choice', counts, total: answered, fastest: null } };
    }
    case 'scale':
    case 'awesome': {
      const counts = Array.from({ length: q.max - q.min + 1 }, () => 0);
      let sum = 0;
      for (const a of got) {
        if (!('rating' in a) || a.rating < q.min || a.rating > q.max) continue;
        counts[a.rating - q.min]++;
        sum += a.rating;
      }
      const total = counts.reduce((x, y) => x + y, 0);
      return { answered, results: { kind: 'scale', counts, avg: total ? Math.round((sum / total) * 10) / 10 : 0, total } };
    }
    case 'wordcloud': {
      const words = new Map<string, { text: string; count: number }>();
      let total = 0;
      for (const a of got) {
        if (!('texts' in a)) continue;
        for (const t of a.texts) {
          total++;
          const lower = t.toLowerCase();
          const key = lower.replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '') || lower;
          const hit = words.get(key);
          if (hit) hit.count++;
          else words.set(key, { text: t, count: 1 });
        }
      }
      return { answered, results: { kind: 'words', words: [...words.values()].sort((x, y) => y.count - x.count).slice(0, 80), total } };
    }
    case 'open': {
      // The comment list is built from the response cards (so each comment can be hidden); this is only the count.
      return { answered, results: { kind: 'texts', items: [], total: answered } };
    }
  }
}
