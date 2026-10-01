import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { calm } from '../lib/fun';
import { isMuted } from '../lib/music';
import { awake, hop, restAfter, step, track, unlockOnTap, voice, whee, zip } from '../lib/zoomieSounds';
import type { Sfx } from '../lib/zoomieSounds';
import Critter, { SPECIES } from './Critter';
import type { Species } from './Critter';

type Pt = { x: number; y: number }; // screen px
type Base = { id: number; species: Species; width: number; delay: number; pitch: number; rank: number };
// Dash: a straight run across the screen between two off-screen points, leaning into it.
type Dash = Base & { style: 'dash'; from: Pt; to: Pt; lean: number };
// Zoom: appears on the horizon at x `far`, hops up to x `near`, runs off to x `away`.
type Zoom = Base & { style: 'zoom'; far: number; near: number; away: number };
type Run = Dash | Zoom;

const DASH_MS = 1400;
// The 3-D run: hops closer step by step, stops to say hello, turns round and scampers off.
const STEPS = 7;
const STEP_MS = 250;
const PEEK_MS = 560;
const TURN_MS = 160;
const AWAY_MS = 520;
const TURNED_MS = STEPS * STEP_MS + PEEK_MS + TURN_MS;
const ZOOM_MS = TURNED_MS + AWAY_MS;
const FAR = 0.08;
const NEAR = 1.3;
const scaleAt = (step: number) => FAR * (NEAR / FAR) ** (step / STEPS);
const CHORD = [1, 1.26, 1.5]; // one "wheee" per animal, in harmony
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const panOf = (x: number) => Math.min(1, Math.max(-1, (x / innerWidth) * 2 - 1));

// How far a point can travel along (dx, dy) before it is `margin` px beyond the edge of the screen.
function reach(p: Pt, dx: number, dy: number, margin: number) {
  const tx = dx > 0 ? (innerWidth + margin - p.x) / dx : dx < 0 ? (p.x + margin) / -dx : Infinity;
  const ty = dy > 0 ? (innerHeight + margin - p.y) / dy : dy < 0 ? (p.y + margin) / -dy : Infinity;
  return Math.min(tx, ty);
}

// Ground perspective: the feet sit lower on screen the bigger (closer) the animal is.
function zoom(el: HTMLElement, run: Zoom): Animation[] {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const horizon = innerHeight * 0.45;
  const ground = innerHeight * 0.97;
  const depth = (s: number) => (s - FAR) / (NEAR - FAR); // 0 on the horizon, 1 at its closest
  const inward = (s: number) => lerp(run.far, run.near, depth(s));
  const outward = (s: number) => lerp(run.away, run.near, depth(s));
  const at = (s: number, x: number, lift = 0, tilt = 0) =>
    `translate(${x - w / 2}px, ${lerp(horizon, ground, depth(s)) - h - lift}px) scale(${s}) rotate(${tilt}deg)`;
  const t = (ms: number) => ms / ZOOM_MS;
  const frames: Keyframe[] = [];
  for (let i = 0; i < STEPS; i++) {
    const mid = Math.sqrt(scaleAt(i) * scaleAt(i + 1));
    frames.push({ offset: t(i * STEP_MS), transform: at(scaleAt(i), inward(scaleAt(i))), easing: 'ease-out' });
    frames.push({ offset: t((i + 0.5) * STEP_MS), transform: at(mid, inward(mid), h * 0.14 * mid, i % 2 ? 5 : -5), easing: 'ease-in' });
  }
  const arrived = STEPS * STEP_MS;
  frames.push(
    { offset: t(arrived), transform: at(NEAR, run.near) },
    { offset: t(arrived + PEEK_MS * 0.33), transform: at(NEAR, run.near, 0, -6) },
    { offset: t(arrived + PEEK_MS * 0.66), transform: at(NEAR, run.near, 0, 6) },
    { offset: t(TURNED_MS), transform: at(NEAR, run.near), easing: 'ease-in' },
    { offset: t(TURNED_MS + AWAY_MS * 0.45), transform: at(0.4, outward(0.4), h * 0.08), opacity: 1, easing: 'ease-in' },
    { offset: 1, transform: at(0.02, outward(0.02)), opacity: 0 },
  );

  // Turning round: squash sideways and swap the front view for the back view halfway.
  const flip = el.firstElementChild as HTMLElement;
  const [front, back] = Array.from(flip.children);
  const mid = t(TURNED_MS - TURN_MS / 2);
  const show = (from: number, to: number): Keyframe[] => [{ opacity: from }, { opacity: from, offset: mid }, { opacity: to, offset: mid }, { opacity: to }];
  const timing: KeyframeAnimationOptions = { duration: ZOOM_MS, delay: run.delay, fill: 'both' };
  return [
    el.animate(frames, timing),
    flip.animate(
      [{ transform: 'scaleX(1)' }, { transform: 'scaleX(1)', offset: t(TURNED_MS - TURN_MS) }, { transform: 'scaleX(0.1)', offset: mid }, { transform: 'scaleX(1)', offset: t(TURNED_MS) }, { transform: 'scaleX(1)' }],
      timing,
    ),
    front.animate(show(1, 0), timing),
    back.animate(show(0, 1), timing),
  ];
}

