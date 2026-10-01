import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AnimalPick, Question } from '../../shared/protocol';
import { ANIMALS } from '../../shared/constants';
import type { Animal } from '../../shared/constants';
import type { Size } from './adapters';

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  seed: number;
  rising: boolean;
}

interface Ghost {
  pick: AnimalPick;
  x: number;
  y: number;
}

const MAX_SHOWN = 60;
const WANDER = 18; // px/s
const RISE = 110; // px/s for a new bubble coming up from the bottom
// Where bubbles were (as canvas fractions), so the voting and results screens continue the same scene.
const lastSeen = new Map<number, { fx: number; fy: number }>();

const tint = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

// Sized for at least 32 bubbles, so the screen always has room for 30–35; shrinks further for bigger crowds.
function diameter(w: number, h: number, n: number, size: Size) {
  const d = Math.sqrt((0.55 * w * h) / Math.max(n, 32));
  return size === 'lg' ? Math.min(132, Math.max(60, d)) : Math.min(72, Math.max(34, d));
}

function Face({ a, name, d }: { a: Animal; name: string; d: number }) {
  return (
    <div className="flex max-w-[84%] flex-col items-center">
      <span className="leading-none" style={{ fontSize: d * 0.3 }}>
        {a.emoji}
      </span>
      <span className="mt-[0.2em] w-full truncate font-bold" style={{ fontSize: Math.max(9, d * 0.12) }}>
        {name}
      </span>
      <span className="w-full truncate font-extrabold tracking-wide uppercase" style={{ fontSize: Math.max(7, d * 0.085) }}>
        {a.trait}
      </span>
      {d >= 90 && (
        <span className="line-clamp-2 leading-tight opacity-85" style={{ fontSize: Math.max(7, d * 0.07) }}>
          {a.tags.join(' · ')}
        </span>
      )}
    </div>
  );
}

const shell = (a: Animal) => ({
  background: `radial-gradient(circle at 50% 62%, ${tint(a.color, 0.22)} 0%, ${tint(a.color, 0.42)} 60%, ${tint(a.color, 0.85)} 100%)`,
});

