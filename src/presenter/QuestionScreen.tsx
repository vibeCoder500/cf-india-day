import type { AdminState, Question } from '../../shared/protocol';
import { OPTION_COLORS, TYPE_INFO } from '../../shared/constants';
import Shape from '../components/Shape';
import TimerBar from '../components/TimerBar';
import Fit from '../viz/Fit';
import ResultView from '../viz/ResultView';

export default function QuestionScreen({ admin, q }: { admin: AdminState; q: Question }) {
  const { game } = admin;
  const info = TYPE_INFO[q.type];
  const pct = admin.online > 0 ? Math.min(100, (admin.answered / admin.online) * 100) : 0;
  return (
    <div className="flex h-full flex-col gap-[2vh] px-[max(4vw,13.5rem)] py-[3vh]">
      <div className="flex items-center gap-3 text-[clamp(1rem,1.6vw,1.75rem)] font-bold">
        <span className="rounded-full bg-saffron/20 px-4 py-1 text-saffron">
          {info.icon} {info.label}
        </span>
      </div>
      <TimerBar endsAt={game.endsAt} startedAt={game.startedAt} big />
      <h1 className="text-center font-display text-[clamp(2rem,4vw,4.5rem)] leading-tight font-extrabold break-words">{q.text}</h1>
      <div className="min-h-0 flex-1">
        {game.liveOnScreen && admin.results ? (
          <ResultView q={q} results={admin.results} display={q.display} size="lg" />
        ) : q.type === 'poll' || q.type === 'quiz' ? (
          <OptionTiles q={q} />
        ) : (
          <div className="grid h-full place-items-center text-center">
            <div>
              <div className="animate-wiggle inline-block text-[clamp(4rem,12vh,10rem)]">📱</div>
              <p className="mt-[2vh] font-display text-[clamp(2rem,4vw,4.5rem)] font-extrabold">Answer on your phone!</p>
            </div>
          </div>
        )}
      </div>
      <div>
        <p className="text-[clamp(1rem,1.6vw,1.75rem)] font-bold tabular-nums">
          <span key={admin.answered} className="inline-block animate-boing">
            {admin.answered}
          </span>{' '}
          answered <span className="opacity-60">of {admin.online}</span>
        </p>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-green-400 transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

// Kahoot-style tiles without counts: 2×2 for up to four options, 3×2 for five or six.
function OptionTiles({ q }: { q: Question }) {
  const n = q.options.length;
  const cols = n === 3 || n > 4 ? 3 : 2;
  return (
    <Fit watch={q.options.join('\n')}>
      <div
        className="grid h-full content-center gap-[1.5vw] text-[length:calc(clamp(1.5rem,2.6vw,3rem)*var(--fit,1))]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {q.options.map((label, i) => (
          <div
            key={i}
            className="flex items-center gap-[0.5em] rounded-3xl px-[0.8em] py-[0.65em] font-bold shadow-xl"
            style={{ background: OPTION_COLORS[i] }}
          >
            <Shape i={i} className="size-[1.4em] shrink-0" />
            <span className="min-w-0 break-words">{label}</span>
          </div>
        ))}
      </div>
    </Fit>
  );
}
