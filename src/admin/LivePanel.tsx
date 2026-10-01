import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AdminState, ClientMsg, Display, Phase, Question } from '../../shared/protocol';
import { DISPLAY_LABELS, FORMATS } from '../../shared/constants';
import { client } from '../lib/client';
import Button from '../components/Button';
import TimerBar from '../components/TimerBar';
import ResultView from '../viz/ResultView';
import ModerationPanel from './ModerationPanel';

const PHASE_BADGE: Record<Phase, string> = {
  lobby: '🏠 Lobby',
  question: '🔴 Voting open',
  results: '📊 Results',
  leaderboard: '🏆 Leaderboard',
  podium: '🥇 Podium',
};

const send = (m: ClientMsg) => client.send(m);

// Only the live event's questions. Lobby: the first one not asked yet (else the first one). Later: the one after the current question.
function nextQuestion(admin: AdminState): Question | null {
  const qs = admin.questions.filter((q) => q.eventId === admin.game.eventId);
  const unasked = qs.find((q) => !admin.asked[q.id]) ?? null;
  if (admin.game.phase === 'lobby') return unasked ?? qs[0] ?? null;
  const i = qs.findIndex((q) => q.id === admin.game.qid);
  return (i >= 0 ? qs[i + 1] : undefined) ?? unasked;
}

