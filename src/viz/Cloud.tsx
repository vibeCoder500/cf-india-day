import { useEffect, useRef } from 'react';
import { motion, useAnimate } from 'motion/react';
import { EASE, hash, lerp } from './adapters';
import type { Item, Size } from './adapters';

export default function Cloud({ items, size }: { items: Item[]; size: Size }) {
  const lg = size === 'lg';
  const top = items.slice(0, 60); // already sorted by count, desc
  const max = Math.max(1, ...top.map((w) => w.count));
  // Centre-out: alternately prepend/append so the biggest word ends up in the middle.
  const ordered: Item[] = [];
  top.forEach((w, i) => (i % 2 ? ordered.unshift(w) : ordered.push(w)));
  return (
    <div className={`flex flex-wrap content-center items-center justify-center gap-x-4 ${lg ? 'h-full gap-y-2' : 'gap-y-1'}`}>
      {ordered.map((w) => (
        <Word key={w.key} w={w} max={max} lg={lg} leader={w === top[0]} />
      ))}
    </div>
  );
}

// Spins in on a spring, bobs gently (the leader wiggles), and boings whenever more people type the same word.
function Word({ w, max, lg, leader }: { w: Item; max: number; lg: boolean; leader: boolean }) {
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const seen = useRef(w.count);
  const h = hash(w.label);
  const tilt = ((h % 5) - 2) * 3;
  const [lo, hi] = lg ? [1, 5] : [0.5, 2.5];

  useEffect(() => {
    if (w.count > seen.current) void animate(scope.current, { scale: [1, 1.5, 0.9, 1] }, { duration: 0.6, ease: 'easeOut' });
    seen.current = w.count;
  }, [w.count, animate, scope]);

  return (
    <motion.span
      layout="position"
      initial={{ scale: 0, opacity: 0, rotate: tilt - 90 }}
      animate={{ scale: 1, opacity: 1, rotate: tilt }}
      transition={{ type: 'spring', stiffness: 320, damping: 14 }}
      className="inline-block font-display leading-none font-extrabold"
      style={{ fontSize: `${lerp(lo, hi, Math.sqrt(w.count / max))}rem`, color: w.color, transition: `font-size 600ms ${EASE}` }}
    >
      <span ref={scope} className="inline-block">
        <span className={`inline-block ${leader ? 'animate-wiggle' : 'animate-float'}`} style={{ animationDelay: `-${h % 4000}ms` }}>
          {w.label}
        </span>
      </span>
    </motion.span>
  );
}
