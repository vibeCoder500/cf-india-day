import { useEffect } from 'react';
import type { ViewMsg } from '../../shared/protocol';
import { burst, sideCannons } from '../lib/celebrate';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function PlayerPodium({ view }: { view: ViewMsg }) {
  const { me, top, online } = view;
  const winner = me.rank >= 1 && me.rank <= 3;

  useEffect(() => {
    sideCannons(3000);
  }, []);

  useEffect(() => {
    if (winner) burst(1.5);
  }, [winner]);

  return (
    <div className="flex flex-col items-center gap-5 pt-4 text-center">
      <h2 className="font-display text-4xl font-extrabold">🏆 Podium</h2>
      {winner && <p className="animate-pop font-display text-4xl font-extrabold text-saffron">YOU'RE #{me.rank}!!! 🏆</p>}
      <ol className="flex w-full flex-col gap-3">
        {top.slice(0, 3).map((row) => (
          <li
            key={row.id}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-xl font-bold ${row.id === me.id ? 'bg-saffron text-night' : 'bg-white/10'}`}
          >
            <span className="text-3xl">{MEDALS[Math.min(row.rank, 3) - 1]}</span>
            <span className="text-2xl">{row.avatar}</span>
            <span className="min-w-0 flex-1 truncate">{row.name}</span>
            <span className="tabular-nums">{row.score.toLocaleString('en-IN')}</span>
          </li>
        ))}
      </ol>
      {/* Phones only know the online count, so never show a total smaller than the player's own rank. */}
      <p className="text-lg font-bold">
        You finished #{me.rank} of {Math.max(online, me.rank)} 👏
      </p>
    </div>
  );
}
