import { useEffect, useRef, useState } from 'react';
import type { PublicSurvey, SurveyAnswer, SurveyAnswers, SurveyQuestion } from '../../shared/survey';
import { answerLabel, surveyMinutes } from '../../shared/survey';
import { useServerNow } from '../lib/hooks';
import Button from '../components/Button';
import type { SurveyStep } from './draft';
import { loadDraft, saveDraft } from './draft';
import SurveyInput from './SurveyInputs';
import { istDateTime, timeLeft } from './time';

const isAnswered = (a: SurveyAnswer | undefined) =>
  !!a && ('texts' in a ? a.texts.some((t) => t.trim()) : 'text' in a ? a.text.trim() !== '' : 'choices' in a ? a.choices.length > 0 : true);

// What gets sent: trimmed text, no empty entries, picks in order.
function tidy(qs: SurveyQuestion[], answers: SurveyAnswers): SurveyAnswers {
  const out: SurveyAnswers = {};
  for (const q of qs) {
    const a = answers[q.id];
    if (!a || !isAnswered(a)) continue;
    if ('texts' in a) out[q.id] = { texts: a.texts.map((t) => t.trim()).filter(Boolean) };
    else if ('text' in a) out[q.id] = { text: a.text.trim() };
    else if ('choices' in a) out[q.id] = { choices: [...a.choices].sort((x, y) => x - y) };
    else out[q.id] = a;
  }
  return out;
}

export interface SurveyFormProps {
  survey: PublicSurvey;
  preview?: boolean; // the host's preview: nothing is saved or sent
  sending?: boolean;
  closing?: boolean; // the survey just closed, but answers still count for a moment
  n?: number; // responses so far
  onSubmit: (answers: SurveyAnswers) => void;
  onExit: () => void;
}

// Intro → one question per screen → review → send. Answers are kept on this device until they're sent.
export default function SurveyForm({ survey, preview = false, sending = false, closing = false, n, onSubmit, onExit }: SurveyFormProps) {
  const qs = survey.questions;
  const [draft] = useState(() => (preview ? null : loadDraft(survey.id, qs)));
  const [answers, setAnswers] = useState<SurveyAnswers>(() => draft?.answers ?? {});
  const [step, setStep] = useState<SurveyStep>('intro');
  const [backToReview, setBackToReview] = useState(false);
  const [previewSent, setPreviewSent] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const now = useServerNow(30_000);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Autosave once they've started (never in the host's preview).
  useEffect(() => {
    if (preview || (step === 'intro' && Object.keys(answers).length === 0)) return;
    saveDraft(survey.id, { answers, step });
  }, [preview, survey.id, answers, step]);

  const go = (s: SurveyStep) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setStep(s);
    top.current?.scrollIntoView({ block: 'start' });
  };
  const next = (i: number) => {
    if (backToReview) {
      setBackToReview(false);
      return go('review');
    }
    go(i + 1 < qs.length ? i + 1 : 'review');
  };
  // Single-tap answers move on by themselves, after a beat so the tap registers.
  const later = (i: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => next(i), 450);
  };
  const setAnswer = (qid: string, a: SurveyAnswer | undefined) =>
    setAnswers((prev) => {
      const out = { ...prev };
      if (a) out[qid] = a;
      else delete out[qid];
      return out;
    });

  if (previewSent) {
    return (
      <div className="flex flex-col items-center gap-4 pt-6 text-center">
        <p className="animate-boing text-7xl">🎉</p>
        <p className="font-display text-2xl leading-tight font-extrabold">{survey.thanks || 'Thank you! 💛'}</p>
        <p className="text-sm opacity-70">(Preview: nothing was sent)</p>
        <Button
          onClick={() => {
            setPreviewSent(false);
            setAnswers({});
            setStep('intro');
          }}
        >
          Start again
        </Button>
      </div>
    );
  }

  const missing = qs.filter((q) => q.required && !isAnswered(answers[q.id]));
  const resume = draft && (Object.keys(draft.answers).length > 0 || draft.step !== 'intro') ? draft.step : null;
  const mode = survey.anonymous ? (
    <>
      🕶️ <b>Anonymous</b> — your name is never saved with your answers
      {survey.k > 1 ? `, and organisers only see answers in groups of ${survey.k}+` : ''}.
    </>
  ) : (
    <>👤 Your name will be shown with your answers.</>
  );

  return (
    <div ref={top} className="flex scroll-mt-24 flex-col gap-5">
      {preview && <p className="rounded-xl bg-sky-500/15 px-3 py-2 text-center text-sm font-semibold ring-1 ring-sky-400/40">👀 Preview — nothing is sent</p>}
      {closing && !preview && (
        <p className="rounded-xl bg-amber-500/20 px-3 py-2 text-center text-sm font-semibold ring-1 ring-amber-400/50">
          ⏰ The survey just closed — send now and it still counts for 2 minutes.
        </p>
      )}

      {step === 'intro' && (
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="animate-float text-6xl">📝</p>
          <h2 className="font-display text-3xl leading-tight font-extrabold">{survey.title}</h2>
          {survey.intro && <p className="text-lg opacity-90">{survey.intro}</p>}
          <div className="flex flex-wrap justify-center gap-2 text-sm font-bold">
            <span className="rounded-full bg-white/10 px-3 py-1">⏱ ~{surveyMinutes(qs)} min</span>
            <span className="rounded-full bg-white/10 px-3 py-1">❓ {qs.length} questions</span>
            {n !== undefined && n >= 3 && <span className="rounded-full bg-white/10 px-3 py-1">🎉 {n} have shared</span>}
          </div>
          <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm">{mode}</p>
          <p className="text-sm opacity-80">
            ⏳ Closes {istDateTime(survey.closesAt)}
            {survey.closesAt > now && ` · in ${timeLeft(survey.closesAt - now)}`}
          </p>
          <div className="flex w-full flex-col gap-2">
            {resume !== null ? (
              <>
                <Button big variant="primary" onClick={() => go(resume === 'intro' ? 0 : resume)}>
                  Continue where you left off ▶
                </Button>
                <Button onClick={() => go(0)}>Go to the first question</Button>
              </>
            ) : (
              <Button big variant="primary" onClick={() => go(0)}>
                Start ▶
              </Button>
            )}
          </div>
          <button type="button" className="text-sm underline opacity-70" onClick={onExit}>
            Not now
          </button>
        </div>
      )}

      {typeof step === 'number' && qs[step] && (
        <QuestionStep
          i={step}
          total={qs.length}
          q={qs[step]}
          value={answers[qs[step].id]}
          backToReview={backToReview}
          onChange={(a) => setAnswer(qs[step].id, a)}
          onPicked={() => later(step)}
          onBack={() => go(step === 0 ? 'intro' : step - 1)}
          onNext={() => next(step)}
        />
      )}

      {step === 'review' && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-3xl font-extrabold">Ready to send? 🚀</h2>
            <p className="opacity-80">Tap any answer to change it.</p>
          </div>
          <ol className="flex flex-col gap-2">
            {qs.map((q, i) => {
              const label = answerLabel(q, tidy([q], answers)[q.id]);
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setBackToReview(true);
                      go(i);
                    }}
                    className="flex w-full flex-col gap-1 rounded-2xl bg-white/5 p-3 text-left hover:bg-white/10"
                  >
                    <span className="line-clamp-2 text-sm opacity-80">
                      {i + 1}. {q.text}
                    </span>
                    <span className={`font-bold break-words ${label ? '' : q.required ? 'text-amber-300' : 'opacity-60'}`}>
                      {label || (q.required ? '⚠️ Needs an answer' : '— skipped')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {survey.anonymous && <p className="text-center text-sm opacity-70">🕶️ Sent without your name</p>}
          <Button
            big
            variant="primary"
            disabled={sending || missing.length > 0}
            onClick={() => (preview ? setPreviewSent(true) : onSubmit(tidy(qs, answers)))}
          >
            {sending ? 'Sending…' : 'Send it 🚀'}
          </Button>
          <Button onClick={() => go(qs.length - 1)}>◀ Back</Button>
        </div>
      )}
    </div>
  );
}