export default function SpiritBubbles({ q, picks, size }: { q: Question; picks: AnimalPick[]; size: Size }) {
  const box = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  const bodies = useRef(new Map<number, Body>());
  const els = useRef(new Map<number, HTMLDivElement>());
  const known = useRef(new Map<number, AnimalPick>());
  const started = useRef(false);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);

  const shown = picks.filter((p) => ANIMALS[q.options[p.choice]]).slice(-MAX_SHOWN);
  const d = diameter(dims.w, dims.h, shown.length, size);
  const geo = useRef({ w: 0, h: 0, r: 0, hover: null as number | null });
  geo.current = { w: dims.w, h: dims.h, r: d / 2, hover };
  const ids = shown.map((p) => p.id).join(',');

  useLayoutEffect(() => {
    const el = box.current!;
    const measure = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // Add bubbles for new picks and pop the ones that disappeared (hidden, removed player, cleared question).
  useLayoutEffect(() => {
    const { w, h, r } = geo.current;
    if (!w || !h) return;
    const map = bodies.current;
    const keep = new Set(shown.map((p) => p.id));
    for (const p of shown) {
      if (map.has(p.id)) continue;
      const seen = lastSeen.get(p.id);
      const rising = !seen && started.current;
      map.set(p.id, {
        x: seen ? seen.fx * w : r + Math.random() * Math.max(1, w - 2 * r),
        y: seen ? seen.fy * h : rising ? h + r : r + Math.random() * Math.max(1, h - 2 * r),
        vx: (Math.random() - 0.5) * WANDER,
        vy: rising ? -RISE : (Math.random() - 0.5) * WANDER,
        seed: Math.random() * 1000,
        rising,
      });
    }
    const gone: Ghost[] = [];
    for (const [id, b] of map) {
      if (keep.has(id)) continue;
      map.delete(id);
      lastSeen.delete(id);
      const pick = known.current.get(id);
      if (pick) gone.push({ pick, x: b.x, y: b.y });
    }
    started.current = true;
    if (gone.length > 0) setGhosts((g) => [...g, ...gone]);
  }, [ids, dims.w, dims.h]);

  // Runs after the layout effect above, so a popped bubble still shows its latest animal.
  useEffect(() => {
    known.current = new Map(shown.map((p) => [p.id, p]));
  });

  useEffect(() => {
    if (ghosts.length === 0) return;
    const t = setTimeout(() => setGhosts([]), 500);
    return () => clearTimeout(t);
  }, [ghosts]);

  // Physics: slow wandering, soft bumps between bubbles, bounces off the edges. Writes transforms directly, no re-renders.
  useEffect(() => {
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w, h, r, hover: held } = geo.current;
      const list = [...bodies.current.entries()];
      const t = now / 1000;
      for (const [id, b] of list) {
        if (id === held) {
          b.vx *= 0.8;
          b.vy *= 0.8;
        } else if (b.rising) {
          b.vy += (-RISE - b.vy) * 2 * dt;
        } else if (calm) {
          b.vx *= 0.9;
          b.vy *= 0.9;
        } else {
          const tx = WANDER * (Math.sin(t * 0.35 + b.seed) + 0.5 * Math.sin(t * 0.83 + b.seed * 1.3));
          const ty = WANDER * (Math.cos(t * 0.29 + b.seed * 0.7) + 0.5 * Math.sin(t * 0.67 + b.seed * 2.1)) - 3;
          b.vx += (tx - b.vx) * 0.8 * dt;
          b.vy += (ty - b.vy) * 0.8 * dt;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
      const min = 2 * r + 4;
      for (let i = 0; i < list.length; i++) {
        const [ida, a] = list[i];
        for (let j = i + 1; j < list.length; j++) {
          const [idc, c] = list[j];
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.01;
          if (dist >= min) continue;
          const nx = dx / dist;
          const ny = dy / dist;
          // The bubble under the magnifier stays put; the other one moves out of the way.
          const wa = ida === held ? 0 : 1;
          const wc = idc === held ? 0 : 1;
          const share = (min - dist) / Math.max(1, wa + wc);
          a.x -= nx * share * wa;
          a.y -= ny * share * wa;
          c.x += nx * share * wc;
          c.y += ny * share * wc;
          const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (rel < 0) {
            a.vx += rel * nx * wa;
            a.vy += rel * ny * wa;
            c.vx -= rel * nx * wc;
            c.vy -= rel * ny * wc;
          }
        }
      }
      for (const [id, b] of list) {
        if (b.rising && b.y <= h - r) b.rising = false;
        if (b.x < r) {
          b.x = r;
          b.vx = Math.abs(b.vx);
        } else if (b.x > w - r) {
          b.x = w - r;
          b.vx = -Math.abs(b.vx);
        }
        if (b.y < r) {
          b.y = r;
          b.vy = Math.abs(b.vy);
        } else if (!b.rising && b.y > h - r) {
          b.y = h - r;
          b.vy = -Math.abs(b.vy);
        }
        const el = els.current.get(id);
        if (el) el.style.transform = `translate3d(${b.x - r}px, ${b.y - r}px, 0)`;
      }
      const lensEl = lens.current;
      const hb = held === null ? undefined : bodies.current.get(held);
      if (lensEl && hb) lensEl.style.transform = `translate3d(${hb.x}px, ${hb.y}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      const { w, h } = geo.current;
      if (lastSeen.size > 600) lastSeen.clear();
      if (w && h) for (const [id, b] of bodies.current) lastSeen.set(id, { fx: b.x / w, fy: Math.min(b.y, h) / h });
    };
  }, []);

  const held = hover === null ? undefined : shown.find((p) => p.id === hover);
  const heldAnimal = held && ANIMALS[q.options[held.choice]];
  const heldBody = held && bodies.current.get(held.id);
  const L = size === 'lg' ? Math.min(320, Math.max(200, d * 2.6)) : Math.min(190, Math.max(130, d * 3));

  return (
    <div ref={box} className={`relative w-full ${size === 'lg' ? 'h-full' : 'h-72'}`}>
      <div className="absolute inset-0 overflow-hidden">
        {shown.map((p) => {
          const a = ANIMALS[q.options[p.choice]];
          return (
            <div
              key={p.id}
              ref={(el) => {
                if (el) els.current.set(p.id, el);
                else els.current.delete(p.id);
              }}
              className="absolute top-0 left-0"
              style={{ width: d, height: d, transform: 'translate3d(-9999px, 0, 0)' }}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(p.id)}
              onPointerLeave={(e) => e.pointerType === 'mouse' && setHover((h) => (h === p.id ? null : h))}
              onPointerUp={(e) => e.pointerType !== 'mouse' && setHover((h) => (h === p.id ? null : p.id))}
            >
              <div className="spirit-in h-full w-full">
                <div
                  className={`spirit-bubble ${hover === p.id ? 'spirit-held' : ''}`}
                  style={{ ...shell(a), animationDuration: `${3.6 + (p.id % 7) * 0.35}s`, animationDelay: `${-(p.id % 11) * 0.4}s` }}
                >
                  <div key={p.choice} className="spirit-swap grid w-full place-items-center">
                    <Face a={a} name={p.name} d={d} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {ghosts.map((g) => {
          const a = ANIMALS[q.options[g.pick.choice]];
          return a ? (
            <div
              key={`ghost-${g.pick.id}`}
              className="pointer-events-none absolute top-0 left-0"
              style={{ width: d, height: d, transform: `translate3d(${g.x - d / 2}px, ${g.y - d / 2}px, 0)` }}
            >
              <div className="spirit-pop h-full w-full">
                <div className="spirit-bubble" style={shell(a)}>
                  <Face a={a} name={g.pick.name} d={d} />
                </div>
              </div>
            </div>
          ) : null;
        })}
      </div>

      {held && heldAnimal && (
        <div
          ref={lens}
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 z-20"
          style={{ transform: heldBody ? `translate3d(${heldBody.x}px, ${heldBody.y}px, 0)` : undefined }}
        >
          <div key={held.id} className="spirit-lens -translate-x-1/2 -translate-y-1/2" style={{ width: L, height: L }}>
            <div className="spirit-bubble spirit-zoomed" style={shell(heldAnimal)}>
              <div className="flex max-w-[80%] flex-col items-center gap-[0.35em]">
                <span className="leading-none" style={{ fontSize: L * 0.24 }}>
                  {heldAnimal.emoji}
                </span>
                <span className="font-display leading-none font-extrabold uppercase" style={{ fontSize: L * 0.085 }}>
                  {heldAnimal.name}
                </span>
                <span className="rounded-full px-3 py-0.5 font-bold [text-shadow:none]" style={{ fontSize: L * 0.062, background: heldAnimal.color, color: heldAnimal.ink }}>
                  {heldAnimal.trait}
                </span>
                <span className="leading-tight opacity-90" style={{ fontSize: L * 0.052 }}>
                  {heldAnimal.tags.join(' · ')}
                </span>
                <span className="mt-[0.2em] w-full truncate font-bold" style={{ fontSize: L * 0.068 }}>
                  {held.avatar} {held.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
