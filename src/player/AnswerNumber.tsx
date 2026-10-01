import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Question, ViewMsg } from '../../shared/protocol';
import { client, useGame } from '../lib/client';
import { fmt } from '../lib/format';
import { GUESSED, pick } from '../lib/fun';
import { useSecondsLeft } from '../lib/hooks';
import Button from '../components/Button';

export default function AnswerNumber({ view, q }: { view: ViewMsg; q: Question }) {
  const secondsLeft = useSecondsLeft(view.game.endsAt);
  const pending = useGame((s) => Object.keys(s.pending).length > 0);
  const [text, setText] = useState('');
  const [quip] = useState(() => pick(GUESSED));
  const first = view.me.answers[0];
  const mine = first && 'number' in first ? first.number : null;
  const closed = secondsLeft === 0;
  const unit = q.unit ? ` ${q.unit}` : '';
  const value = Number(text.replace(/[,\s]/g, ''));
  const typed = text.trim() !== '';
  const valid = typed && Number.isFinite(value) && value >= q.min && value <= q.max;

  if (mine !== null) {
    return (
      <div className="animate-boing rounded-2xl bg-white/10 p-6 text-center">
        <p className="text-2xl font-bold">
          Your guess: {fmt(mine)}
          {unit} 🔒
        </p>
        <p className="mt-2 font-bold text-saffron">{quip}</p>
      </div>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || pending || closed) return;
    client.answer(q.id, { number: value });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-5 ring-2 ring-white/20 focus-within:ring-saffron">
        <input
          autoFocus
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={closed}
          enterKeyHint="done"
          placeholder={`${fmt(q.min)} – ${fmt(q.max)}`}
          aria-label="Your guess"
          className="min-w-0 flex-1 bg-transparent py-4 text-2xl outline-none"
        />
        {q.unit && <span className="text-xl opacity-70">{q.unit}</span>}
      </div>
      {typed && !valid && (
        <p className="text-sm text-red-300">
          Between {fmt(q.min)} and {fmt(q.max)}
        </p>
      )}
      <Button type="submit" variant="primary" big disabled={!valid || pending || closed}>
        {pending ? 'Locking in…' : 'Lock in 🔒'}
      </Button>
      {closed && <p className="text-center font-semibold">Time's up ⏰</p>}
    </form>
  );
}
