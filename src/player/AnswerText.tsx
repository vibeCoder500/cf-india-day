import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Question, ViewMsg } from '../../shared/protocol';
import { LIMITS } from '../../shared/constants';
import { client, useGame } from '../lib/client';
import { pick, puffFrom } from '../lib/fun';
import { useSecondsLeft } from '../lib/hooks';
import Button from '../components/Button';

export default function AnswerText({ view, q }: { view: ViewMsg; q: Question }) {
  const secondsLeft = useSecondsLeft(view.game.endsAt);
  const pending = useGame((s) => Object.keys(s.pending).length > 0);
  const [text, setText] = useState('');
  const mine = view.me.answers.flatMap((a) => ('text' in a ? [a.text] : []));
  const count = mine.length;
  const seen = useRef(count);
  const box = useRef<HTMLDivElement>(null);

  // Keep the draft until the server has stored it, so a failed send can simply be retried.
  useEffect(() => {
    if (count > seen.current) {
      setText('');
      if (box.current) puffFrom(box.current, pick(['🚀', '💨', '📨', '✨']), 2);
    }
    seen.current = count;
  }, [count]);

  const word = q.type === 'wordcloud';
  const max = word ? LIMITS.word : LIMITS.text;
  const left = q.maxEntries - count;
  const closed = secondsLeft === 0;
  const trimmed = text.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || pending || closed || left <= 0) return;
    client.answer(q.id, { text: trimmed });
  };

  const inputClass = 'w-full rounded-2xl bg-white/10 px-5 py-4 text-xl outline-none ring-2 ring-white/20 focus:ring-saffron';

  return (
    <div ref={box} className="flex flex-col gap-4">
      {left <= 0 ? (
        <p className="animate-boing rounded-2xl bg-white/10 p-6 text-center text-xl font-bold">Thanks! ✨ Look at the big screen</p>
      ) : closed ? (
        <p className="rounded-2xl bg-white/10 p-6 text-center text-xl font-bold">Time's up ⏰</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          {word ? (
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={LIMITS.word}
              enterKeyHint="send"
              placeholder="A word or two"
              aria-label="Your answer"
              className={inputClass}
            />
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={LIMITS.text}
              rows={3}
              placeholder="Share a short thought"
              aria-label="Your answer"
              className={`${inputClass} resize-none`}
            />
          )}
          <div className="flex items-center justify-between text-sm opacity-70">
            <span>{count > 0 ? `${left} more to go` : q.maxEntries > 1 ? `Up to ${q.maxEntries} entries` : ''}</span>
            <span className="tabular-nums">
              {Array.from(text).length}/{max}
            </span>
          </div>
          <Button type="submit" variant="primary" big disabled={!trimmed || pending}>
            {pending ? 'Sending…' : 'Send ✨'}
          </Button>
        </form>
      )}
      {q.moderate && <p className="text-center text-sm opacity-70">🛡️ The host will approve entries before they appear</p>}
      {count > 0 && (
        <div>
          <p className="text-sm opacity-70">You said:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {mine.map((t, i) => (
              <span key={i} className="animate-pop rounded-full bg-white/15 px-3 py-1 break-words">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
