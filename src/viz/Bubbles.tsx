import { motion } from 'motion/react';
import { EASE, hash, lerp } from './adapters';
import type { Item, Size } from './adapters';

export default function Bubbles({ items, size, labelsBelow = false }: { items: Item[]; size: Size; labelsBelow?: boolean }) {
  const max = Math.max(1, ...items.map((it) => it.count));
  const lg = size === 'lg';
  const [lo, hi] = lg ? [3.5, 13] : [2.25, 6];
  if (labelsBelow) {
    // Full option text under each bubble; fixed slots, so votes never reflow the layout.
    const slot = lg ? `calc(${hi}rem * var(--fit, 1))` : `${hi}rem`;
    return (
      <div
        className={`flex flex-wrap content-center items-start justify-center ${
          lg ? 'h-full gap-[1.5vw] text-[length:calc(clamp(1rem,1.6vw,1.8rem)*var(--fit,1))]' : 'gap-3 text-xs'
        }`}
      >
        {items.map((it) => {
          const d = lerp(lo, hi, Math.sqrt(it.count / max)) / hi;
          return (
            <div key={it.key} className="flex flex-col items-center gap-2" style={{ width: slot }}>
              <div className="grid place-items-center" style={{ width: slot, height: slot }}>
                <div
                  className="animate-float grid place-items-center rounded-full font-bold text-white tabular-nums shadow-lg [text-shadow:0_1px_3px_rgb(0_0_0/0.5)]"
                  style={{
                    width: `${d * 100}%`,
                    height: `${d * 100}%`,
                    fontSize: `${0.9 + d * 1.5}em`,
                    background: it.color,
                    animationDelay: `${hash(it.key) % 2000}ms`,
                    transition: `width 600ms ${EASE}, height 600ms ${EASE}, font-size 600ms ${EASE}`,
                  }}
                >
                  {it.count}
                </div>
              </div>
              <div className="w-full text-center font-bold break-words">{it.label}</div>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className={`flex flex-wrap content-center items-center justify-center ${lg ? 'h-full gap-[1.5vw]' : 'gap-2'}`}>
      {items.map((it) => {
        const d = lerp(lo, hi, Math.sqrt(it.count / max));
        return (
          // Outer element glides on layout changes; the inner one floats (both animate transform, so keep them separate).
          <motion.div key={it.key} layout="position" className="shrink-0">
            <div
              className={`animate-float grid place-items-center rounded-full p-2 text-center font-bold text-white shadow-lg [text-shadow:0_1px_3px_rgb(0_0_0/0.5)] ${
                it.highlight ? 'ring-4 ring-white' : ''
              } ${it.highlight === false ? 'opacity-35' : ''}`}
              style={{
                width: `${d}rem`,
                height: `${d}rem`,
                fontSize: `${Math.max(0.65, d / 7)}rem`,
                background: it.color,
                animationDelay: `${hash(it.key) % 2000}ms`,
                transition: `width 600ms ${EASE}, height 600ms ${EASE}, font-size 600ms ${EASE}`,
              }}
            >
              <div className="min-w-0">
                <div className="line-clamp-2 leading-tight break-words">{it.label}</div>
                <div className="tabular-nums opacity-90">{it.count}</div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
