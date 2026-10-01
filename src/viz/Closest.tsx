import type { Question, Results } from '../../shared/protocol';
import { fmt } from '../lib/format';
import type { Size } from './adapters';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Closest({ q, results, revealed, size }: { q: Question; results: Extract<Results, { kind: 'numbers' }>; revealed: boolean; size: Size }) {
  const lg = size === 'lg';
  const unit = q.unit ? ` ${q.unit}` : '';
  const target = q.correct;

  if (!revealed || target === null || results.closest.length === 0) {
    return (
      <div className={`grid place-items-center text-center ${lg ? 'h-full' : 'min-h-32'}`}>
        <p className={`font-display font-extrabold ${lg ? 'text-[clamp(2rem,5vw,5rem)]' : 'text-xl'}`}>
          🤔 {results.total} guesses
          {results.median !== null && ` · median ${fmt(results.median)}${unit}`}
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center text-center ${lg ? 'h-full gap-[4vh]' : 'gap-3'}`}>
      <p className={`font-display font-extrabold text-saffron ${lg ? 'text-[clamp(2rem,4.5vw,5rem)]' : 'text-xl'}`}>
        🎯 Answer: {fmt(target)}
        {unit}
      </p>
      <div className={`flex flex-wrap items-end justify-center ${lg ? 'gap-[2vw]' : 'gap-2'}`}>
        {results.closest.map((c, i) => (
          <div
            key={i}
            className={`rounded-3xl ${i === 0 ? 'bg-yellow-400/25 ring-4 ring-yellow-300' : 'bg-white/10'} ${
              lg ? 'min-w-[18vw] p-[2vw] text-[clamp(1.1rem,1.8vw,2rem)]' : 'min-w-24 p-2 text-xs'
            }`}
          >
            <div className={lg ? 'text-[clamp(2.5rem,5vw,5.5rem)] leading-none' : 'text-2xl'}>
              {MEDALS[i]} {c.avatar}
            </div>
            <div className="mt-2 truncate font-display font-extrabold">{c.name}</div>
            <div className="font-bold">
              {fmt(c.value)}
              {unit}
            </div>
            <div className="opacity-70">off by {fmt(Math.abs(c.value - target))}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
