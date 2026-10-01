import type { Question, Results } from '../../shared/protocol';
import { PALETTE } from '../../shared/constants';
import { fmt } from '../lib/format';
import { EASE, hash } from './adapters';
import type { Size } from './adapters';

const LANES = 7;

// Number line with a simple beeswarm: each guess sits in lane hash(index) % 7.
export default function Dots({ q, results, revealed, size }: { q: Question; results: Extract<Results, { kind: 'numbers' }>; revealed: boolean; size: Size }) {
  const lg = size === 'lg';
  const span = q.max - q.min || 1;
  const x = (v: number) => Math.min(100, Math.max(0, ((v - q.min) / span) * 100));
  const unit = q.unit ? ` ${q.unit}` : '';
  const target = revealed ? q.correct : null;
  const closest = new Set<number>();
  if (target !== null) {
    results.values
      .map((v, i) => ({ i, d: Math.abs(v - target) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .forEach(({ i }) => closest.add(i));
  }
  const dot = lg ? 14 : 7;
  return (
    <div className={`flex flex-col justify-end ${lg ? 'h-full min-h-[30vh] px-[2vw] pt-[6vh]' : 'h-44 px-3 pt-8 text-xs'}`}>
      <div className="relative flex-1">
        {results.values.map((v, i) => {
          const h = hash(String(i));
          const big = closest.has(i);
          const s = big ? dot * 2 : dot;
          return (
            <span
              key={i}
              className={`absolute rounded-full ${big ? 'z-10 ring-4 ring-white' : ''}`}
              style={{
                left: `${x(v)}%`,
                bottom: `${((h % LANES) / LANES) * 85}%`,
                width: s,
                height: s,
                marginLeft: -s / 2,
                background: PALETTE[h % PALETTE.length],
                transition: `left 600ms ${EASE}`,
              }}
            />
          );
        })}
        {results.median !== null && (
          <div className="absolute inset-y-0 border-l-2 border-dashed border-white/60" style={{ left: `${x(results.median)}%` }}>
            <span className={`absolute top-0 left-1 font-bold whitespace-nowrap opacity-80 ${lg ? 'text-[clamp(0.9rem,1.3vw,1.4rem)]' : ''}`}>
              median {fmt(results.median)}
              {unit}
            </span>
          </div>
        )}
        {target !== null && (
          <div className="absolute inset-y-0 z-20 border-l-4 border-saffron" style={{ left: `${x(target)}%` }}>
            <span
              className={`absolute top-0 left-0 -translate-x-1/2 -translate-y-full rounded-full bg-saffron px-3 py-1 font-bold whitespace-nowrap text-night ${
                lg ? 'text-[clamp(1rem,1.8vw,2rem)]' : ''
              }`}
            >
              🎯 {fmt(target)}
              {unit}
            </span>
          </div>
        )}
      </div>
      <div className={`relative mt-2 border-t-2 border-white/60 ${lg ? 'h-[4vh] text-[clamp(0.9rem,1.3vw,1.4rem)]' : 'h-5'}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <span key={f} className="absolute top-1 -translate-x-1/2 whitespace-nowrap opacity-80" style={{ left: `${f * 100}%` }}>
            {fmt(q.min + f * span)}
          </span>
        ))}
      </div>
    </div>
  );
}
