import { EASE } from './adapters';
import type { Item, Size } from './adapters';

export default function Versus({ items, total, size }: { items: Item[]; total: number; size: Size }) {
  const [a, b] = items;
  if (!a || !b) return null;
  const lg = size === 'lg';
  const pa = total ? Math.round((a.count / total) * 100) : 50;
  const pb = 100 - pa;
  const lead = a.count === b.count ? null : a.count > b.count ? a.key : b.key;
  return (
    <div className={`flex flex-col justify-center ${lg ? 'h-full gap-[2vh]' : 'gap-2'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className={`font-display leading-none font-extrabold tabular-nums ${lg ? 'text-[clamp(3rem,8vw,9rem)]' : 'text-4xl'}`}>{pa}%</div>
          <div className={`font-bold break-words ${lg ? 'text-[length:calc(clamp(1.5rem,3vw,3.5rem)*var(--fit,1))]' : 'text-base'}`}>{a.label}</div>
        </div>
        <div className="min-w-0 flex-1 text-right">
          <div className={`font-display leading-none font-extrabold tabular-nums ${lg ? 'text-[clamp(3rem,8vw,9rem)]' : 'text-4xl'}`}>{pb}%</div>
          <div className={`font-bold break-words ${lg ? 'text-[length:calc(clamp(1.5rem,3vw,3.5rem)*var(--fit,1))]' : 'text-base'}`}>{b.label}</div>
        </div>
      </div>
      <div className={`relative flex shrink-0 overflow-hidden rounded-full ${lg ? 'h-[14vh]' : 'h-10'}`}>
        <div
          className={lead === a.key ? 'animate-pulse' : ''}
          style={{ width: `${pa}%`, background: a.color, transition: `width 600ms ${EASE}` }}
        />
        <div className={`flex-1 ${lead === b.key ? 'animate-pulse' : ''}`} style={{ background: b.color }} />
        <span
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-night font-display font-extrabold ring-4 ring-white ${
            lg ? 'px-[1.5vw] py-[1vh] text-[clamp(1.5rem,3vw,3rem)]' : 'px-3 py-1 text-sm'
          }`}
        >
          VS
        </span>
      </div>
      <div className={`flex justify-between opacity-80 ${lg ? 'text-[clamp(1rem,1.5vw,1.75rem)]' : 'text-xs'}`}>
        <span>{a.count} votes</span>
        <span>{b.count} votes</span>
      </div>
    </div>
  );
}
