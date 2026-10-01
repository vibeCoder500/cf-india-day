import type { Person } from '../components/Caricature';

// The zoomies' funny sounds, synthesised so there are no audio files to ship.
export type Sfx = { ctx: AudioContext; out: GainNode; noise: AudioBuffer; busyUntil: number; nap?: ReturnType<typeof setTimeout> };
// One runner's sound channel, panned to where it is on screen.
export type Track = { ctx: BaseAudioContext; dest: AudioNode; noise: AudioBuffer };

let sfx: Sfx | null = null;
const UNLOCK = ['pointerup', 'touchend', 'keydown', 'click'];

function create(): Sfx {
  const ctx = new AudioContext();
  const out = ctx.createGain();
  out.gain.value = 0.8;
  out.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return { ctx, out, noise, busyUntil: 0 };
}

// Puts the audio to sleep once nothing is playing, to spare phone batteries.
function napSoon(a: Sfx) {
  clearTimeout(a.nap);
  a.nap = setTimeout(
    () => {
      if (a.ctx.currentTime >= a.busyUntil) void a.ctx.suspend();
    },
    Math.max(0, a.busyUntil - a.ctx.currentTime) * 1000 + 400,
  );
}

// Browsers only allow sound after a tap or key press: the first one wakes the audio. Returns a cleanup.
export function unlockOnTap(): () => void {
  const stop = () => {
    for (const type of UNLOCK) document.removeEventListener(type, unlock, true);
  };
  const unlock = () => {
    const a = (sfx ??= create());
    a.ctx.resume().then(
      () => {
        stop();
        napSoon(a);
      },
      () => undefined,
    );
  };
  for (const type of UNLOCK) document.addEventListener(type, unlock, true);
  return stop;
}

// The running audio, or null while the browser still blocks it (no tap yet) or it takes too long to wake.
export async function awake(timeoutMs: number): Promise<Sfx | null> {
  const a = sfx;
  if (!a) return null;
  clearTimeout(a.nap);
  const ok = await Promise.race([
    a.ctx.resume().then(
      () => true,
      () => false,
    ),
    new Promise<boolean>((done) => setTimeout(done, timeoutMs, false)),
  ]);
  if (!ok) napSoon(a);
  return ok ? a : null;
}

export function restAfter(a: Sfx, end: number) {
  a.busyUntil = Math.max(a.busyUntil, end);
  napSoon(a);
}

// Pans through [time, pan] points (pan: -1 left … 1 right), following the runner across the screen.
export function track(a: Sfx, path: [at: number, pan: number][]): Track {
  const panner = a.ctx.createStereoPanner();
  panner.pan.setValueAtTime(path[0][1], path[0][0]);
  for (const [at, pan] of path.slice(1)) panner.pan.linearRampToValueAtTime(pan, at);
  panner.connect(a.out);
  return { ctx: a.ctx, dest: panner, noise: a.noise };
}

