import { useState } from 'react';
import type { Question, ViewMsg } from '../../shared/protocol';
import { AWESOME } from '../../shared/constants';
import { client, useGame } from '../lib/client';
import { puffFrom } from '../lib/fun';
import { useSecondsLeft } from '../lib/hooks';
import MiniResults from './MiniResults';

const FACES = ['😴', '😐', '🙂', '😀', '🤩'];

export default function AnswerScale({ view, q }: { view: ViewMsg; q: Question }) {
  const secondsLeft = useSecondsLeft(view.game.endsAt);
  const errorAt = useGame((s) => s.error?.at ?? 0);
  const [tap, setTap] = useState<{ rating: number; at: number } | null>(null);
  const first = view.me.answers[0];
  const confirmed = first && 'rating' in first ? first.rating : null;
  const selected = tap && tap.at > errorAt ? tap.rating : confirmed;
  const closed = secondsLeft === 0;
  const steps = Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i);
  const cols = steps.length <= 6 ? steps.length : Math.ceil(steps.length / 2);
  const awesome = q.type === 'awesome';
  const faces = awesome ? AWESOME.map((l) => l.emoji) : steps.length === 5 ? FACES : null;

  const pick = (r: number, button: HTMLElement) => {
    if (closed || r === selected) return;
    setTap({ rating: r, at: Date.now() });
    if (faces) puffFrom(button, faces[r - q.min], 2);
    client.answer(q.id, { rating: r });
  };

  return (
    <div className="flex flex-col gap-3">
      {awesome ? (
        <div className="flex flex-col gap-3">
          {AWESOME.map((l, i) => {
            const r = q.min + i;
            const on = selected === r;
            return (
              <button
                key={r}
                type="button"
                disabled={closed}
                onClick={(e) => pick(r, e.currentTarget)}
                className={`flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-2 text-left font-display text-2xl font-extrabold text-night shadow-lg transition active:scale-[0.98] ${
                  on ? 'ring-4 ring-white' : ''
                } ${closed && !on ? 'opacity-40' : ''}`}
                style={{ background: l.color }}
              >
                <span className={`text-3xl leading-none ${on ? 'animate-boing inline-block' : ''}`}>{l.emoji}</span>
                <span className="min-w-0 flex-1 break-words">{l.label}</span>
                <span className="hidden rounded-full bg-night/25 px-2 py-1 text-xs leading-none min-[360px]:inline-block" aria-hidden>
                  {'✨'.repeat(i + 1)}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {steps.map((r, i) => (
            <button
              key={r}
              type="button"
              disabled={closed}
              onClick={(e) => pick(r, e.currentTarget)}
              className={`flex min-h-16 flex-col items-center justify-center rounded-2xl py-2 font-display text-2xl font-extrabold transition active:scale-95 ${
                selected === r ? 'bg-saffron text-night ring-4 ring-white' : 'bg-white/10'
              } ${closed && selected !== r ? 'opacity-40' : ''}`}
            >
              {faces && <span className={`text-3xl leading-none ${selected === r ? 'animate-boing inline-block' : ''}`}>{faces[i]}</span>}
              <span>{r}</span>
            </button>
          ))}
        </div>
      )}
      {(q.minLabel || q.maxLabel) && (
        <div className="flex justify-between gap-4 text-sm opacity-80">
          <span>{q.minLabel}</span>
          <span className="text-right">{q.maxLabel}</span>
        </div>
      )}
      <p className="text-center font-semibold opacity-80">
        {closed ? "Time's up ⏰" : selected !== null ? 'You can change your rating until voting closes' : ''}
      </p>
      {view.results && <MiniResults q={q} results={view.results} />}
    </div>
  );
}
