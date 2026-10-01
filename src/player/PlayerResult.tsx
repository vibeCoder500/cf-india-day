import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Question, ViewMsg } from '../../shared/protocol';
import { burst } from '../lib/celebrate';
import { ANIMALS } from '../../shared/constants';
import { fmt } from '../lib/format';
import { CHEERS, OOPS, pick } from '../lib/fun';
import MiniResults from './MiniResults';

export default function PlayerResult({ view, q }: { view: ViewMsg; q: Question }) {
  const { me } = view;
  const correct = me.result?.correct === true;

  useEffect(() => {
    if (correct) burst();
  }, [correct]);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-center text-lg font-semibold opacity-80">{q.text}</p>
      <Outcome view={view} q={q} />
      <p className="text-center text-lg font-bold">
        You're #{me.rank} · {me.score.toLocaleString('en-IN')} pts
      </p>
    </div>
  );
}

function Card({ tone, children }: { tone: 'good' | 'bad' | 'neutral'; children: ReactNode }) {
  const bg = tone === 'good' ? 'bg-green-600' : tone === 'bad' ? 'bg-red-600' : 'bg-white/10';
  return (
    <div className={`${tone === 'bad' ? 'animate-shake' : 'animate-pop'} grid min-h-[50dvh] place-items-center rounded-3xl p-6 text-center ${bg}`}>
      {children}
    </div>
  );
}

function Outcome({ view, q }: { view: ViewMsg; q: Question }) {
  const { me, results } = view;
  const first = me.answers[0];
  const unit = q.unit ? ` ${q.unit}` : '';
  const [cheer] = useState(() => pick(CHEERS));
  const [oops] = useState(() => pick(OOPS));

  if (q.type === 'quiz') {
    if (!first) {
      return (
        <Card tone="neutral">
          <div>
            <p className="font-display text-4xl font-extrabold">No answer this time ⏰</p>
            <p className="mt-3 text-lg">Were you getting chai? ☕</p>
          </div>
        </Card>
      );
    }
    if (me.result?.correct) {
      return (
        <Card tone="good">
          <div>
            <p className="font-display text-5xl font-extrabold">Correct! 🎉</p>
            <p className="mt-2 text-xl font-bold">{cheer}</p>
            {me.result.points > 0 && <p className="mt-3 animate-boing font-display text-4xl font-extrabold">+{me.result.points.toLocaleString('en-IN')}</p>}
            {me.streak >= 2 && <p className="mt-3 text-2xl font-bold">🔥 {me.streak} in a row!</p>}
          </div>
        </Card>
      );
    }
    return (
      <Card tone="bad">
        <div>
          <p className="font-display text-5xl font-extrabold">Oops 😅</p>
          {q.correct !== null && <p className="mt-3 text-2xl font-bold">Answer: {q.options[q.correct]}</p>}
          <p className="mt-3 text-lg">{oops}</p>
        </div>
      </Card>
    );
  }

  if (q.type === 'number') {
    if (!first || !('number' in first)) return <Card tone="neutral"><p className="font-display text-4xl font-extrabold">No guess this time ⏰</p></Card>;
    const mine = first.number;
    if (q.correct === null) {
      return (
        <Card tone="neutral">
          <div>
            <p className="text-2xl font-bold">
              Your guess: {fmt(mine)}
              {unit}
            </p>
            <p className="mt-3 text-xl">Look at the big screen 👀</p>
          </div>
        </Card>
      );
    }
    const points = me.result?.points ?? 0;
    return (
      <Card tone={points > 0 ? 'good' : 'neutral'}>
        <div>
          <p className="font-display text-4xl font-extrabold">
            Answer: {fmt(q.correct)}
            {unit}
          </p>
          <p className="mt-3 text-xl">
            You guessed {fmt(mine)} (off by {fmt(Math.abs(mine - q.correct))})
          </p>
          {points > 0 && <p className="mt-4 font-display text-3xl font-extrabold">🎯 Top-3 closest! +{points.toLocaleString('en-IN')}</p>}
          {points > 0 && <p className="mt-2 text-lg font-bold">{cheer}</p>}
        </div>
      </Card>
    );
  }

  if (q.type === 'open') {
    return <Card tone="neutral"><p className="font-display text-3xl font-extrabold">Thanks for sharing! ✨ Look at the big screen</p></Card>;
  }

  if (q.type === 'animal') {
    const a = first && 'choice' in first ? ANIMALS[q.options[first.choice]] : undefined;
    if (!a) return <Card tone="neutral"><p className="font-display text-4xl font-extrabold">No pick this time ⏰</p></Card>;
    return (
      <Card tone="neutral">
        <div>
          <p className="animate-float text-8xl">{a.emoji}</p>
          <p className="mt-4 font-display text-4xl font-extrabold">
            You're {/^[aeiou]/i.test(a.name) ? 'an' : 'a'} {a.name}!
          </p>
          <p className="mt-3 inline-block rounded-full px-4 py-1.5 text-lg font-bold" style={{ background: a.color, color: a.ink }}>
            {a.trait}
          </p>
          <p className="mt-2 text-lg opacity-90">{a.tags.join(' · ')}</p>
          <p className="mt-4 text-lg">Look at the big screen 👀</p>
        </div>
      </Card>
    );
  }

  return results ? (
    <MiniResults q={q} results={results} />
  ) : (
    <Card tone="neutral"><p className="font-display text-3xl font-extrabold">Look at the big screen 👀</p></Card>
  );
}