// A gain that swells to `peak`, holds, and fades out by `end`, feeding the track.
function env(t: Track, at: number, peak: number, attack: number, end: number, hold = 0): GainNode {
  const g = t.ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  if (hold) g.gain.setValueAtTime(peak, at + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  g.connect(t.dest);
  return g;
}

// An oscillator gliding through [seconds after `at`, Hz] points.
function glide(t: Track, type: OscillatorType, at: number, points: [number, number][], dest: AudioNode): OscillatorNode {
  const osc = t.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(points[0][1], at);
  for (const [s, hz] of points.slice(1)) osc.frequency.exponentialRampToValueAtTime(hz, at + s);
  osc.connect(dest);
  osc.start(at);
  osc.stop(at + points[points.length - 1][0] + 0.05);
  return osc;
}

function bandpass(t: Track, hz: number, q: number): BiquadFilterNode {
  const f = t.ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = hz;
  f.Q.value = q;
  return f;
}

function lowpass(t: Track, hz: number, q = 0.8): BiquadFilterNode {
  const f = t.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = hz;
  f.Q.value = q;
  return f;
}

// A soft footstep tick.
export function step(t: Track, at: number, level: number) {
  glide(t, 'triangle', at, [[0, 1500], [0.05, 600]], env(t, at, level, 0.004, at + 0.07));
}

// A cartoon "boing" for each hop.
export function hop(t: Track, at: number, level: number, pitch = 1) {
  glide(t, 'sine', at, [[0, 240 * pitch], [0.08, 780 * pitch], [0.18, 560 * pitch]], env(t, at, level, 0.01, at + 0.2));
}

// A swoosh as it spins round.
export function zip(t: Track, at: number) {
  const air = t.ctx.createBufferSource();
  air.buffer = t.noise;
  const band = bandpass(t, 600, 1.2);
  band.frequency.setValueAtTime(600, at);
  band.frequency.exponentialRampToValueAtTime(5000, at + 0.13);
  air.connect(band).connect(env(t, at, 1.2, 0.03, at + 0.16, 0.05));
  air.start(at, Math.random() * 0.5);
  air.stop(at + 0.16);
}

// A slide-whistle "wheee" over a breath of air, falling away at the end like a Doppler shift. Returns when it ends.
export function whee(t: Track, at: number, dur: number, from: number, peak: number, to: number): number {
  const end = at + dur;
  const level = t.ctx.createGain();
  level.gain.setValueAtTime(0.0001, at);
  level.gain.exponentialRampToValueAtTime(0.3, at + 0.06);
  level.gain.setValueAtTime(0.3, at + dur * 0.55);
  level.gain.exponentialRampToValueAtTime(0.0001, end);
  level.connect(t.dest);
  const whistle = glide(t, 'sine', at, [[0, from], [0.2, peak], [dur * 0.6, peak * 0.94], [dur, to]], level);
  const vibrato = t.ctx.createOscillator();
  vibrato.frequency.value = 7;
  const depth = t.ctx.createGain();
  depth.gain.value = peak * 0.03;
  vibrato.connect(depth).connect(whistle.frequency);
  vibrato.start(at);
  vibrato.stop(end + 0.05);

  const air = t.ctx.createBufferSource();
  air.buffer = t.noise;
  air.loop = true;
  const band = bandpass(t, peak * 1.6, 1.4);
  band.frequency.setValueAtTime(peak * 1.6, at);
  band.frequency.exponentialRampToValueAtTime(to, end);
  air.connect(band).connect(env(t, at, 0.1, dur * 0.3, end));
  air.start(at);
  air.stop(end + 0.05);
  return end;
}

// Each costume's signature sound when it's closest. Returns when it ends.
export function voice(t: Track, who: Person, at: number): number {
  switch (who) {
    case 'rockstar': {
      // A power chord through a wah pedal.
      const wah = bandpass(t, 450, 4);
      wah.frequency.setValueAtTime(450, at);
      wah.frequency.exponentialRampToValueAtTime(2200, at + 0.18);
      wah.frequency.exponentialRampToValueAtTime(600, at + 0.5);
      wah.connect(env(t, at, 0.9, 0.01, at + 0.55, 0.2));
      for (const hz of [147, 220, 294]) glide(t, 'sawtooth', at, [[0, hz], [0.55, hz * 0.98]], wah);
      return at + 0.55;
    }
    case 'chef':
      // A pot lid's "clang!": a few out-of-tune partials ringing out.
      for (const [hz, level, ring] of [[520, 0.35, 0.6], [1310, 0.25, 0.45], [2210, 0.18, 0.3], [3450, 0.1, 0.2]]) {
        glide(t, 'sine', at, [[0, hz], [ring, hz * 0.995]], env(t, at, level, 0.003, at + ring));
      }
      return at + 0.6;
    case 'wizard':
      // A magic twinkle running up the scale.
      [1047, 1319, 1568, 2093, 2637, 3136].forEach((hz, i) => {
        const s = at + i * 0.055;
        glide(t, 'sine', s, [[0, hz], [0.18, hz * 1.01]], env(t, s, 0.35, 0.005, s + 0.2));
      });
      return at + 0.5;
    case 'hero':
      // "Ta-daa!": a two-note brass fanfare.
      for (const [d, hz, len] of [[0, 392, 0.12], [0.14, 523, 0.42]]) {
        const brass = lowpass(t, 2600);
        brass.connect(env(t, at + d, 0.18, 0.015, at + d + len, len * 0.6));
        glide(t, 'square', at + d, [[0, hz], [len, hz]], brass);
      }
      return at + 0.56;
    case 'viking': {
      // A blast on a horn.
      const horn = lowpass(t, 900, 1.2);
      horn.connect(env(t, at, 0.25, 0.06, at + 0.7, 0.35));
      glide(t, 'sawtooth', at, [[0, 98], [0.1, 110], [0.7, 104]], horn);
      glide(t, 'sawtooth', at, [[0, 147], [0.1, 165], [0.7, 156]], horn);
      return at + 0.7;
    }
    case 'captain':
      // A sea-shanty "oom-pah" on her accordion, with the musette's slightly detuned second reed.
      for (const [d, chord] of [[0, [196, 247, 294]], [0.24, [262, 330, 392]]] as const) {
        const reed = lowpass(t, 1800, 1);
        reed.connect(env(t, at + d, 0.12, 0.02, at + d + 0.22, 0.1));
        for (const hz of chord) {
          glide(t, 'sawtooth', at + d, [[0, hz], [0.22, hz]], reed);
          glide(t, 'sawtooth', at + d, [[0, hz * 1.006], [0.22, hz * 1.006]], reed);
        }
      }
      return at + 0.5;
  }
}
