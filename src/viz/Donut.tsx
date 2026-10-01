import Shape from '../components/Shape';
import { EASE } from './adapters';
import type { Item, Size } from './adapters';

const R = 15.9155; // circumference 100, so dash lengths are percentages

export default function Donut({ items, total, size }: { items: Item[]; total: number; size: Size }) {
  const lg = size === 'lg';
  let before = 0;
  const segs = items.map((it) => {
    const pct = total ? (it.count / total) * 100 : 0;
    const seg = { it, pct, offset: 25 - before }; // 25 starts the first segment at 12 o'clock
    before += pct;
    return seg;
  });
  return (
    <div className={`flex items-center justify-center ${lg ? 'h-full gap-[4vw]' : 'gap-4'}`}>
      <div className={`relative shrink-0 ${lg ? 'aspect-square h-full max-h-[55vh]' : 'size-40'}`}>
        <svg viewBox="0 0 42 42" className="size-full">
          <circle cx="21" cy="21" r={R} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="6" />
          {segs.map(({ it, pct, offset }) => (
            <circle
              key={it.key}
              cx="21"
              cy="21"
              r={R}
              fill="none"
              stroke={it.color}
              strokeWidth="6"
              style={{
                strokeDasharray: `${pct} ${100 - pct}`,
                strokeDashoffset: offset,
                opacity: it.highlight === false ? 0.35 : 1,
                transition: `stroke-dasharray 600ms ${EASE}, stroke-dashoffset 600ms ${EASE}, opacity 500ms`,
              }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className={`font-display leading-none font-extrabold tabular-nums ${lg ? 'text-[clamp(2rem,5vw,6rem)]' : 'text-3xl'}`}>{total}</div>
            <div className={lg ? 'text-[clamp(1rem,1.5vw,1.75rem)] opacity-70' : 'text-xs opacity-70'}>votes</div>
          </div>
        </div>
      </div>
      <ul className={`flex min-w-0 flex-col ${lg ? 'gap-[1.5vh] text-[length:calc(clamp(1rem,2vw,2.2rem)*var(--fit,1))]' : 'gap-1 text-sm'}`}>
        {segs.map(({ it, pct }, i) => (
          <li key={it.key} className={`flex items-start gap-2 font-bold transition-opacity duration-500 ${it.highlight === false ? 'opacity-35' : ''}`}>
            <Shape i={i} className="mt-[0.25em] size-[1em] shrink-0" style={{ color: it.color }} />
            <span className="min-w-0 flex-1 break-words">{it.label}</span>
            <span className="w-[3.2em] shrink-0 text-right opacity-80 tabular-nums">{Math.round(pct)}%</span>
            {it.highlight && <span>✅</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
