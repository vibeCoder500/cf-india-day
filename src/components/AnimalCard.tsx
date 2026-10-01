import type { MouseEvent } from 'react';
import type { Animal } from '../../shared/constants';

// Phone-sized version of the "Meet the animals" slide card.
export default function AnimalCard({
  animal,
  selected = false,
  dim = false,
  disabled = false,
  onClick,
}: {
  animal: Animal;
  selected?: boolean;
  dim?: boolean;
  disabled?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${animal.name}: ${animal.trait}, ${animal.tags.join(', ')}`}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex flex-col overflow-hidden rounded-2xl bg-white text-left text-night shadow-lg transition active:scale-[0.97] ${
        selected ? 'scale-[1.02] ring-4 ring-saffron' : ''
      } ${dim ? 'opacity-40' : ''}`}
    >
      <span className="h-1.5 w-full shrink-0" style={{ background: animal.color }} />
      <span className="flex flex-1 flex-col gap-2 p-2.5">
        <span className="flex min-h-9 items-center gap-2 pr-6">
          <span className="text-3xl leading-none">{animal.emoji}</span>
          <span className="flex min-w-0 flex-col items-start gap-1">
            <span className="font-display text-[15px] leading-none font-extrabold tracking-wide uppercase">{animal.name}</span>
            {animal.wild && <span className="rounded bg-[#e46c0b] px-1.5 py-0.5 text-[9px] leading-none font-extrabold tracking-wide text-white">WILD CARD</span>}
          </span>
        </span>
        <span className="rounded-full px-2 py-1.5 text-center text-xs font-bold" style={{ background: animal.color, color: animal.ink }}>
          {animal.trait}
        </span>
        <span className="flex flex-col gap-1">
          {animal.tags.map((t) => (
            <span key={t} className="rounded-full bg-slate-100 px-2 py-1 text-center text-[11px] font-semibold text-slate-700 shadow-sm">
              {t}
            </span>
          ))}
        </span>
      </span>
      {selected && (
        <span className="animate-boing absolute top-3 right-2 grid size-7 place-items-center rounded-full bg-saffron text-base font-black text-night shadow">
          ✓
        </span>
      )}
    </button>
  );
}
