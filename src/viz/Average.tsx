import type { Question, Results } from '../../shared/protocol';
import { AWESOME, awesomeAt } from '../../shared/constants';
import { EASE } from './adapters';
import type { Size } from './adapters';

const FACES = ['😴', '😐', '🙂', '😀', '🤩'];

export default function Average({ q, results, size }: { q: Question; results: Extract<Results, { kind: 'scale' }>; size: Size }) {
  const lg = size === 'lg';
  const frac = q.max > q.min ? (results.avg - q.min) / (q.max - q.min) : 0;
  const level = q.type === 'awesome' ? awesomeAt(results.avg) : null;
  const face = level ? level.emoji : FACES[Math.min(4, Math.max(0, Math.round(frac * 4)))];
  const max = Math.max(1, ...results.counts);
  return (
    <div className={`flex flex-col items-center justify-center ${lg ? 'h-full gap-[2vh]' : 'gap-2'}`}>
      <div className={`flex items-center ${lg ? 'gap-[2vw]' : 'gap-3'}`}>
        <span className={lg ? 'text-[clamp(4rem,10vw,12rem)] leading-none' : 'text-5xl'}>{face}</span>
        <span className={`font-display leading-none font-extrabold tabular-nums ${lg ? 'text-[clamp(5rem,14vw,16rem)]' : 'text-6xl'}`}>
          {results.avg.toFixed(1)}
        </span>
      </div>
      {level && (
        <p className={`font-display leading-none font-extrabold ${lg ? 'text-[clamp(2.5rem,6vw,7rem)]' : 'text-3xl'}`} style={{ color: level.color }}>
          {level.label}!
        </p>
      )}
      <p className={lg ? 'text-[clamp(1.25rem,2vw,2.25rem)] opacity-80' : 'text-sm opacity-80'}>{results.total} ratings</p>
      <div className={`flex w-full max-w-3xl items-end gap-1 ${lg ? 'h-[8vh]' : 'h-8'}`}>
        {results.counts.map((c, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-white/60"
            style={{ height: `${(c / max) * 100}%`, background: level ? AWESOME[i].color : undefined, transition: `height 600ms ${EASE}` }}
          />
        ))}
      </div>
    </div>
  );
}
