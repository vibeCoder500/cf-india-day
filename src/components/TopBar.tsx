import { useRef } from 'react';
import type { Me } from '../../shared/protocol';
import { confirmLeave, useGame } from '../lib/client';
import { partyMode, trick } from '../lib/fun';

export default function TopBar({ me }: { me: Me }) {
  const open = useGame((s) => s.status === 'open');
  const taps = useRef<number[]>([]);

  // Easter egg: five quick taps on your avatar start a rainbow party.
  const poke = (el: Element) => {
    trick(el);
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 2000), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      partyMode();
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-night/85 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <button type="button" aria-label="Your avatar" className="text-2xl" onClick={(e) => poke(e.currentTarget.firstElementChild!)}>
          <span className="inline-block">{me.avatar}</span>
        </button>
        <span className="min-w-0 flex-1 truncate font-display text-lg font-bold">{me.name}</span>
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm font-bold tabular-nums">
          ⭐ {me.score.toLocaleString('en-IN')} · #{me.rank}
        </span>
        <span className={`size-2.5 shrink-0 rounded-full ${open ? 'bg-green-400' : 'bg-amber-400'}`} title={open ? 'Connected' : 'Reconnecting'} />
        <button type="button" onClick={confirmLeave} className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm font-bold hover:bg-white/20">
          Log out
        </button>
      </div>
    </header>
  );
}
