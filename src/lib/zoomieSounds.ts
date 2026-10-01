import type { Species } from '../components/Critter';

// The zoomies' funny sounds, synthesised so there are no audio files to ship.
export type Sfx = { ctx: AudioContext; out: GainNode; noise: AudioBuffer; busyUntil: number; nap?: ReturnType<typeof setTimeout> };
// One animal's sound channel, panned to where it is on screen.
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

// Pans through [time, pan] points (pan: -1 left … 1 right), following the animal across the screen.
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

// Each animal's own little cry. Returns when it ends.
export function voice(t: Track, species: Species, at: number): number {
  switch (species) {
    case 'kitten': {
      // "mee-ow": a nasal buzz whose vowel slides from "ee" to "ow"
      const vowel = bandpass(t, 1800, 2);
      vowel.frequency.setValueAtTime(1800, at);
      vowel.frequency.exponentialRampToValueAtTime(2400, at + 0.12);
      vowel.frequency.exponentialRampToValueAtTime(1000, at + 0.5);
      vowel.connect(env(t, at, 1.2, 0.04, at + 0.55, 0.28));
      glide(t, 'sawtooth', at, [[0, 560], [0.18, 840], [0.55, 480]], vowel);
      return at + 0.55;
    }
    case 'puppy':
      // "yip-yip!"
      for (const d of [0, 0.17]) {
        const mouth = bandpass(t, 1300, 1.5);
        mouth.connect(env(t, at + d, 1, 0.012, at + d + 0.13, 0.04));
        glide(t, 'sawtooth', at + d, [[0, 480], [0.03, 920], [0.12, 420]], mouth);
      }
      return at + 0.3;
    case 'squirrel':
      // chitter-chitter
      for (let i = 0; i < 6; i++) {
        const s = at + i * 0.055;
        glide(t, 'triangle', s, [[0, 3400], [0.035, 2200]], env(t, s, 0.65, 0.004, s + 0.04));
      }
      return at + 0.34;
    case 'capybara':
      // "wheek wheek", like its guinea-pig cousins
      for (const [d, up] of [[0, 1], [0.26, 1.12]]) {
        glide(t, 'sine', at + d, [[0, 950 * up], [0.12, 1700 * up], [0.2, 1500 * up]], env(t, at + d, 0.5, 0.02, at + d + 0.22, 0.08));
      }
      return at + 0.5;
  }
}
