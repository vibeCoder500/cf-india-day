import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Display } from '../../../shared/protocol';
import type { SurveyQuestion, SurveyType } from '../../../shared/survey';
import { SURVEY_FORMATS, SURVEY_LIMITS, SURVEY_TYPE_INFO, defaultSurveyQuestion } from '../../../shared/survey';
import { ANIMALS, ANIMAL_KEYS, AWESOME, DISPLAY_LABELS, LIMITS } from '../../../shared/constants';
import Button from '../../components/Button';
import Modal from '../../components/Modal';

const TYPES = Object.keys(SURVEY_TYPE_INFO) as SurveyType[];
const chars = (s: string) => Array.from(s.trim()).length;
const field = 'w-full rounded-xl bg-white/10 px-3 py-2 outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-saffron';
const segment = (on: boolean) => `flex-1 rounded-lg px-3 py-2 text-sm font-bold ${on ? 'bg-saffron text-night' : 'bg-white/10 hover:bg-white/15'}`;
// Option fields grow to show the whole text.
const grow = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

// otherComments: comment questions elsewhere in the survey (the server allows SURVEY_LIMITS.openQuestions in total).
export default function SurveyQuestionEditor({
  initial,
  otherComments,
  onSave,
  onClose,
}: {
  initial: SurveyQuestion;
  otherComments: number;
  onSave: (q: SurveyQuestion) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState(initial);
  const set = (patch: Partial<SurveyQuestion>) => setQ((prev) => ({ ...prev, ...patch }));
  const choice = q.type === 'poll' || q.type === 'multi';
  const displays = SURVEY_FORMATS[q.type].filter((d) => d !== 'versus' || q.options.length === 2);
  const display: Display = displays.includes(q.display) ? q.display : displays[0];

  // Mirrors the server's parseSurveyQuestion, so a save is never silently rejected.
  const problems: string[] = [];
  const textLen = chars(q.text);
  if (textLen < 1 || textLen > LIMITS.question) problems.push(`Question text needs 1–${LIMITS.question} characters`);
  if (choice && q.options.some((o) => chars(o) < 1 || chars(o) > SURVEY_LIMITS.option)) problems.push(`Every option needs 1–${SURVEY_LIMITS.option} characters`);
  if (q.type === 'animal' && q.options.length < LIMITS.optionsMin) problems.push(`Pick at least ${LIMITS.optionsMin} animals`);
  if (q.type === 'open' && otherComments >= SURVEY_LIMITS.openQuestions) problems.push(`Up to ${SURVEY_LIMITS.openQuestions} comment questions per survey`);

  const changeType = (type: SurveyType) => {
    if (type !== q.type) setQ({ ...defaultSurveyQuestion(type), id: q.id, text: q.text, hint: q.hint });
  };
  const setOption = (i: number, v: string) => set({ options: q.options.map((o, j) => (j === i ? v : o)) });

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (problems.length > 0) return;
    onSave({
      ...q,
      text: q.text.trim(),
      hint: q.hint.trim(),
      options: choice ? q.options.map((o) => o.trim()) : q.type === 'animal' ? q.options : [],
      maxPicks: q.type === 'multi' ? Math.max(2, Math.min(q.maxPicks, q.options.length)) : 1,
      display,
    });
    onClose();
  };

  return (
    <Modal title={initial.text ? 'Edit question' : 'New question'} onClose={onClose} wide>
      <form onSubmit={save} className="flex flex-col gap-5">
        <Field label="Type">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={q.type === t}
                onClick={() => changeType(t)}
                className={`rounded-xl p-3 text-left ${q.type === t ? 'bg-saffron text-night' : 'bg-white/10 hover:bg-white/15'}`}
              >
                <div className="text-2xl">{SURVEY_TYPE_INFO[t].icon}</div>
                <div className="font-bold">{SURVEY_TYPE_INFO[t].label}</div>
                <div className="text-xs opacity-80">{SURVEY_TYPE_INFO[t].hint}</div>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Question" hint={`${textLen}/${LIMITS.question}`}>
          <textarea
            autoFocus
            rows={2}
            value={q.text}
            maxLength={LIMITS.question}
            onChange={(e) => set({ text: e.target.value })}
            placeholder="What do you want to ask?"
            className={`${field} resize-none`}
          />
        </Field>

        <Field label="Hint under the question (optional)" hint={`${chars(q.hint)}/${SURVEY_LIMITS.hint}`}>
          <input
            value={q.hint}
            maxLength={SURVEY_LIMITS.hint}
            onChange={(e) => set({ hint: e.target.value })}
            placeholder="e.g. Skip if you missed the painting"
            className={field}
          />
        </Field>

        {choice && (
          <Field label="Options">
            <div className="flex flex-col gap-2">
              {q.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-sm font-bold">{i + 1}</span>
                  <textarea
                    ref={(el) => grow(el)}
                    rows={1}
                    value={o}
                    maxLength={SURVEY_LIMITS.option}
                    onChange={(e) => setOption(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }}
                    placeholder={`Option ${i + 1}`}
                    className={`${field} resize-none`}
                  />
                  <button
                    type="button"
                    aria-label={`Remove option ${i + 1}`}
                    disabled={q.options.length <= LIMITS.optionsMin}
                    onClick={() => set({ options: q.options.filter((_, j) => j !== i) })}
                    className="shrink-0 rounded-lg px-2 py-1 hover:bg-white/10 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div>
                <Button disabled={q.options.length >= SURVEY_LIMITS.optionsMax} onClick={() => set({ options: [...q.options, ''] })}>
                  ＋ Add option
                </Button>
              </div>
            </div>
          </Field>
        )}

        {q.type === 'multi' && (
          <Field label="People can pick up to">
            <select value={Math.min(q.maxPicks, q.options.length)} onChange={(e) => set({ maxPicks: Number(e.target.value) })} className={field}>
              {Array.from({ length: Math.max(1, q.options.length - 1) }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n} options
                </option>
              ))}
            </select>
          </Field>
        )}

        {q.type === 'animal' && (
          <Field label="Animal cards on the phones" hint={`${q.options.length} of ${ANIMAL_KEYS.length}`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ANIMAL_KEYS.map((k) => {
                const a = ANIMALS[k];
                const on = q.options.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ options: on ? q.options.filter((x) => x !== k) : ANIMAL_KEYS.filter((x) => x === k || q.options.includes(x)) })}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${on ? 'bg-white text-night' : 'bg-white/10 opacity-60 hover:opacity-90'}`}
                  >
                    <span className="text-2xl leading-none">{a.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{a.name}</span>
                      <span className="block truncate text-xs opacity-70">{a.trait}</span>
                    </span>
                    <span className="font-black">{on ? '✓' : '＋'}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {q.type === 'awesome' && (
          <Field label="Options on the phones" hint="all good vibes, rated 1–5">
            <div className="flex flex-wrap gap-2">
              {AWESOME.map((l) => (
                <span key={l.label} className="rounded-full px-3 py-1.5 text-sm font-bold text-night" style={{ background: l.color }}>
                  {l.emoji} {l.label}
                </span>
              ))}
            </div>
          </Field>
        )}

        {q.type === 'scale' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From">
              <select
                value={q.min}
                onChange={(e) => {
                  const min = Number(e.target.value);
                  set({ min, max: Math.max(q.max, min + 2) });
                }}
                className={field}
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
              </select>
            </Field>
            <Field label="To">
              <select value={q.max} onChange={(e) => set({ max: Number(e.target.value) })} className={field}>
                {Array.from({ length: 10 - q.min - 1 }, (_, i) => q.min + 2 + i).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Low-end label">
              <input value={q.minLabel} maxLength={LIMITS.label} onChange={(e) => set({ minLabel: e.target.value })} className={field} />
            </Field>
            <Field label="High-end label">
              <input value={q.maxLabel} maxLength={LIMITS.label} onChange={(e) => set({ maxLabel: e.target.value })} className={field} />
            </Field>
            <p className="text-xs opacity-70 sm:col-span-2">Tip: 1–5 shows emoji faces; 0–10 also gets an NPS score in the results.</p>
          </div>
        )}

        {q.type === 'wordcloud' && (
          <Field label="Words per person">
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" onClick={() => set({ maxEntries: n })} className={segment(q.maxEntries === n)}>
                  {n}
                </button>
              ))}
            </div>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {q.type !== 'open' && (
            <Field label="Default chart in the results">
              <select value={display} onChange={(e) => set({ display: e.target.value as Display })} className={field}>
                {displays.map((d) => (
                  <option key={d} value={d}>
                    {DISPLAY_LABELS[d]}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl bg-white/5 px-3 py-2">
            <input type="checkbox" checked={q.required} onChange={(e) => set({ required: e.target.checked })} className="size-5 accent-saffron" />
            <span className="text-sm font-semibold">Required</span>
          </label>
        </div>

        {problems.length > 0 && (
          <ul className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-100">
            {problems.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={problems.length > 0}>
            Save question
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm font-bold opacity-80">
        <span>{label}</span>
        {hint && <span className="font-normal tabular-nums">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
