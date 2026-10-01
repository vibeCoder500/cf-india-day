import Shape from '../components/Shape';
import { EASE } from './adapters';
import type { Item, Size } from './adapters';

export default function Bars({ items, total, size, shapes = false }: { items: Item[]; total: number; size: Size; shapes?: boolean }) {
  const max = Math.max(1, ...items.map((it) => it.count));
  const lg = size === 'lg';
  const wide = items.some((it) => it.label.length > 40);
  return (
    <ul className={`flex flex-col ${lg ? 'h-full justify-center gap-[1.6vh] text-[length:calc(clamp(1.1rem,2vw,2.2rem)*var(--fit,1))]' : 'gap-2 text-sm'}`}>
      {items.map((it, i) => {
        const pct = total ? Math.round((it.count / total) * 100) : 0;
        return (
          <li
            key={it.key}
            className={`flex items-center gap-3 transition-opacity duration-500 ${it.highlight === false ? 'opacity-35' : ''}`}
          >
            <span className={`flex shrink-0 items-start gap-2 font-bold ${wide ? 'w-[45%]' : 'w-[30%]'}`}>
              {shapes && <Shape i={i} className="mt-[0.2em] size-[1.1em] shrink-0" style={{ color: it.color }} />}
              <span className="min-w-0 break-words">{it.label}</span>
            </span>
            <span className={`relative flex-1 overflow-hidden rounded-full bg-white/10 ${lg ? 'h-[1.4em]' : 'h-4'} ${it.highlight ? 'ring-4 ring-white' : ''}`}>
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${(it.count / max) * 100}%`, background: it.color, transition: `width 600ms ${EASE}` }}
              />
            </span>
            <span className="w-[7.5em] shrink-0 text-right font-bold whitespace-nowrap tabular-nums">
              {it.highlight && '✅ '}
              {it.count} · {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
