import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { LeaderRow } from '../../shared/protocol';
import { burst, sideCannons } from '../lib/celebrate';

const PILLARS = [
  { index: 1, stage: 2, height: '45%', medal: '🥈', color: 'from-slate-200 to-slate-500' },
  { index: 0, stage: 3, height: '65%', medal: '🥇', color: 'from-yellow-300 to-amber-500' },
  { index: 2, stage: 1, height: '32%', medal: '🥉', color: 'from-amber-500 to-amber-800' },
];

export default function PodiumScreen({ top }: { top: LeaderRow[] }) {
  const [stage, setStage] = useState(0);

  // 3rd at 0.5 s, 2nd at 2 s, 1st at 3.5 s, then confetti and gentle bursts every 3 s.
  useEffect(() => {
    let loop: ReturnType<typeof setInterval> | undefined;
    const timers = [
      setTimeout(() => setStage(1), 500),
      setTimeout(() => setStage(2), 2000),
      setTimeout(() => {
        setStage(3);
        sideCannons(4000);
        burst(2);
        loop = setInterval(() => burst(0.6), 3000);
      }, 3500),
    ];
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(loop);
    };
  }, []);

  return (
    <div className="flex h-full flex-col px-[max(4vw,13.5rem)] pt-[4vh]">
      <h1 className="text-center font-display text-[clamp(2.5rem,5vw,5rem)] font-extrabold">🥇 Podium</h1>
      {top.length === 0 ? (
        <p className="mt-[10vh] text-center text-[clamp(1.5rem,3vw,3rem)] opacity-70">No scores yet 🤷</p>
      ) : (
        <div className="mx-auto flex w-full max-w-6xl flex-1 items-end justify-center gap-[2vw]">
          {PILLARS.map((p) => {
            const row = top[p.index];
            if (!row) return <div key={p.index} className="flex-1" />;
            const shown = stage >= p.stage;
            return (
              <div key={p.index} className="flex h-full flex-1 flex-col items-center justify-end">
                {shown && (
                  <motion.div
                    initial={{ opacity: 0, y: 40, scale: 0.6 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                    className="mb-[2vh] w-full text-center"
                  >
                    <div className="text-[clamp(3rem,7vw,7rem)] leading-none">{row.avatar}</div>
                    <div className="mt-2 truncate font-display text-[clamp(1.5rem,3vw,3.25rem)] leading-tight font-extrabold">{row.name}</div>
                    <div className="text-[clamp(1rem,1.8vw,2rem)] font-bold opacity-90">{row.score.toLocaleString('en-IN')} pts</div>
                  </motion.div>
                )}
                <motion.div
                  initial={{ height: '0%' }}
                  animate={{ height: shown ? p.height : '0%' }}
                  transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                  className={`grid w-full justify-center overflow-hidden rounded-t-3xl bg-linear-to-b pt-[2vh] text-[clamp(3rem,6vw,6rem)] leading-none shadow-2xl ${p.color}`}
                >
                  {p.medal}
                </motion.div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
