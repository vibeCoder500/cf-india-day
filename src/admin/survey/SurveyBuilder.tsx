import { useState } from 'react';
import type { AdminSurvey, SurveyDraft, SurveyQuestion } from '../../../shared/survey';
import { SURVEY_LIMITS, SURVEY_TYPE_INFO, defaultSurveyQuestion, surveyMinutes } from '../../../shared/survey';
import { client } from '../../lib/client';
import Button from '../../components/Button';
import SurveyQuestionEditor from './SurveyQuestionEditor';

const field = 'w-full rounded-xl bg-white/10 px-3 py-2 outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-saffron';
const icon = 'rounded-lg px-2 py-1 text-sm hover:bg-white/10 disabled:opacity-30';

// Title, intro, thank-you and the questions. Every change is saved straight away (like the game's question list).
// Once launched, only the wording around the questions can change.
export default function SurveyBuilder({ s }: { s: AdminSurvey }) {
  const locked = s.opensAt !== null;
  const [editing, setEditing] = useState<{ q: SurveyQuestion; index: number } | null>(null); // index -1 = new
  const save = (patch: Partial<SurveyDraft>) =>
    client.send({ t: 'survey:save', survey: { id: s.id, title: s.title, intro: s.intro, thanks: s.thanks, questions: s.questions, ...patch } });
  const setQuestions = (questions: SurveyQuestion[]) => save({ questions });
  const comments = (except: number) => s.questions.filter((q, i) => q.type === 'open' && i !== except).length;
  const full = s.questions.length >= SURVEY_LIMITS.questions;

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= s.questions.length) return;
    const qs = [...s.questions];
    [qs[i], qs[j]] = [qs[j], qs[i]];
    setQuestions(qs);
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl bg-white/5 p-4">
        <TextField label="Title" value={s.title} max={SURVEY_LIMITS.title} required onSave={(title) => save({ title })} />
        <TextField label="Intro (before the first question)" value={s.intro} max={SURVEY_LIMITS.intro} multiline onSave={(intro) => save({ intro })} />
        <TextField label="Thank-you message" value={s.thanks} max={SURVEY_LIMITS.thanks} multiline onSave={(thanks) => save({ thanks })} />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-auto font-display text-xl font-bold">❓ Questions · {s.questions.length}</h3>
          {s.questions.length > 0 && <span className="text-sm opacity-70">about {surveyMinutes(s.questions)} min</span>}
          {!locked && (
            <Button variant="primary" disabled={full} onClick={() => setEditing({ q: defaultSurveyQuestion('poll'), index: -1 })}>
              ＋ Add question
            </Button>
          )}
        </div>
        {locked && (
          <p className="rounded-xl bg-sky-500/15 px-3 py-2 text-sm ring-1 ring-sky-400/40">
            🔒 Questions are locked once a survey is launched, so every answer matches its question. Duplicate the survey to change them.
          </p>
        )}
        {s.questions.length === 0 ? (
          <p className="rounded-2xl bg-white/5 p-6 text-center opacity-80">No questions yet — add one, or start from a template.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {s.questions.map((q, i) => (
              <li key={q.id || i} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/5 p-3">
                <span className="w-6 shrink-0 text-center font-bold opacity-60">{i + 1}</span>
                <span className="shrink-0 text-xl" title={SURVEY_TYPE_INFO[q.type].label}>
                  {SURVEY_TYPE_INFO[q.type].icon}
                </span>
                <span className="min-w-0 flex-1 break-words">
                  {q.text}
                  {!q.required && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs opacity-80">optional</span>}
                </span>
                {!locked && (
                  <div className="flex items-center gap-1">
                    <label className="mr-1 flex cursor-pointer items-center gap-1 text-xs" title="Required">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => setQuestions(s.questions.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))}
                        className="size-4 accent-saffron"
                      />
                      required
                    </label>
                    <button type="button" className={icon} aria-label={`Edit question ${i + 1}`} onClick={() => setEditing({ q, index: i })}>
                      ✏️
                    </button>
                    <button
                      type="button"
                      className={icon}
                      aria-label={`Duplicate question ${i + 1}`}
                      disabled={full || (q.type === 'open' && comments(-1) >= SURVEY_LIMITS.openQuestions)}
                      onClick={() => setQuestions([...s.questions.slice(0, i + 1), { ...q, id: '' }, ...s.questions.slice(i + 1)])}
                    >
                      ⧉
                    </button>
                    <button type="button" className={icon} aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className={icon}
                      aria-label={`Move question ${i + 1} down`}
                      disabled={i === s.questions.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={icon}
                      aria-label={`Delete question ${i + 1}`}
                      onClick={() => confirm(`Delete question ${i + 1}?`) && setQuestions(s.questions.filter((_, j) => j !== i))}
                    >
                      🗑
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {editing && (
        <SurveyQuestionEditor
          initial={editing.q}
          otherComments={comments(editing.index)}
          onClose={() => setEditing(null)}
          onSave={(q) => {
            const qs = [...s.questions];
            if (editing.index < 0) qs.push(q);
            else qs[editing.index] = q;
            setQuestions(qs);
          }}
        />
      )}
    </div>
  );
}

// Shows the saved value; while focused it edits a local copy and saves it on blur (an empty title is reverted).
function TextField({
  label,
  value,
  max,
  multiline = false,
  required = false,
  onSave,
}: {
  label: string;
  value: string;
  max: number;
  multiline?: boolean;
  required?: boolean;
  onSave: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : value;
  const props = {
    value: shown,
    maxLength: max,
    onFocus: () => {
      setText(value);
      setFocused(true);
    },
    onChange: (e: { target: { value: string } }) => setText(e.target.value),
    onBlur: () => {
      setFocused(false);
      const t = text.trim();
      if (t !== value && (!required || t)) onSave(t);
    },
    className: `${field} ${multiline ? 'resize-none' : ''}`,
  };
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between text-sm font-bold opacity-80">
        <span>{label}</span>
        <span className="font-normal tabular-nums">
          {Array.from(shown).length}/{max}
        </span>
      </span>
      {multiline ? <textarea rows={2} {...props} /> : <input {...props} />}
    </label>
  );
}
