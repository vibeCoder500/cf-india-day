import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { calm } from '../lib/fun';
import { BEAT_MS, nextBeatAt, onMusicChange } from '../lib/music';

// Every photo in src/assets/collage, in file-name order. Add or remove files there to change the reel.
const PHOTOS = Object.values(
  import.meta.glob<string>('../assets/collage/*.{jpg,jpeg,png,webp,avif}', { eager: true, import: 'default' }),
);

const TAU = 2 * Math.PI;
const rad = (deg: number) => (deg * Math.PI) / 180;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (p: number) => p * p * (3 - 2 * p);
const backOut = (p: number) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2; // overshoots, then settles

// Distances are in ring radii.
const CAMERA = 2.6; // from the viewer to the ring's centre: close, so the photo passing in front looms large
const SWELL = 0.03; // the ring breathing in and out
const DRIFT = 0.025; // the whole show floating about
const KICK = 0.05; // photos thump on the beat
const SWAY = rad(3);
const NOD = rad(6);
const FRAME_H = 1.22; // film frame height, in photo heights (sprocket bands above and below)
const FRAME_W = 1.86; // widest film frame (a 16:9 photo plus side borders), in photo heights
const TURN_S = 20; // slow enough for everyone to spot themselves as their photo passes the front
const INTRO_S = 1.6;
const FLIP_S = 0.9;
const STILL_T = 3.4; // the pose shown when the device asks for reduced motion
const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

type Layout = { r: number; ih: number; cx: number; cy: number; ty: number; float: number; tilt: number; tiltAmp: number; rollAmp: number; bob: number };

// 0 on a wide screen, 1 on a tall phone.
const shapeOf = (w: number, h: number) => smooth(clamp01((h / w - 0.6) / 0.8));

// A point on the ring at angle phi (0 = nearest the viewer), `lift` above the ring's plane. The ring leans back by
// `tilt`, so the viewer looks down on it, and sideways by `roll`. Returns the screen offset, depth and perspective scale.
function project(phi: number, radius: number, lift: number, tilt: number, roll: number) {
  const x = radius * Math.sin(phi);
  const flat = radius * Math.cos(phi);
  const y = flat * Math.sin(tilt) - lift * Math.cos(tilt);
  const z = flat * Math.cos(tilt) + lift * Math.sin(tilt);
  const f = CAMERA / (CAMERA - z);
  return { x: (x * Math.cos(roll) - y * Math.sin(roll)) * f, y: (x * Math.sin(roll) + y * Math.cos(roll)) * f, z, f };
}

// Where the frames reach over every pose, in ring radii, from each frame's projected corners. frontTop is the highest
// top edge of a photo within 20° of the front, frontW the width of the photo right at the front.
function extents(tilt: number, tiltAmp: number, rollAmp: number, bob: number, ih: number) {
  const a = 0.5 * FRAME_W * ih * (1 + KICK);
  const b = 0.5 * FRAME_H * ih * (1 + KICK);
  const e = { top: 0, bottom: 0, left: 0, right: 0, frontTop: Infinity, frontW: 0 };
  for (let deg = 0; deg < 360; deg += 5) {
    const phi = rad(deg);
    const front = deg <= 20 || deg >= 340;
    for (const t of [tilt - tiltAmp, tilt + tiltAmp]) {
      for (const lift of [-bob, bob]) {
        const c = project(phi, 1 + SWELL, lift, t, 0);
        for (const pitch of [t / 2 - NOD, t / 2 + NOD]) {
          // The frame's width and height axes after it turns to face outwards (rotateY) and leans back (rotateX).
          const [ux, uy, uz] = [Math.cos(phi), Math.sin(phi) * Math.sin(pitch), -Math.sin(phi) * Math.cos(pitch)];
          const [vy, vz] = [Math.cos(pitch), Math.sin(pitch)];
          for (const roll of [-rollAmp, rollAmp]) {
            let lo = Infinity;
            let hi = -Infinity;
            for (const [su, sv] of CORNERS) {
              const oz = su * a * uz + sv * b * vz;
              const g = CAMERA / (CAMERA - c.z - oz);
              const x = c.x + su * a * ux * g;
              const y = c.y + (su * a * uy + sv * b * vy) * g;
              const rx = x * Math.cos(roll) - y * Math.sin(roll);
              const ry = x * Math.sin(roll) + y * Math.cos(roll);
              e.left = Math.min(e.left, rx);
              e.right = Math.max(e.right, rx);
              e.top = Math.min(e.top, ry);
              e.bottom = Math.max(e.bottom, ry);
              if (front) e.frontTop = Math.min(e.frontTop, ry);
              lo = Math.min(lo, rx);
              hi = Math.max(hi, rx);
            }
            if (deg === 0) e.frontW = Math.max(e.frontW, hi - lo);
          }
        }
      }
    }
  }
  return e;
}

