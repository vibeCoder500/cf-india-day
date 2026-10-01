import { useSecondsLeft } from '../lib/hooks';

export default function TimerBar({ endsAt, startedAt, big = false }: { endsAt: number | null; startedAt: number; big?: boolean }) {
  const left = useSecondsLeft(endsAt);
  if (endsAt === null || left === null) return null;
  const total = Math.max(1, (endsAt - startedAt) / 1000);
  const low = left <= 5;
  return (
    <div className="flex items-center gap-3" role="timer" aria-label={`${left} seconds left`}>
      <div className={`flex-1 overflow-hidden rounded-full bg-white/15 ${big ? 'h-5' : 'h-3'}`}>
        <div
          className={`h-full rounded-full ${low ? 'bg-red-500' : 'bg-saffron'}`}
          style={{ width: `${Math.min(100, (left / total) * 100)}%`, transition: 'width 1s linear' }}
        />
      </div>
      <span
        key={low ? left : 'calm'}
        className={`min-w-[2ch] text-right font-display font-extrabold tabular-nums ${big ? 'text-5xl' : 'text-xl'} ${low ? 'animate-shake text-red-400' : ''}`}
      >
        {left}
      </span>
    </div>
  );
}