// Straight across the screen with a wobble, trailing speed lines.
function dash(el: HTMLElement, run: Dash): Animation[] {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const frames = [0, 0.25, 0.5, 0.75, 1].map((p, i) => ({
    transform: `translate(${lerp(run.from.x, run.to.x, p) - w / 2}px, ${lerp(run.from.y, run.to.y, p) - h / 2}px) rotate(${run.lean + (i % 2 ? 6 : -6)}deg)`,
  }));
  return [el.animate(frames, { duration: DASH_MS, delay: run.delay, fill: 'both' })];
}

function Runner({ run, onDone }: { run: Run; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anims = run.style === 'dash' ? dash(ref.current!, run) : zoom(ref.current!, run);
    anims[0].onfinish = onDone;
    return () => anims.forEach((a) => a.cancel());
  }, []);

  // The speed lines point back along the run (their default is "above", for a run straight down).
  const trail = run.style === 'dash' ? (Math.atan2(run.to.y - run.from.y, run.to.x - run.from.x) * 180) / Math.PI - 90 - run.lean : 0;
  const style = { width: run.width, zIndex: 92 - run.rank, '--trail': `${trail}deg` } as CSSProperties;
  return (
    <div ref={ref} className={`zoomie zoomie-${run.style}`} style={style} aria-hidden>
      {run.style === 'dash' ? (
        <Critter species={run.species} face="whee" className="cr-run cr-whee" />
      ) : (
        <div className="zoomie-flip">
          <Critter species={run.species} className="cr-run" />
          <Critter species={run.species} back className="cr-run cr-fast" />
        </div>
      )}
    </div>
  );
}

// The sounds follow the motion: footsteps in time with the legs, a boing per hop, a hello when it's closest,
// a swoosh as it spins round, and a "wheee" that pans across the screen and fades away with it.
function sound(a: Sfx, group: Run[]) {
  const now = a.ctx.currentTime + 0.03;
  let end = now;
  for (const r of group) {
    const t0 = now + r.delay / 1000;
    if (r.style === 'dash') {
      const dur = DASH_MS / 1000;
      const t = track(a, [0, 0.25, 0.5, 0.75, 1].map((p) => [t0 + p * dur, panOf(lerp(r.from.x, r.to.x, p))]));
      for (let s = 0.05; s < dur; s += 0.1) step(t, t0 + s, 0.1 + 0.25 * Math.sin((Math.PI * s) / dur)); // each footfall of the 0.2 s stride
      voice(t, r.species, t0 + 0.05);
      end = Math.max(end, whee(t, t0 + 0.4, dur - 0.3, 560 * r.pitch, 1180 * r.pitch, 620 * r.pitch));
    } else {
      const away = t0 + TURNED_MS / 1000;
      const t = track(a, [
        [t0, panOf(r.far)],
        [t0 + (STEPS * STEP_MS) / 1000, panOf(r.near)],
        [away, panOf(r.near)],
        [away + AWAY_MS / 1000, panOf(r.away)],
      ]);
      for (let i = 0; i < STEPS; i++) hop(t, t0 + (i * STEP_MS) / 1000, 0.06 + 0.4 * (i / (STEPS - 1)) ** 1.5, 1.35 - 0.45 * (i / (STEPS - 1)));
      voice(t, r.species, t0 + (STEPS * STEP_MS) / 1000 + 0.03);
      zip(t, t0 + (TURNED_MS - TURN_MS) / 1000);
      for (let s = 0; s < AWAY_MS / 1000; s += 0.09) step(t, away + s, 0.3 * (1 - (s * 1000) / AWAY_MS) + 0.02);
      end = Math.max(end, whee(t, away, AWAY_MS / 1000 + 0.3, 950 * r.pitch, 1350 * r.pitch, 480 * r.pitch));
    }
  }
  restAfter(a, end);
}

