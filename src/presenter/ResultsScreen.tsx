import type { AdminState, Question } from '../../shared/protocol';
import { ANIMALS } from '../../shared/constants';
import { fmt } from '../lib/format';
import ResultView from '../viz/ResultView';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function ResultsScreen({ admin, q }: { admin: AdminState; q: Question }) {
  const r = admin.results;
  const unit = q.unit ? ` ${q.unit}` : '';
  return (
    <div className="flex h-full flex-col gap-[2vh] px-[max(4vw,13.5rem)] py-[3vh]">
      <h1 className="text-center font-display text-[clamp(1.5rem,3vw,3.25rem)] leading-tight font-extrabold break-words">{q.text}</h1>
      <div className="min-h-0 flex-1">{r && <ResultView q={q} results={r} display={q.display} revealed size="lg" />}</div>

      {r?.kind === 'choice' && q.type === 'quiz' && q.correct !== null && (
        <div className="flex flex-wrap justify-center gap-x-[3vw] gap-y-2 text-[clamp(1.25rem,2.2vw,2.5rem)] font-bold">
          <span>
            ✅ {r.counts[q.correct] ?? 0} got it right ({r.total ? Math.round(((r.counts[q.correct] ?? 0) / r.total) * 100) : 0}%)
          </span>
          {r.fastest && (
            <span>
              ⚡ Fastest: {r.fastest.name} ({(r.fastest.ms / 1000).toFixed(1)}s)
            </span>
          )}
        </div>
      )}

      {r?.kind === 'numbers' && q.correct !== null && q.display !== 'closest' && (
        <div className="flex flex-wrap items-center justify-center gap-x-[2.5vw] gap-y-2 text-[clamp(1.1rem,2vw,2.25rem)] font-bold">
          <span className="text-saffron">
            🎯 Answer: {fmt(q.correct)}
            {unit}
          </span>
          {r.closest.map((c, i) => (
            <span key={i}>
              {MEDALS[i]} {c.avatar} {c.name} — {fmt(c.value)}
              {unit}
            </span>
          ))}
        </div>
      )}

      {r?.kind === 'animals' && r.total > 0 && (
        <div className="flex flex-wrap justify-center gap-x-[2.5vw] gap-y-2 text-[clamp(1.1rem,2vw,2.25rem)] font-bold">
          {r.counts
            .map((count, i) => ({ count, a: ANIMALS[q.options[i]] }))
            .filter((x) => x.count > 0 && x.a)
            .sort((x, y) => y.count - x.count)
            .slice(0, 5)
            .map(({ count, a }) => (
              <span key={a.name}>
                {a.emoji} {a.name} ×{count}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
