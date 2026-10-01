import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { PublicSurvey, SurveyAnswers } from '../../shared/survey';
import { LIMITS } from '../../shared/constants';
import { client, useGame } from '../lib/client';
import { burst } from '../lib/celebrate';
import Button from '../components/Button';
import { clearDraft } from './draft';
import SurveyForm from './SurveyForm';

// The respondent's side of a survey. It stays pinned to the survey it was opened with, so a late answer (in the
// 2-minute grace after closing) is never switched to another survey, and wraps the form with done/closed/clash states.
export default function SurveyApp({ onExit }: { onExit: () => void }) {
  const live = useGame((s) => s.survey);
  const mine = useGame((s) => s.surveyMe);
  const sending = useGame((s) => s.surveySending !== null);
  const error = useGame((s) => s.error);
  const name = useGame((s) => s.session?.name ?? '');
  const gamePhase = useGame((s) => s.view?.game.phase);
  const [snap, setSnap] = useState<PublicSurvey | null>(() => client.state.survey);
  // Only a send from this screen earns the thank-you; otherwise "done" means it was answered earlier.
  const [sent, setSent] = useState(false);
  const [waited, setWaited] = useState(false);
  const [closed, setClosed] = useState(false);
  const [clash, setClash] = useState(false);
  const sentAt = useRef(0);
  const renamedAt = useRef(0);
  const nameAtClash = useRef('');
  const lastAnswers = useRef<SurveyAnswers | null>(null);

  useEffect(() => {
    if (live && (!snap || live.id === snap.id)) setSnap(live);
  }, [live, snap]);

  // The "already responded?" check normally answers in milliseconds; don't wait forever if it doesn't.
  useEffect(() => {
    const id = setTimeout(() => setWaited(true), 3000);
    return () => clearTimeout(id);
  }, []);

  const submit = (answers: SurveyAnswers) => {
    if (!snap) return;
    lastAnswers.current = answers;
    sentAt.current = Date.now();
    setSent(true);
    client.surveySubmit(snap.id, answers);
  };

  // Errors that arrive after a send change the screen; errors after a rename are shown in the rename card.
  useEffect(() => {
    if (!error || !sentAt.current || error.at < sentAt.current) return;
    if (renamedAt.current && error.at >= renamedAt.current) return;
    if (error.code === 'CLOSED') {
      setClosed(true);
      if (snap) clearDraft(snap.id);
    } else if (error.code === 'NAME_TAKEN') {
      nameAtClash.current = name;
      setClash(true);
    }
  }, [error, snap, name]);

  // The rename went through (the server re-sent the session with the new name): send again.
  useEffect(() => {
    if (!clash || !renamedAt.current || name === nameAtClash.current) return;
    renamedAt.current = 0;
    setClash(false);
    if (lastAnswers.current) submit(lastAnswers.current);
  }, [name, clash]);

  if (!snap) {
    return (
      <Message emoji="🙂" title="No survey is open right now" onExit={onExit}>
        Keep an eye on this app — the next one will show up here.
      </Message>
    );
  }
  const me = mine[snap.id];
  if (!me && !waited) return <p className="pt-10 text-center text-xl">Checking… 📝</p>;
  if (me?.done) return <Done thanks={snap.thanks} n={me.n} again={!sent} onExit={onExit} />;
  if (closed) {
    return (
      <Message emoji="⏰" title="This survey has closed" onExit={onExit}>
        Thanks anyway — see you at the next one! 💛
      </Message>
    );
  }

  const renameError =
    error && renamedAt.current && error.at >= renamedAt.current && (error.code === 'NAME_TAKEN' || error.code === 'NAME_INVALID')
      ? error.message
      : null;

  return (
    <div className="flex flex-col gap-4">
      {gamePhase === 'question' && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-500/20 px-4 py-2 ring-1 ring-red-400/40">
          <p className="min-w-0 flex-1 text-sm font-semibold">🎮 A live question is open</p>
          <Button variant="primary" onClick={onExit}>
            Jump to it
          </Button>
        </div>
      )}
      {clash && (
        <RenameCard
          name={name}
          error={renameError}
          onCancel={() => setClash(false)}
          onRename={(next) => {
            renamedAt.current = Date.now();
            client.clearError();
            client.send({ t: 'rename', name: next });
          }}
        />
      )}
      <SurveyForm
        survey={snap}
        sending={sending}
        closing={!live || live.id !== snap.id}
        n={me?.n}
        onSubmit={submit}
        onExit={onExit}
      />
    </div>
  );
}

function Done({ thanks, n, again, onExit }: { thanks: string; n: number; again: boolean; onExit: () => void }) {
  useEffect(() => {
    if (!again) burst();
  }, [again]);
  return (
    <div className="flex flex-col items-center gap-4 pt-6 text-center">
      <p className="animate-boing text-8xl">{again ? '✅' : '🎉'}</p>
      <h2 className="font-display text-3xl leading-tight font-extrabold">{again ? "You've already shared your feedback" : thanks || 'Thank you! 💛'}</h2>
      {n > 1 && (
        <p className="text-lg">
          You're one of <b>{n}</b> people who've shared feedback 💛
        </p>
      )}
      {n === 1 && !again && <p className="text-lg">You're the first to share feedback 💛</p>}
      <Button big variant="primary" onClick={onExit}>
        Back to the party 🏠
      </Button>
    </div>
  );
}

function Message({ emoji, title, children, onExit }: { emoji: string; title: string; children: string; onExit: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 pt-6 text-center">
      <p className="text-7xl">{emoji}</p>
      <h2 className="font-display text-3xl leading-tight font-extrabold">{title}</h2>
      <p className="opacity-80">{children}</p>
      <Button big onClick={onExit}>
        ◀ Back
      </Button>
    </div>
  );
}

// Someone with the same name already responded. Renaming (the game's own rename) keeps the player's points and answers.
function RenameCard({ name, error, onRename, onCancel }: { name: string; error: string | null; onRename: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(name);
  const trimmed = value.trim();
  const valid = Array.from(trimmed).length >= LIMITS.nameMin && trimmed.toLowerCase() !== name.toLowerCase();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) onRename(trimmed);
  };
  return (
    <form onSubmit={submit} className="animate-pop flex flex-col gap-3 rounded-2xl bg-amber-500/15 p-4 ring-1 ring-amber-400/50">
      <p className="font-bold">🤔 Someone named “{name}” has already responded.</p>
      <p className="text-sm opacity-85">If that wasn't you, use your full name (for example “{name} K”). Your answers and points stay.</p>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={40}
        autoComplete="nickname"
        aria-label="Your full name"
        className="rounded-2xl bg-white/10 px-5 py-3 text-lg outline-none ring-2 ring-white/20 focus:ring-saffron"
      />
      {error && <p className="rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-100">{error}</p>}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" className="flex-1" disabled={!valid}>
          Save &amp; send 🚀
        </Button>
      </div>
    </form>
  );
}
