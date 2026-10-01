import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AVATARS, LIMITS } from '../../shared/constants';
import { client, useGame } from '../lib/client';
import { keepScreenOn } from '../lib/wakelock';
import MadeWith from '../components/MadeWith';

const EXAMPLES = ['Priya S', 'Rahul K', 'Chai Lover Anu ☕', 'DJ Vikram 🎧', 'Ananya 🌸', 'Captain Arjun 🧭'];

export default function Join() {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(() => AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const [sent, setSent] = useState(false);
  const [example, setExample] = useState(0);
  const error = useGame((s) => s.error);
  const status = useGame((s) => s.status);
  const trimmed = name.trim();
  const valid = Array.from(trimmed).length >= LIMITS.nameMin;
  const busy = sent && !error;

  useEffect(() => {
    const id = setInterval(() => setExample((i) => (i + 1) % EXAMPLES.length), 2500);
    return () => clearInterval(id);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    keepScreenOn();
    setSent(true);
    client.join(trimmed, avatar);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
        <h1 className="text-center font-display text-4xl font-extrabold">
          Who's joining the party? <span className="inline-block animate-wiggle">🎉</span>
        </h1>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoComplete="nickname"
            autoCapitalize="words"
            enterKeyHint="go"
            placeholder={`Your name (e.g. ${EXAMPLES[example]})`}
            className="rounded-2xl bg-white/10 px-5 py-4 text-xl outline-none ring-2 ring-white/20 focus:ring-saffron"
          />
          <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Pick an avatar">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={a === avatar}
                onClick={() => setAvatar(a)}
                className={`aspect-square rounded-xl text-3xl ${a === avatar ? 'animate-boing bg-saffron/90 ring-4 ring-white' : 'bg-white/10'}`}
              >
                {a}
              </button>
            ))}
          </div>
          {error && (
            <p key={error.at} className="animate-shake rounded-xl bg-red-500/20 px-4 py-3 text-center text-red-100">
              {error.message}
            </p>
          )}
          <button disabled={!valid || busy} className="rounded-full bg-saffron py-4 font-display text-2xl font-extrabold text-night disabled:opacity-40">
            {busy ? 'Joining…' : 'Join the fun 🚀'}
          </button>
          <p className="text-center text-sm opacity-70">
            No sign-up — just the name people know you by. {status !== 'open' && '· Connecting…'}
          </p>
        </form>
      </main>
      <MadeWith className="pb-[max(1rem,env(safe-area-inset-bottom))]" />
    </div>
  );
}