// Sizes the ring from the stage and the text box (px) so the photos come out as big as possible. The text sits just above
// the photo passing in front, so it stays readable, while the far side of the ring passes behind it. Phones let the ring's
// sides run off screen so the front photo can fill the width. Of the orbit tilts giving (nearly) the biggest photos, the
// steepest wins; spare height becomes a slow float.
function fit(w: number, h: number, n: number, tw: number, th: number): Layout {
  const k = shapeOf(w, h);
  const ih = Math.min(lerp(0.32, 0.55, k), (3.2 * Math.sin(Math.PI / Math.max(n, 6))) / FRAME_W);
  const tiltAmp = rad(lerp(1.5, 3, k));
  const rollAmp = rad(3);
  const bob = lerp(0.025, 0.04, k); // the wave that runs round the ring
  const gap = 0.045 * tw + 8; // the text's wobble lifts and drops its ends by about 4.5% of its width
  const pad = DRIFT + SWAY * Math.hypot(FRAME_W, FRAME_H) * ih; // plus each frame's own sway
  const spill = lerp(1, 1.6, k);
  const tries = [];
  for (let deg = 8; deg <= lerp(24, 48, k); deg += 2) {
    const e = extents(rad(deg), tiltAmp, rollAmp, bob, ih);
    const r = Math.max(
      0,
      Math.min(
        (h - 12) / (e.bottom - e.top + 2 * pad),
        (h - 12 - gap - th) / (e.bottom - e.frontTop + 2 * pad),
        (0.94 * w) / e.frontW,
        (spill * w - 12) / 2 / (Math.max(-e.left, e.right) + pad),
      ),
    );
    tries.push({ deg, e, r });
  }
  const best = Math.max(...tries.map((x) => x.r));
  const { deg, e, r } = tries.findLast((x) => x.r >= 0.96 * best)!;
  const ty = e.frontTop * r - gap - th / 2; // the text's centre, relative to the ring's
  const top = Math.min(e.top * r, ty - th / 2) - pad * r;
  const bottom = (e.bottom + pad) * r;
  const float = Math.min(0.5 * r, 0.8 * Math.max(0, (h - 12 - (bottom - top)) / 2));
  return { r, ih: ih * r, cx: w / 2, cy: h / 2 - (top + bottom) / 2, ty, float, tilt: rad(deg), tiltAmp, rollAmp, bob };
}

