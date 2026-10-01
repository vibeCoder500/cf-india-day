import type { Question, Results } from '../../shared/protocol';
import { AWESOME, OPTION_COLORS, awesomeAt } from '../../shared/constants';

// Small phone-sized results: bars for choices, a histogram for ratings, chips for words.
export default function MiniResults({ q, results }: { q: Question; results: Results }) {
  if (results.kind === 'choice') {
    const total = Math.max(results.total, 1);
    return (
      <ul className="flex flex-col gap-2 rounded-2xl bg-white/5 p-4">
        {q.options.map((label, i) => {
          const pct = Math.round(((results.counts[i] ?? 0) / total) * 100);
          const right = q.type === 'quiz' && q.correct === i;
          return (
            <li key={i} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="min-w-0 break-words">
                  {right && '✅ '}
                  {label}
                </span>
                <span className="shrink-0 font-bold tabular-nums">{pct}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: OPTION_COLORS[i] }} />
              </div>
            </li>
          );
        })}
        <li className="text-xs opacity-60">{results.total} votes</li>
      </ul>
    );
  }
  if (results.kind === 'scale') {
    const max = Math.max(1, ...results.counts);
    const awesome = q.type === 'awesome';
    const level = awesomeAt(results.avg);
    return (
      <div className="rounded-2xl bg-white/5 p-4">
        <div className="flex h-20 items-end gap-1">
          {results.counts.map((c, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-saffron transition-[height] duration-500"
              style={{ height: `${(c / max) * 100}%`, background: awesome ? AWESOME[i].color : undefined }}
            />
          ))}
        </div>
        <div className={`mt-1 flex gap-1 text-center ${awesome ? 'text-lg' : 'text-xs opacity-70'}`}>
          {results.counts.map((_, i) => (
            <span key={i} className="flex-1">
              {awesome ? AWESOME[i].emoji : q.min + i}
            </span>
          ))}
        </div>
        <p className="mt-2 text-center font-bold">
          {awesome && results.total > 0 ? `${level.emoji} ${level.label} on average` : `Average ${results.avg.toFixed(1)}`} · {results.total} ratings
        </p>
      </div>
    );
  }
  if (results.kind === 'words') {
    return (
      <div className="flex flex-wrap justify-center gap-2 rounded-2xl bg-white/5 p-4">
        {results.words.slice(0, 12).map((w) => (
          <span key={w.text} className="rounded-full bg-white/10 px-3 py-1 text-sm">
            {w.text} <b>{w.count}</b>
          </span>
        ))}
      </div>
    );
  }
  return null;
}
