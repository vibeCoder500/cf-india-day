// Festive loop synthesised with the Web Audio API: dhol-style drums, bass and a tumbi-style riff.
// No audio files, so there is nothing to license or download.

const BPM = 124;
const STEP = 60 / BPM / 4; // one sixteenth note, in seconds
const BAR = 16;
const LOOP = BAR * 4;
const VOLUME = 0.45;
const MUTE_KEY = 'cfid.muted';

const DAGGA = [0, 3, 8, 11]; // low, booming side of the dhol
const TILLI = [2, 6, 7, 10, 14, 15]; // high, cracking side
const CLAPS = [4, 12];
const ROOTS = [38, 43, 45, 38]; // D G A D
const BASS: [step: number, semitones: number][] = [[0, 0], [3, 12], [8, 0], [11, 12], [14, 7]];
const RIFF_A = [[0, 86], [2, 86], [3, 83], [4, 81], [6, 83], [7, 86], [8, 88], [10, 86], [11, 83], [12, 81], [14, 78]];
const RIFF_B = [[0, 81], [2, 81], [3, 83], [4, 86], [6, 83], [7, 81], [8, 78], [10, 76], [12, 78], [14, 81]];
const RIFF_C = [[0, 81], [2, 83], [3, 86], [4, 88], [6, 86], [7, 83], [8, 81], [10, 78], [12, 76], [14, 74]];
const LEAD = new Map<number, number>(
  [RIFF_A, RIFF_B, RIFF_A, RIFF_C].flatMap((riff, bar) => riff.map(([s, midi]): [number, number] => [bar * BAR + s, midi])),
);

type Rig = { ctx: AudioContext; out: GainNode; noise: AudioBuffer };
export type MusicStatus = 'off' | 'blocked' | 'playing';

let rig: Rig | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextAt = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function getRig(): Rig {
  if (rig) return rig;
  const ctx = new AudioContext();
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  ctx.onstatechange = notify;
  // Browsers only let a page make sound after a tap, click or key press.
  const unlock = () => {
    if (timer && ctx.state !== 'running') void ctx.resume();
  };
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) document.addEventListener(type, unlock, true);
  rig = { ctx, out, noise };
  return rig;
}

function envelope(r: Rig, t: number, peak: number, decay: number): GainNode {
  const g = r.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.connect(r.out);
  return g;
}

function tone(r: Rig, t: number, type: OscillatorType, from: number, to: number, peak: number, decay: number) {
  const o = r.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + decay * 0.8);
  o.connect(envelope(r, t, peak, decay));
  o.start(t);
  o.stop(t + decay + 0.02);
}

function hiss(r: Rig, t: number, type: BiquadFilterType, freq: number, peak: number, decay: number) {
  const src = r.ctx.createBufferSource();
  src.buffer = r.noise;
  const f = r.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  src.connect(f).connect(envelope(r, t, peak, decay));
  src.start(t, Math.random() * 0.5);
  src.stop(t + decay + 0.02);
}

function pluck(r: Rig, t: number, midi: number) {
  const o = r.ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = hz(midi);
  const f = r.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 5;
  f.frequency.setValueAtTime(5000, t);
  f.frequency.exponentialRampToValueAtTime(700, t + 0.22);
  o.connect(f).connect(envelope(r, t, 0.16, 0.26));
  o.start(t);
  o.stop(t + 0.3);
}

function playStep(r: Rig, s: number, at: number) {
  const t = at + (s % 2 ? STEP * 0.16 : 0); // a little swing
  const b = s % BAR;
  const root = ROOTS[Math.floor(s / BAR)];
  if (DAGGA.includes(b)) tone(r, t, 'sine', 140, 48, 0.9, 0.38);
  if (TILLI.includes(b)) {
    hiss(r, t, 'bandpass', 2600, 0.3, 0.08);
    tone(r, t, 'triangle', 440, 300, 0.18, 0.09);
  }
  if (CLAPS.includes(b)) for (const d of [0, 0.011, 0.022]) hiss(r, t + d, 'bandpass', 1500, 0.28, 0.11);
  if (b % 2 === 0) hiss(r, t, 'highpass', 7500, b % 4 === 2 ? 0.07 : 0.04, 0.035);
  for (const [at16, semis] of BASS) if (at16 === b) tone(r, t, 'triangle', hz(root + semis), hz(root + semis), 0.45, STEP * 2.6);
  const note = LEAD.get(s);
  if (note) pluck(r, t, note);
}

function tick() {
  if (!rig) return;
  const now = rig.ctx.currentTime;
  if (nextAt < now) nextAt = now + 0.05; // skip notes missed while the tab was busy
  while (nextAt < now + 0.25) {
    playStep(rig, step, nextAt);
    nextAt += STEP;
    step = (step + 1) % LOOP;
  }
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    // storage blocked: the choice lasts for this page only
  }
}

export function musicStatus(): MusicStatus {
  if (!timer || !rig) return 'off';
  return rig.ctx.state === 'running' ? 'playing' : 'blocked';
}

export const BEAT_MS = 60_000 / BPM;

// When the next beat will be heard, on the performance.now() clock; null while the music isn't audible.
export function nextBeatAt(): number | null {
  if (!rig || musicStatus() !== 'playing') return null;
  const { ctx } = rig;
  const beat = nextAt + ((4 - (step % 4)) % 4) * STEP;
  return performance.now() + (beat - ctx.currentTime + (ctx.outputLatency || ctx.baseLatency || 0)) * 1000;
}

export function onMusicChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function startMusic() {
  if (timer || isMuted()) return;
  const r = getRig();
  const now = r.ctx.currentTime;
  r.out.gain.cancelScheduledValues(now);
  r.out.gain.setValueAtTime(r.out.gain.value, now);
  r.out.gain.linearRampToValueAtTime(VOLUME, now + 0.6);
  step = 0;
  nextAt = now + 0.05;
  timer = setInterval(tick, 50);
  tick();
  r.ctx.resume().catch(() => undefined);
  notify();
}

export function stopMusic(fadeMs = 1200) {
  if (!timer || !rig) return;
  const { ctx, out } = rig;
  const id = timer;
  timer = null;
  const now = ctx.currentTime;
  out.gain.cancelScheduledValues(now);
  if (ctx.state !== 'running') {
    // Never became audible: silence it at once instead of fading in the moment it unlocks.
    out.gain.setValueAtTime(0, now);
    clearInterval(id);
    void ctx.suspend();
  } else {
    out.gain.setValueAtTime(out.gain.value, now);
    out.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
    setTimeout(() => {
      clearInterval(id);
      if (!timer) void ctx.suspend();
    }, fadeMs);
  }
  notify();
}