export default function LivePanel({ admin }: { admin: AdminState }) {
  const { game, questions } = admin;
  const eventQs = questions.filter((x) => x.eventId === game.eventId);
  const eventName = admin.events.find((e) => e.id === game.eventId)?.name;
  const q = questions.find((x) => x.id === game.qid) ?? null;
  const inQ = q !== null && (game.phase === 'question' || game.phase === 'results');
  const next = nextQuestion(admin);
  const num = (x: Question) => eventQs.indexOf(x) + 1;
  const formats: Display[] = q ? FORMATS[q.type].filter((d) => d !== 'versus' || q.options.length === 2) : [];
  const launch = (x: Question) => send({ t: 'launch', qid: x.id });
  const canStartNext = game.phase === 'lobby' || game.phase === 'results' || game.phase === 'leaderboard';

  // Laptop shortcuts; ignored while typing, with modifiers, or when a dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const k = e.key.toLowerCase();
      if (k === 'n' && next && canStartNext) launch(next);
      else if (k === 'c' && game.phase === 'question') send({ t: 'close' });
      else if (k === 'l') send({ t: 'phase', phase: 'leaderboard' });
      else if (k === 'p') send({ t: 'phase', phase: 'podium' });
      else if (k === 'd') send({ t: 'draw' });
      else if (inQ && /^[1-5]$/.test(k) && formats[Number(k) - 1]) send({ t: 'display', display: formats[Number(k) - 1] });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toLobby = <Button big onClick={() => send({ t: 'phase', phase: 'lobby' })}>🏠 Lobby</Button>;
  const draw = <Button big onClick={() => send({ t: 'draw' })}>🎰 Lucky draw</Button>;
  const celebrate = <Button big onClick={() => send({ t: 'celebrate' })}>🎉 Celebrate on big screen</Button>;
  const clear = q && (
    <Button
      big
      onClick={() =>
        confirm(`Clear all answers for Q${num(q)}? Its responses and points are deleted and everyone goes back to the lobby.`) &&
        send({ t: 'q:clear', id: q.id })
      }
    >
      🧹 Clear answers
    </Button>
  );
  const nextButton = (label: string) =>
    next && (
      <Button big variant="primary" onClick={() => launch(next)}>
        ▶ {label}Q{num(next)}
      </Button>
    );

  const actions: Record<Phase, ReactNode> = {
    lobby: (
      <>
        {nextButton('Start ')}
        {celebrate}
        {draw}
      </>
    ),
    question: (
      <>
        <Button big variant="danger" onClick={() => send({ t: 'close' })}>
          ⏹ Close voting
        </Button>
        {game.endsAt !== null ? (
          <Button big onClick={() => send({ t: 'extend', seconds: 15 })}>
            +15 s
          </Button>
        ) : (
          <Button big onClick={() => send({ t: 'extend', seconds: 10 })}>
            ⏱ Close in 10 s
          </Button>
        )}
        {clear}
      </>
    ),
    results: (
      <>
        {nextButton('Next: ')}
        <Button big onClick={() => send({ t: 'phase', phase: 'leaderboard' })}>
          🏆 Leaderboard
        </Button>
        {q && (
          <Button big onClick={() => confirm("Re-run this question? This clears this question's answers and points.") && launch(q)}>
            ↻ Re-run
          </Button>
        )}
        {clear}
      </>
    ),
    leaderboard: (
      <>
        {nextButton('Next: ')}
        <Button big onClick={() => send({ t: 'phase', phase: 'podium' })}>
          🥇 Podium
        </Button>
        {toLobby}
      </>
    ),
    podium: (
      <>
        {toLobby}
        {draw}
        {celebrate}
      </>
    ),
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl bg-white/5 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
          {eventName && <span className="rounded-full bg-saffron/20 px-3 py-1 text-saffron">🎪 {eventName}</span>}
          <span className={`rounded-full px-3 py-1 ${game.phase === 'question' ? 'animate-pulse bg-red-500 text-white' : 'bg-white/15'}`}>{PHASE_BADGE[game.phase]}</span>
          {q && (
            <span className="opacity-80">
              Q{num(q)}/{eventQs.length}
            </span>
          )}
        </div>
        <p className="mt-2 text-lg font-semibold">{q ? q.text : 'No question yet'}</p>
        {game.phase === 'question' && (
          <div className="mt-3 flex flex-col gap-2">
            <TimerBar endsAt={game.endsAt} startedAt={game.startedAt} />
            <p className="font-bold tabular-nums">
              {admin.answered}/{admin.online} answered
            </p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">{actions[game.phase]}</div>
        {eventQs.length === 0 && <p className="mt-3 text-sm opacity-70">No questions in “{eventName}” yet. Add some (or a template pack) in the Questions tab.</p>}
      </section>

      {game.draw && (
        <section className="flex items-center justify-between gap-3 rounded-2xl bg-saffron/15 p-4 ring-1 ring-saffron/40">
          <p className="font-bold">
            🎰 Picked: {game.draw.avatar} {game.draw.name}
          </p>
          <Button onClick={() => send({ t: 'draw:clear' })}>Clear</Button>
        </section>
      )}

      {q && inQ && (
        <section className="rounded-2xl bg-white/5 p-4">
          <h3 className="mb-2 text-sm font-bold tracking-wide uppercase opacity-70">Display</h3>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Display format">
            {formats.map((d, i) => (
              <button
                key={d}
                type="button"
                title={`Shortcut: ${i + 1}`}
                onClick={() => send({ t: 'display', display: d })}
                className={`rounded-xl px-3 py-2 text-sm font-bold ${q.display === d ? 'bg-saffron text-night' : 'bg-white/10 hover:bg-white/20'}`}
              >
                {DISPLAY_LABELS[d]}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-2 sm:grid-cols-2">
        {inQ && <Toggle label="Live results on screen" checked={game.liveOnScreen} onChange={(v) => send({ t: 'toggle', key: 'liveOnScreen', value: v })} />}
        {inQ && q && (q.type === 'poll' || q.type === 'scale' || q.type === 'awesome') && (
          <Toggle label="Mirror results on phones" checked={q.showOnPhones} onChange={(v) => send({ t: 'toggle', key: 'showOnPhones', value: v })} />
        )}
        <Toggle label="Reactions" checked={game.reactions} onChange={(v) => send({ t: 'toggle', key: 'reactions', value: v })} />
      </section>

      {q && inQ && admin.results && (
        <section className="rounded-2xl bg-white/5 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold tracking-wide uppercase opacity-70">Preview</h3>
            {game.phase === 'question' && !game.liveOnScreen && <span className="text-xs opacity-70">Hidden on the big screen until voting closes</span>}
          </div>
          <ResultView q={q} results={admin.results} display={q.display} revealed={game.phase === 'results'} size="sm" />
        </section>
      )}

      {q && inQ && admin.mod && (q.type === 'open' || q.type === 'wordcloud') && <ModerationPanel items={admin.mod} />}

      <p className="hidden text-xs opacity-60 lg:block">
        Shortcuts: N start next · C close · L leaderboard · P podium · D lucky draw · 1–5 display format
      </p>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
      <span className="text-sm font-semibold">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-saffron" />
    </label>
  );
}