function QuestionStep(props: {
  i: number;
  total: number;
  q: SurveyQuestion;
  value: SurveyAnswer | undefined;
  backToReview: boolean;
  onChange: (a: SurveyAnswer | undefined) => void;
  onPicked: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { i, total, q, value, backToReview } = props;
  const done = isAnswered(value);
  const label = backToReview ? 'Back to review ▶' : i + 1 === total ? 'Review ▶' : !done && !q.required ? 'Skip ▶' : 'Next ▶';
  return (
    <div className="flex flex-col gap-5">
      <Progress i={i} total={total} />
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-bold opacity-80">
          <span>
            Question {i + 1} of {total}
          </span>
          {!q.required && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">Optional</span>}
        </div>
        <h2 className="font-display text-2xl leading-tight font-extrabold">{q.text}</h2>
        {q.hint && <p className="mt-1 opacity-70">{q.hint}</p>}
      </div>
      <SurveyInput key={q.id} q={q} value={value} onChange={props.onChange} onPicked={props.onPicked} />
      <div className="flex gap-2">
        <Button big className="flex-1" onClick={props.onBack}>
          ◀ Back
        </Button>
        <Button big variant="primary" className="flex-1" disabled={q.required && !done} onClick={props.onNext}>
          {label}
        </Button>
      </div>
    </div>
  );
}

// A little runner heading for the finish flag.
function Progress({ i, total }: { i: number; total: number }) {
  const pct = total > 1 ? (i / (total - 1)) * 86 + 4 : 50;
  return (
    <div className="relative h-8" role="progressbar" aria-label="Progress" aria-valuemin={1} aria-valuemax={total} aria-valuenow={i + 1}>
      <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/10" />
      <div className="absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-full bg-saffron transition-[width] duration-500" style={{ width: `${pct}%` }} />
      <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl transition-[left] duration-500" style={{ left: `${pct}%` }}>
        <span className="inline-block -scale-x-100">🏃</span>
      </span>
      <span className="absolute top-1/2 right-0 -translate-y-1/2 text-xl">🏁</span>
    </div>
  );
}
