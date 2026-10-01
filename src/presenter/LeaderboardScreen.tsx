import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { LeaderRow } from '../../shared/protocol';
import CountUp from './CountUp';

const TINTS = ['bg-yellow-400/25 ring-2 ring-yellow-300', 'bg-slate-200/20 ring-2 ring-slate-200', 'bg-amber-700/35 ring-2 ring-amber-600'];

// Remembers the previously shown order so each new leaderboard starts there and visibly reshuffles.
let lastShown: LeaderRow[] = [];

export default function LeaderboardScreen({ top }: { top: LeaderRow[] }) {
  const [rows, setRows] = useState(() => (lastShown.length > 0 ? lastShown : top));
  const signature = top.map((r) => `${r.id}:${r.score}:${r.rank}`).join('|');

  // Keyed on the ranking's content: admin updates arrive with a new `top` array every flush.
  useEffect(() => {
    lastShown = top;
    const id = setTimeout(() => setRows(top), 900);
    return () => clearTimeout(id);
  }, [signature]);

  return (
    <div className="flex h-full flex-col px-[max(4vw,13.5rem)] py-[4vh]">
      <h1 className="text-center font-display text-[clamp(2.5rem,5vw,5rem)] font-extrabold">🏆 Leaderboard</h1>
      {rows.length === 0 ? (
        <p className="mt-[10vh] text-center text-[clamp(1.5rem,3vw,3rem)] opacity-70">No scores yet — the quiz is coming! 🤓</p>
      ) : (
        <ol className="mx-auto mt-[3vh] flex w-full max-w-6xl flex-col gap-[1.2vh]">
          {rows.map((row) => (
            <motion.li
              key={row.id}
              layout
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className={`flex items-center gap-[2vw] rounded-2xl px-[2vw] py-[1.1vh] text-[clamp(1.25rem,2.4vw,2.6rem)] font-bold ${TINTS[row.rank - 1] ?? 'bg-white/10'}`}
            >
              <span className="w-[3.5ch] tabular-nums">#{row.rank}</span>
              <span className="relative">
                {row.rank === 1 && <span className="animate-bob absolute -top-[0.9em] left-0 inline-block text-[0.8em]">👑</span>}
                {row.avatar}
              </span>
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              {row.streak >= 2 && <span className="text-[0.8em]">🔥{row.streak}</span>}
              <CountUp value={row.score} />
            </motion.li>
          ))}
        </ol>
      )}
    </div>
  );
}
