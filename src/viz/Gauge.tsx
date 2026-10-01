import { useId } from 'react';
import type { Question } from '../../shared/protocol';
import { AWESOME, awesomeAt } from '../../shared/constants';
import { EASE } from './adapters';
import type { Size } from './adapters';

const RED_TO_GREEN = ['#ef4444', '#facc15', '#22c55e'];

export default function Gauge({ q, avg, total, size }: { q: Question; avg: number; total: number; size: Size }) {
  const id = useId();
  const lg = size === 'lg';
  const frac = q.max > q.min ? Math.min(1, Math.max(0, (avg - q.min) / (q.max - q.min))) : 0;
  const deg = -90 + 180 * frac;
  const level = q.type === 'awesome' ? awesomeAt(avg) : null;
  const stops = level ? AWESOME.map((l) => l.color) : RED_TO_GREEN;
  const top = AWESOME[AWESOME.length - 1];
  return (
    <div className={`flex flex-col items-center justify-center ${lg ? 'h-full gap-[1vh]' : 'gap-1'}`}>
      <svg viewBox="0 0 100 56" className={lg ? 'h-[40vh] max-w-full' : 'h-28'}>
        <defs>
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
            {stops.map((c, i) => (
              <stop key={c} offset={`${(i / (stops.length - 1)) * 100}%`} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
        <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke={`url(#${id})`} strokeWidth="8" strokeLinecap="round" />
        <g style={{ transform: `rotate(${deg}deg)`, transformOrigin: '50px 50px', transition: `transform 800ms ${EASE}` }}>
          <line x1="50" y1="50" x2="50" y2="13" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx="50" cy="50" r="4.5" fill="white" />
      </svg>
      <div className={`flex w-full justify-between font-bold opacity-80 ${lg ? 'max-w-[70vh] text-[clamp(1rem,1.6vw,1.8rem)]' : 'max-w-56 text-xs'}`}>
        <span>{level ? `${AWESOME[0].emoji} ${AWESOME[0].label}` : `${q.min} ${q.minLabel}`}</span>
        <span className="text-right">{level ? `${top.label} ${top.emoji}` : `${q.maxLabel} ${q.max}`}</span>
      </div>
      <p className={`font-display leading-none font-extrabold tabular-nums ${lg ? 'text-[clamp(3rem,7vw,8rem)]' : 'text-3xl'}`}>
        {level ? `${level.emoji} ${level.label}` : avg.toFixed(1)}
      </p>
      <p className={lg ? 'text-[clamp(1rem,1.6vw,1.8rem)] opacity-70' : 'text-xs opacity-70'}>
        {level && `${avg.toFixed(1)} · `}
        {total} ratings
      </p>
    </div>
  );
}
