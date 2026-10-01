import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { pick } from '../lib/fun';

const GUESTS = ['🐒', '🦚', '🐘', '🐯', '🦖', '🐧', '🦄', '🐼', '🦒', '🐸'];
const LINES = ['Namaste! 🙏', 'Is this the chai queue? ☕', 'Hi mom! 👋', 'Did I miss the quiz? 😳', 'Who ate my samosa? 🥟', 'Dance break? 💃', 'Am I on TV? 📺'];

type Guest = { id: number; emoji: string; line: string; left: boolean };

// Every half a minute or so an emoji friend peeks in from the side of the big screen, says something silly and ducks out.
export default function PhotoBomb() {
  const [guest, setGuest] = useState<Guest | null>(null);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer: ReturnType<typeof setTimeout>;
    const later = (ms: number) => {
      timer = setTimeout(() => {
        setGuest({ id: Date.now(), emoji: pick(GUESTS), line: pick(LINES), left: Math.random() < 0.5 });
        later(25_000 + Math.random() * 20_000);
      }, ms);
    };
    later(12_000);
    return () => clearTimeout(timer);
  }, []);

  if (!guest) return null;
  const off = guest.left ? '-120%' : '120%';
  return (
    <motion.div
      key={guest.id}
      className={`pointer-events-none fixed bottom-[18%] z-[36] flex items-center gap-3 ${guest.left ? 'left-0' : 'right-0 flex-row-reverse'}`}
      initial={{ x: off }}
      animate={{ x: [off, '0%', '0%', '0%', off], rotate: [0, -12, 12, -6, 0] }}
      transition={{ duration: 4.5, times: [0, 0.15, 0.5, 0.85, 1], ease: 'easeInOut' }}
      onAnimationComplete={() => setGuest(null)}
    >
      <span className="text-[clamp(4rem,9vw,9rem)] leading-none">{guest.emoji}</span>
      <span className="rounded-2xl bg-white px-4 py-2 text-[clamp(1rem,1.6vw,1.75rem)] font-bold whitespace-nowrap text-night shadow-xl">{guest.line}</span>
    </motion.div>
  );
}
