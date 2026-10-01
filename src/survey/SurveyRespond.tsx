import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PublicSurvey, SurveyAnswers } from '../../shared/survey';
import { client, useGame } from '../lib/client';
import { burst } from '../lib/celebrate';
import { clearDraft } from './draft';
import SoundToggle from './SoundToggle';
import SurveyForm from './SurveyForm';

// /survey: whoever opens the link answers the live survey straight away. No login and no name: one response per
// device. The form stays pinned to the survey it opened with, so a late answer (in the 2-minute grace after closing)
// still goes to the right survey.
export default function SurveyRespond() {
  const heard = useGame((s) => s.surveyHeard);
  const online = useGame((s) => s.status === 'open');
  const live = useGame((s) => s.survey);
  const mine = useGame((s) => s.surveyMe);
  const sending = useGame((s) => s.surveySending !== null);
  const error = useGame((s) => s.error);
  const [snap, setSnap] = useState<PublicSurvey | null>(null);
  const [sent, setSent] = useState(false);
  const [closed, setClosed] = useState(false);
  const [waited, setWaited] = useState(false);
  const sentAt = useRef(0);

  useEffect(() => {
    if (live && (!snap || live.id === snap.id)) setSnap(live);
  }, [live, snap]);

  // "Already responded?" normally answers in milliseconds; don't wait forever if it doesn't.
  const sid = snap?.id;
  useEffect(() => {
    if (!sid) return;
    const id = setTimeout(() => setWaited(true), 3000);
    return () => clearTimeout(id);
  }, [sid]);

  useEffect(() => {
    if (!error || !sentAt.current || error.at < sentAt.current || error.code !== 'CLOSED') return;
    setClosed(true);
    if (snap) clearDraft(snap.id);
  }, [error, snap]);

  if (!heard) {
    return (
      <Card emoji="✨" title={online ? 'Getting the survey ready…' : 'Connecting…'}>
        One moment — this needs an internet connection.
      </Card>
    );
  }
  if (!snap) {
    return (
      <Card emoji="🙂" title="No survey is open right now">
        Check back soon — when the next one opens, this link takes you straight to it.
      </Card>
    );
  }
  const me = mine[snap.id];
  if (!me && !waited) return <Card emoji="📝" title="Checking…" />;
  if (me?.done) return <Done survey={snap} n={me.n} again={!sent} />;
  if (closed) {
    return (
      <Card emoji="⏰" title="This survey has closed">
        Thanks anyway — see you at the next one! 💛
      </Card>
    );
  }

  const problem = error && sentAt.current && error.at >= sentAt.current && error.code !== 'CLOSED' ? error.message : null;
  return (
    <Frame>
      {problem && (
        <p role="alert" className="mb-4 rounded-2xl bg-red-500/20 px-4 py-3 text-center font-semibold text-red-100 ring-1 ring-red-400/40">
          {problem}
        </p>
      )}
      <SurveyForm
        survey={snap}
        sending={sending}
        closing={!live || live.id !== snap.id}
        n={me?.n}
        onSubmit={(answers: SurveyAnswers) => {
          sentAt.current = Date.now();
          setSent(true);
          client.surveySubmit(snap.id, answers);
        }}
      />
    </Frame>
  );
}

function Done({ survey, n, again }: { survey: PublicSurvey; n: number; again: boolean }) {
  useEffect(() => {
    if (!again) burst();
  }, [again]);
  return (
    <Card emoji={again ? '✅' : '🎉'} title={again ? "You've already shared your feedback" : survey.thanks || 'Thank you! 💛'}>
      {n > 1 ? `You're one of ${n} people who've shared feedback 💛` : n === 1 && !again ? "You're the first to share feedback 💛" : 'Thank you! 💛'}
    </Card>
  );
}

export function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 py-6 sm:py-10">
      <div className="mb-4 flex items-center gap-2">
        <span className="w-9 shrink-0" aria-hidden />
        <p className="flex-1 text-center text-sm font-bold tracking-wide uppercase opacity-80">📝 CorpFun Day · Feedback</p>
        <SoundToggle />
      </div>
      <div className="glass p-5 sm:p-8">{children}</div>
      <p className="mt-4 text-center text-xs opacity-60">🕶️ Anonymous: no login, no name — one response per device</p>
    </main>
  );
}

function Card({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <Frame>
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="animate-float text-7xl">{emoji}</p>
        <h1 className="font-display text-3xl leading-tight font-extrabold">{title}</h1>
        {children && <p className="text-lg opacity-85">{children}</p>}
      </div>
    </Frame>
  );
}
