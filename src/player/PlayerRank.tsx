import type { ViewMsg } from '../../shared/protocol';

export default function PlayerRank({ view }: { view: ViewMsg }) {
  const { me, top } = view;
  return (
    <div className="flex flex-col items-center gap-5 pt-4 text-center">
      <p className="text-lg opacity-80">You're</p>
      {me.rank >= 1 && me.rank <= 3 && <span className="animate-bob -mb-4 inline-block text-5xl">👑</span>}
      <p className="animate-boing font-display text-8xl leading-none font-extrabold text-saffron">#{me.rank}</p>
      <p className="text-2xl font-bold">
        {me.score.toLocaleString('en-IN')} pts{me.streak >= 2 && ` · 🔥 ${me.streak}`}
      </p>
      <ol className="flex w-full flex-col gap-2">
        {top.map((row) => (
          <li
            key={row.id}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left font-bold ${row.id === me.id ? 'bg-saffron text-night' : 'bg-white/10'}`}
          >
            <span className="w-8 tabular-nums">#{row.rank}</span>
            <span className="text-2xl">{row.avatar}</span>
            <span className="min-w-0 flex-1 truncate">{row.name}</span>
            <span className="tabular-nums">{row.score.toLocaleString('en-IN')}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
