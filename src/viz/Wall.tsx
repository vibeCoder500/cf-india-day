import { motion } from 'motion/react';
import { PALETTE } from '../../shared/constants';
import { hash } from './adapters';
import type { Size } from './adapters';

// Sticky notes, newest first. Never shows names.
export default function Wall({ items, size }: { items: { id: number; text: string }[]; size: Size }) {
  const lg = size === 'lg';
  const shown = items.slice(0, lg ? 40 : 12);
  return (
    <div className={lg ? 'h-full columns-2 gap-[1.5vw] overflow-hidden md:columns-3 xl:columns-4' : 'columns-2 gap-2'}>
      {shown.map((it) => {
        const h = hash(String(it.id));
        const color = PALETTE[h % PALETTE.length];
        return (
          <motion.div
            key={it.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`break-inside-avoid rounded-2xl font-semibold break-words shadow-lg ${
              lg ? 'mb-[1.5vw] p-[1.2vw] text-[clamp(1rem,1.5vw,1.6rem)]' : 'mb-2 p-2 text-xs'
            }`}
            style={{ background: `${color}33`, border: `2px solid ${color}66`, rotate: (h % 5) - 2 }}
          >
            {it.text}
          </motion.div>
        );
      })}
    </div>
  );
}
