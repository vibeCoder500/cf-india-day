import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Size } from './adapters';

// One entry at a time, auto-advancing every 5 s through the latest 50.
export default function Spotlight({ items, total, size }: { items: { id: number; text: string }[]; total: number; size: Size }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  const list = items.slice(0, 50);
  if (list.length === 0) return null;
  const i = tick % list.length;
  const it = list[i];
  const lg = size === 'lg';
  return (
    <div className={`flex flex-col items-center justify-center text-center ${lg ? 'h-full' : 'min-h-40'}`}>
      <AnimatePresence mode="wait">
        <motion.blockquote
          key={it.id}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 0.4 }}
          className={`max-w-[85%] font-display leading-tight font-extrabold break-words ${lg ? 'text-[clamp(2rem,4.5vw,5rem)]' : 'text-xl'}`}
        >
          “{it.text}”
        </motion.blockquote>
      </AnimatePresence>
      <p className={`mt-[3vh] font-bold opacity-70 tabular-nums ${lg ? 'text-[clamp(1rem,1.6vw,1.8rem)]' : 'text-xs'}`}>
        {i + 1} / {total}
      </p>
    </div>
  );
}