let seq = 0;

// Now and then a cute animal (sometimes a few) zooms across this screen with a "wheee!" and is gone before anyone else looks.
// Each phone picks its own moments and directions, so nobody else sees the same one.
export default function Zoomies() {
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    if (calm()) return;
    const stopUnlock = unlockOnTap();
    let live = true;
    let last: Species | undefined;
    let heading = Math.random() * 2 * Math.PI;
    let timer: ReturnType<typeof setTimeout>;
    // A quiet gap of 16–60 s after the previous animals have gone, so nobody sees too many.
    const later = (busyMs = 0) => {
      timer = setTimeout(go, busyMs + 16_000 + Math.random() * 44_000);
    };
    const go = async () => {
      if (document.hidden) return later();
      const count = Math.random() < 0.55 ? 1 : Math.random() < 0.67 ? 2 : 3;
      const kinds = SPECIES.filter((s) => s !== last)
        .sort(() => Math.random() - 0.5)
        .slice(0, count);
      last = kinds.at(-1);
      const [W, H] = [innerWidth, innerHeight];
      const lanes = kinds.map((_, i) => i - (count - 1) / 2);
      let group: Run[];
      if (Math.random() < 0.5) {
        // Any direction (top, bottom, either side or a corner), and never close to the last one.
        heading += ((60 + Math.random() * 240) * Math.PI) / 180;
        const [dx, dy] = [Math.cos(heading), Math.sin(heading)];
        const width = Math.min(0.36 * W, 0.26 * H);
        const margin = width * 1.4; // fully off screen, speed lines included
        const centre = { x: W * (0.3 + Math.random() * 0.4), y: H * (0.25 + Math.random() * 0.5) };
        group = kinds.map((species, i): Dash => {
          const p = { x: centre.x - dy * lanes[i] * width, y: centre.y + dx * lanes[i] * width };
          const back = reach(p, -dx, -dy, margin);
          const ahead = reach(p, dx, dy, margin);
          return {
            id: ++seq, species, width, pitch: CHORD[i], rank: i, delay: i * 330 + Math.random() * 80, style: 'dash',
            from: { x: p.x - dx * back, y: p.y - dy * back },
            to: { x: p.x + dx * ahead, y: p.y + dy * ahead },
            lean: dx * 14,
          };
        });
      } else {
        // From a random spot on the horizon, up close, then off towards another.
        const width = Math.min(0.52 * W, 0.4 * H) * [1, 0.8, 0.66][count - 1];
        const spot = (lo: number, hi: number) => W * (lo + Math.random() * (hi - lo));
        const [far, near, away] = [spot(0.15, 0.85), spot(0.3, 0.7), spot(0.1, 0.9)];
        group = kinds.map((species, i): Zoom => {
          const lane = lanes[i] * 0.26 * W;
          return { id: ++seq, species, width, pitch: CHORD[i], rank: i, delay: i * 280 + Math.random() * 80, style: 'zoom', far: far + lane, near: near + lane, away: away + lane };
        });
      }
      // Waking the audio can take a moment; the animals wait for it so their sounds start with the motion.
      const audio = isMuted() ? null : await awake(700);
      if (!live || document.hidden) {
        if (audio) restAfter(audio, 0);
        if (live) later();
        return;
      }
      setRuns((r) => [...r, ...group]);
      if (audio) sound(audio, group);
      later(Math.max(...group.map((r) => r.delay + (r.style === 'dash' ? DASH_MS : ZOOM_MS))));
    };
    later();

    return () => {
      live = false;
      clearTimeout(timer);
      stopUnlock();
    };
  }, []);

  return (
    <>
      {runs.map((run) => (
        <Runner key={run.id} run={run} onDone={() => setRuns((r) => r.filter((x) => x.id !== run.id))} />
      ))}
    </>
  );
}
