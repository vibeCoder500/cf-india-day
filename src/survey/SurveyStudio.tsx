import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { client, useGame } from '../lib/client';
import Button from '../components/Button';
import Toast from '../components/Toast';
import SurveyPanel from '../admin/survey/SurveyPanel';
import SoundToggle from './SoundToggle';

// /surveyAdmin: the hosts' studio, for surveys only. Hosts sign in with their host name (the same one the game
// console uses); a name without host access is refused and never becomes a game player.
export default function SurveyStudio() {
  const session = useGame((s) => s.session);
  if (session?.role !== 'admin') return <SignIn />;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
      <header className="glass flex flex-wrap items-center gap-3 px-5 py-4">
        <h1 className="mr-auto font-display text-2xl font-extrabold">📝 Survey studio</h1>
        <span className="text-sm opacity-75">🎤 {session.name}</span>
        <SoundToggle />
        <a href="/survey" target="_blank" rel="noreferrer" className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20">
          Open the survey ↗
        </a>
        <Button variant="ghost" onClick={() => confirm('Log out of the survey studio?') && client.leave()}>
          Log out
        </Button>
      </header>
      <main className="glass flex-1 p-4 sm:p-6">
        <SurveyPanel />
      </main>
      <Toast />
    </div>
  );
}

function SignIn() {
  const [name, setName] = useState('');
  const [sentAt, setSentAt] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const error = useGame((s) => s.error);
  const online = useGame((s) => s.status === 'open');
  const problem = timedOut
    ? "Couldn't reach the server — check your connection and try again"
    : sentAt && error && error.at >= sentAt
      ? error.message
      : null;
  const waiting = sentAt > 0 && !problem;

  // The sign-in is queued if the connection is still opening; give up (visibly) if nothing comes back.
  useEffect(() => {
    if (!waiting) return;
    const id = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(id);
  }, [waiting]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || waiting) return;
    client.clearError();
    setTimedOut(false);
    setSentAt(Date.now());
    client.send({ t: 'join', name: n, avatar: '🎤', hostOnly: true });
  };

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <form onSubmit={submit} className="glass relative flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
        <SoundToggle className="absolute top-3 right-3" />
        <p className="animate-float text-6xl">📝</p>
        <h1 className="font-display text-3xl font-extrabold">Survey studio</h1>
        <p className="opacity-80">Sign in with your host name to build surveys, launch them and read every response.</p>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSentAt(0);
            setTimedOut(false);
          }}
          maxLength={40}
          placeholder="Your host name"
          aria-label="Host name"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          className="w-full rounded-2xl bg-white/10 px-4 py-3 text-lg outline-none ring-1 ring-white/25 placeholder:text-white/50 focus:ring-2 focus:ring-saffron"
        />
        {problem && (
          <p role="alert" className="w-full rounded-xl bg-red-500/20 px-3 py-2 font-semibold text-red-100">
            {problem}
          </p>
        )}
        <Button type="submit" big variant="primary" className="w-full" disabled={!name.trim() || waiting}>
          {waiting ? 'Signing in…' : 'Sign in ▶'}
        </Button>
        {!online && !waiting && <p className="text-sm opacity-70">Connecting… you can sign in already.</p>}
        <a href="/survey" className="text-sm underline opacity-70">
          Looking for the survey? Answer it here
        </a>
      </form>
    </main>
  );
}
