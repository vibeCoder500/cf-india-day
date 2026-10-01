import { useState } from 'react';
import type { Question, ViewMsg } from '../../shared/protocol';
import { OPTION_COLORS } from '../../shared/constants';
import { client, useGame } from '../lib/client';
import { pick, PICKED, puffFrom, useQuip, WAITING } from '../lib/fun';
import { useSecondsLeft } from '../lib/hooks';
import Shape from '../components/Shape';
import MiniResults from './MiniResults';

export default function AnswerChoice({ view, q }: { view: ViewMsg; q: Question }) {
  const secondsLeft = useSecondsLeft(view.game.endsAt);
  const errorAt = useGame((s) => s.error?.at ?? 0);
  const [tap, setTap] = useState<{ choice: number; at: number } | null>(null);
  const [quip, setQuip] = useState('');
  const waiting = useQuip(WAITING);
  const first = view.me.answers[0];
  const confirmed = first && 'choice' in first ? first.choice : null;
  // Optimistic highlight until the server confirms; an error after the tap reverts to the server's answer.
  const selected = tap && tap.at > errorAt ? tap.choice : confirmed;
  const quiz = q.type === 'quiz';
  const locked = quiz && selected !== null;
  const closed = secondsLeft === 0;
  // Long options get smaller text so they all fit on the phone with less scrolling.
  const longest = Math.max(...q.options.map((o) => o.length));
  const textSize = longest > 120 ? 'text-sm' : longest > 60 ? 'text-base' : 'text-lg';

  const choose = (i: number, button: HTMLElement) => {
    if (closed || locked || i === selected) return;
    setTap({ choice: i, at: Date.now() });
    setQuip(pick(PICKED));
    puffFrom(button, quiz ? '🔒' : pick(['😎', '🤔', '🙌', '🌶️', '💯']));
    client.answer(q.id, { choice: i });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {q.options.map((label, i) => {
          const isSel = selected === i;
          return (
            <button
              key={i}
              type="button"
              disabled={closed || locked}
              onClick={(e) => choose(i, e.currentTarget)}
              className={`flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ${textSize} font-bold text-white shadow-lg transition active:scale-[0.98] ${
                isSel ? 'ring-4 ring-white' : ''
              } ${(locked || closed) && !isSel ? 'opacity-40' : ''}`}
              style={{ background: OPTION_COLORS[i] }}
            >
              <Shape i={i} className="size-7 shrink-0" />
              <span className="flex-1 break-words">{label}</span>
              {isSel && <span className="animate-boing text-2xl">✓</span>}
            </button>
          );
        })}
      </div>
      <p className="text-center font-semibold opacity-80">
        {closed ? "Time's up ⏰" : locked ? 'Locked in 🔒 — waiting for others' : quiz ? '' : 'You can change your vote until voting closes'}
      </p>
      {!closed && quip && (
        <p key={locked ? waiting : `${quip}:${selected}`} className="animate-boing text-center text-lg font-bold text-saffron">
          {locked ? waiting : quip}
        </p>
      )}
      {view.results && <MiniResults q={q} results={view.results} />}
    </div>
  );
}
