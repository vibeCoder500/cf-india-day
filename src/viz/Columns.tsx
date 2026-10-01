import { Fragment } from 'react';
import Shape from '../components/Shape';
import { EASE } from './adapters';
import type { Item, Size } from './adapters';

export default function Columns({ items, size, shapes = false }: { items: Item[]; size: Size; shapes?: boolean }) {
  const max = Math.max(1, ...items.map((it) => it.count));
  const lg = size === 'lg';
  // Two grid rows (bars, labels) keep every column on one baseline and scale, however long a label wraps.
  return (
    <div
      className={`grid grid-flow-col gap-y-2 ${
        lg
          ? 'h-full min-h-[30vh] grid-rows-[minmax(45%,1fr)_auto] gap-x-[1.5vw] text-[length:calc(clamp(1rem,1.6vw,1.8rem)*var(--fit,1))]'
          : 'min-h-48 grid-rows-[minmax(6rem,1fr)_auto] gap-x-2 text-xs'
      }`}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it, i) => {
        const dim = `transition-opacity duration-500 ${it.highlight === false ? 'opacity-35' : ''}`;
        return (
          <Fragment key={it.key}>
            <div className={`relative ${dim}`}>
              {/* Top inset leaves room for the count label above a full-height column. */}
              <div className={`absolute inset-x-0 bottom-0 ${lg ? 'top-[1.6em]' : 'top-5'}`}>
                <div
                  className={`absolute inset-x-0 bottom-0 rounded-t-xl ${it.highlight ? 'ring-4 ring-white' : ''}`}
                  style={{ height: `${(it.count / max) * 100}%`, background: it.color, transition: `height 600ms ${EASE}` }}
                >
                  <span className="absolute inset-x-0 bottom-full mb-1 text-center font-bold whitespace-nowrap tabular-nums">
                    {it.highlight && '✅ '}
                    {it.count}
                  </span>
                </div>
              </div>
            </div>
            <div className={`flex items-start justify-center gap-1 text-center font-semibold ${dim}`}>
              {shapes && <Shape i={i} className="mt-[0.15em] size-[1em] shrink-0" style={{ color: it.color }} />}
              <span className="min-w-0 break-words">{it.label}</span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
