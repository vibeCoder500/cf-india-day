import { useState } from 'react';
import type { Question, ViewMsg } from '../../shared/protocol';
import { ANIMALS } from '../../shared/constants';
import { client, useGame } from '../lib/client';
import { puffFrom } from '../lib/fun';
import { useSecondsLeft } from '../lib/hooks';
import AnimalCard from '../components/AnimalCard';

export default function AnswerAnimal({ view, q }: { view: ViewMsg; q: Question }) {
  const secondsLeft = useSecondsLeft(view.game.endsAt);
  const errorAt = useGame((s) => s.error?.at ?? 0);
  const [tap, setTap] = useState<{ choice: number; at: number } | null>(null);
  const first = view.me.answers[0];
  const confirmed = first && 'choice' in first ? first.choice : null;
  // Optimistic highlight until the server confirms; an error after the tap reverts to the server's pick.
  const selected = tap && tap.at > errorAt ? tap.choice : confirmed;
  const closed = secondsLeft === 0;

  const choose = (i: number, card: HTMLElement) => {
    if (closed || i === selected) return;
    setTap({ choice: i, at: Date.now() });
    puffFrom(card, ANIMALS[q.options[i]].emoji);
    client.answer(q.id, { choice: i });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {q.options.map((key, i) => (
          <AnimalCard
            key={key}
            animal={ANIMALS[key]}
            selected={selected === i}
            dim={closed && selected !== i}
            disabled={closed}
            onClick={(e) => choose(i, e.currentTarget)}
          />
        ))}
      </div>
      <p className="text-center font-semibold opacity-80">
        {closed
          ? "Time's up ⏰"
          : selected !== null
            ? `${view.game.liveOnScreen ? 'Your bubble is on the big screen 🫧' : 'Got it 👍'} · You can switch until voting closes`
            : ''}
      </p>
    </div>
  );
}