// The party photos as film frames, revolving in a tilted 3-D ring around the text (the Universal Pictures globe, turned
// inside out). Motion: spin with surges, rocking tilt, rolling axis, breathing radius, a travelling wave, sway and nod,
// flips, beat thumps, glints, slow zooms inside each photo and a drifting camera. The stage clips, so nothing ever
// reaches the band below.
export default function PhotoReel({ big = false, children }: { big?: boolean; children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current!;
    const text = stage.querySelector<HTMLElement>('.reel-text')!;
    const cards = [...stage.querySelectorAll<HTMLElement>('.reel-card')];
    const glints = cards.map((c) => c.querySelector<HTMLElement>('.reel-glint')!);
    const imgs = cards.map((c) => c.querySelector('img')!);
    const n = cards.length;
    const depth = new Float64Array(n);
    const order = cards.map((_, i) => i);
    const layer = new Array<number>(n).fill(0);
    const flipAt = new Float64Array(n).fill(-99);
    const flipDir = new Float64Array(n).fill(1);
    const loadedAt = new Float64Array(n).fill(-1);
    let nextFlip = 4;
    let layout = fit(1, 1, n, 0, 0);
    const start = performance.now();
    const still = calm();
    let beat = start;

    // The text size depends only on the stage; the ring is then fitted round the text box it produces.
    const apply = () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      stage.style.setProperty('--reel-fs', `${(lerp(0.1, 0.075, shapeOf(w, h)) * h).toFixed(1)}px`);
      layout = fit(w, h, n, text.offsetWidth, text.offsetHeight);
      stage.style.setProperty('--ih', `${layout.ih}px`);
    };

    const draw = (t: number, now: number) => {
      const { r, cx, cy, ty, float, tilt, tiltAmp, rollAmp, bob } = layout;
      const grow = 1 - (1 - clamp01(t / INTRO_S)) ** 3;
      const spin = (TAU * t) / TURN_S + 0.25 * Math.sin((TAU * t) / 6.7) + 3 * (1 - Math.exp(-t / 0.6));
      const tau = tilt + tiltAmp * Math.sin((TAU * t) / 7.9);
      const roll = rollAmp * Math.sin((TAU * t) / 11.3 + 0.8);
      const radius = (1 + SWELL * Math.sin((TAU * t) / 5.3)) * (0.1 + 0.9 * grow);
      const since = (((now - beat) % BEAT_MS) + BEAT_MS) % BEAT_MS;
      const kick = 1 + KICK * Math.exp(-since / 110);
      const ox = cx + DRIFT * r * Math.sin((TAU * t) / 13.7);
      const oy = cy + (DRIFT * r + float) * Math.sin((TAU * t) / 9.1 + 1.3);
      text.style.transform = `translate(${ox.toFixed(1)}px, ${(oy + ty).toFixed(1)}px)`;

      // Now and then a photo off to one side somersaults; the one passing the front is left alone to be looked at.
      if (t > nextFlip) {
        const side = order.filter((i) => {
          const c = Math.cos(spin + (TAU * i) / n);
          return c > 0.3 && c < 0.8;
        });
        if (side.length > 0) {
          const i = side[Math.floor(Math.random() * side.length)];
          flipAt[i] = t;
          flipDir[i] = Math.random() < 0.5 ? 1 : -1;
        }
        nextFlip = t + 3.5 + Math.random() * 4;
      }

      for (let i = 0; i < n; i++) {
        const phi = (spin + (TAU * i) / n) % TAU;
        const lift = bob * Math.sin((TAU * t) / 2.8 - (2 * TAU * i) / n);
        const p = project(phi, radius, lift, tau, roll);
        depth[i] = p.z;
        const born = t - 0.25 - 0.07 * i;
        const pop = backOut(clamp01(born / 0.5));
        const f = clamp01((t - flipAt[i]) / FLIP_S);
        const flip = f > 0 && f < 1 ? TAU * smooth(f) * flipDir[i] : 0;
        const sway = SWAY * Math.sin((TAU * t) / 1.9 + i * 1.7);
        const nod = NOD * Math.sin((TAU * t) / 2.3 + i * 2.3);
        cards[i].style.transform =
          `translate(${(ox + p.x * r).toFixed(1)}px, ${(oy + p.y * r).toFixed(1)}px) scale(${(p.f * kick * pop).toFixed(4)}) ` +
          `perspective(${((CAMERA - p.z) * r).toFixed(0)}px) rotate(${(roll + sway).toFixed(4)}rad) ` +
          `rotateX(${(tau / 2 + nod).toFixed(4)}rad) rotateY(${phi.toFixed(4)}rad) rotateX(${flip.toFixed(4)}rad)`;
        // Far photos fade into the dark, so the text stays readable over the (mirrored) backs passing behind it.
        // Each photo also fades in once it has downloaded, instead of showing an empty frame.
        if (loadedAt[i] < 0 && imgs[i].complete && imgs[i].naturalWidth > 0) loadedAt[i] = t;
        const loaded = still ? 1 : loadedAt[i] < 0 ? 0 : clamp01((t - loadedAt[i]) / 0.4);
        const near = clamp01((p.z / (radius * Math.cos(tau)) + 1) / 2);
        cards[i].style.opacity = (clamp01(born / 0.3) * loaded * (0.28 + 0.72 * smooth(near))).toFixed(3);
        glints[i].style.transform = Math.cos(phi) > 0 ? `translateX(${(Math.sin(phi + 0.3) * 160).toFixed(1)}%)` : 'translateX(-300%)';
      }

      // Nearer photos on top; the front half of the ring passes in front of the text (z-index 100), the back half behind.
      order.sort((a, b) => depth[a] - depth[b]);
      for (let rank = 0; rank < n; rank++) {
        const i = order[rank];
        const z = depth[i] > 0 ? 101 + rank : 1 + rank;
        if (layer[i] !== z) {
          layer[i] = z;
          cards[i].style.zIndex = String(z);
        }
      }
    };

    // Thump on the music's beat once it's audible (the band dances to the same clock).
    const resync = () => {
      beat = nextBeatAt() ?? beat;
    };
    resync();
    const off = onMusicChange(resync);

    apply();
    let raf = 0;
    const frame = (now: number) => {
      draw((now - start) / 1000, now);
      raf = requestAnimationFrame(frame);
    };
    if (still) draw(STILL_T, start);
    else {
      draw(0, start);
      raf = requestAnimationFrame(frame);
    }
    // The text box also changes size once its web font arrives.
    const ro = new ResizeObserver(() => {
      apply();
      if (still) draw(STILL_T, start);
    });
    ro.observe(stage);
    ro.observe(text);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      off();
    };
  }, []);

  return (
    <div ref={stageRef} className={`reel ${big ? 'reel-big' : ''}`}>
      {PHOTOS.map((src, i) => (
        <div key={src} className="reel-card" aria-hidden>
          <div className="reel-shot">
            <img
              src={src}
              alt=""
              draggable={false}
              decoding="async"
              style={{ animationDelay: `${-i * 2.3}s`, animationDirection: i % 2 ? 'alternate-reverse' : 'alternate' }}
            />
            <div className="reel-glint" />
          </div>
        </div>
      ))}
      <div className="reel-text">{children}</div>
    </div>
  );
}
