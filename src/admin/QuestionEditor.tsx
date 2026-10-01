import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { EventInfo, Question, QuestionType } from '../../shared/protocol';
import { ANIMALS, ANIMAL_KEYS, AWESOME, DISPLAY_LABELS, FORMATS, LIMITS, OPTION_COLORS, TYPE_INFO, defaultQuestion } from '../../shared/constants';
import { client } from '../lib/client';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Shape from '../components/Shape';

const TYPES = Object.keys(TYPE_INFO) as QuestionType[];
const TIMERS = [0, 10, 15, 20, 30, 45, 60, 90, 120];
const POINTS = ['No points', 'Normal', 'Double ✨'] as const;
const chars = (s: string) => Array.from(s.trim()).length;
const field = 'w-full rounded-xl bg-white/10 px-3 py-2 outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-saffron';
const segment = (on: boolean) => `flex-1 rounded-lg px-3 py-2 text-sm font-bold ${on ? 'bg-saffron text-night' : 'bg-white/10 hover:bg-white/15'}`;

// Number inputs are edited as text so "", "-" and "1." can be typed; converted on save.
type NumberFields = { min: string; max: string; correct: string };
const numberFields = (q: Question): NumberFields => ({
  min: String(q.min),
  max: String(q.max),
  correct: q.type === 'number' && q.correct !== null ? String(q.correct) : '',
});
const toNumber = (s: string) => (s.trim() === '' ? NaN : Number(s));
// Option fields grow to show the whole text (options can be up to 200 characters).
const grow = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

export default function QuestionEditor({ initial, events, onClose }: { initial: Question; events: EventInfo[]; onClose: () => void }) {
  const [q, setQ] = useState(initial);
  const [nums, setNums] = useState(() => numberFields(initial));
  const set = (patch: Partial<Question>) => setQ((prev) => ({ ...prev, ...patch }));

  const choice = q.type === 'poll' || q.type === 'quiz';
  const words = q.type === 'wordcloud' || q.type === 'open';
  const displays = FORMATS[q.type].filter((d) => d !== 'versus' || q.options.length === 2);
  const display = displays.includes(q.display) ? q.display : displays[0];
  const timers = TIMERS.includes(q.timer) ? TIMERS : [...TIMERS, q.timer].sort((a, b) => a - b);
  const nMin = toNumber(nums.min);
  const nMax = toNumber(nums.max);
  const nCorrect = nums.correct.trim() === '' ? null : Number(nums.correct);

  // Mirrors the server's parseQuestion so a save is never silently rejected.
  const problems: string[] = [];
  const textLen = chars(q.text);
  if (textLen < 1 || textLen > LIMITS.question) problems.push(`Question text needs 1–${LIMITS.question} characters`);
  if (choice && q.options.some((o) => chars(o) < 1 || chars(o) > LIMITS.option)) problems.push(`Every option needs 1–${LIMITS.option} characters`);
  if (q.type === 'animal' && q.options.length < LIMITS.optionsMin) problems.push(`Pick at least ${LIMITS.optionsMin} animals`);
  if (q.type === 'number') {
    if (!Number.isFinite(nMin) || !Number.isFinite(nMax) || nMax <= nMin) problems.push('Range: max must be bigger than min');
    else if (nCorrect !== null && (!Number.isFinite(nCorrect) || nCorrect < nMin || nCorrect > nMax)) problems.push('The answer must be inside the range');
  }

  const changeType = (type: QuestionType) => {
    if (type === q.type) return;
    const next = { ...defaultQuestion(type), id: q.id, eventId: q.eventId, text: q.text };
    setQ(next);
    setNums(numberFields(next));
  };

  const setOption = (i: number, v: string) => set({ options: q.options.map((o, j) => (j === i ? v : o)) });
  const removeOption = (i: number) => {
    const c = q.correct;
    set({
      options: q.options.filter((_, j) => j !== i),
      correct: q.type === 'quiz' && c !== null ? (i < c ? c - 1 : i === c ? 0 : c) : c,
    });
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (problems.length > 0) return;
    const out: Question = {
      ...q,
      text: q.text.trim(),
      options: choice ? q.options.map((o) => o.trim()) : q.type === 'animal' ? q.options : [],
      display,
    };
    if (q.type === 'number') Object.assign(out, { min: nMin, max: nMax, correct: nCorrect });
    client.send({ t: 'q:save', q: out });
    onClose();
  };

  return (
    <Modal title={initial.id ? 'Edit question' : 'New question'} onClose={onClose} wide>
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
                <div className="text-2xl">{TYPE_INFO[t].icon}</div>
                <div className="font-bold">{TYPE_INFO[t].label}</div>
                <div className="text-xs opacity-80">{TYPE_INFO[t].hint}</div>
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

        {events.length > 1 && (
          <Field label="Event" hint={initial.id && q.eventId !== initial.eventId ? 'moves to the end of that event' : undefined}>
            <select value={q.eventId} onChange={(e) => set({ eventId: e.target.value })} className={field}>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {choice && (
          <Field label={q.type === 'quiz' ? 'Options (mark the correct one)' : 'Options'}>
            <div className="flex flex-col gap-2">
              {q.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: OPTION_COLORS[i] }}>
                    <Shape i={i} className="size-5 text-white" />
                  </span>
                  <textarea
                    ref={(el) => grow(el)}
                    rows={1}
                    value={o}
                    maxLength={LIMITS.option}
                    onChange={(e) => setOption(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }}
                    placeholder={`Option ${i + 1}`}
                    className={`${field} resize-none`}
                  />
                  {q.type === 'quiz' && (
                    <label className="flex shrink-0 cursor-pointer items-center gap-1 text-sm">
                      <input type="radio" name="correct" checked={q.correct === i} onChange={() => set({ correct: i })} className="size-4 accent-green-500" />
                      correct
                    </label>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove option ${i + 1}`}
                    disabled={q.options.length <= LIMITS.optionsMin}
                    onClick={() => removeOption(i)}
                    className="shrink-0 rounded-lg px-2 py-1 hover:bg-white/10 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div>
                <Button disabled={q.options.length >= LIMITS.optionsMax} onClick={() => set({ options: [...q.options, ''] })}>
                  ＋ Add option
                </Button>
              </div>
            </div>
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Timer">
            <select value={q.timer} onChange={(e) => set({ timer: Number(e.target.value) })} className={field}>
              {timers.map((t) => (
                <option key={t} value={t}>
                  {t === 0 ? 'No timer (host closes)' : `${t} s`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Default display">
            <select value={display} onChange={(e) => set({ display: e.target.value as Question['display'] })} className={field}>
              {displays.map((d) => (
                <option key={d} value={d}>
                  {DISPLAY_LABELS[d]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {(q.type === 'quiz' || q.type === 'number') && (
          <Field label="Points">
            <div className="flex gap-2">
              {([0, 1, 2] as const).map((p) => (
                <button key={p} type="button" onClick={() => set({ points: p })} className={segment(q.points === p)}>
                  {POINTS[p]}
                </button>
              ))}
            </div>
          </Field>
        )}

        {words && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Entries per person">
              <div className="flex gap-2">
                {[1, 2, 3].map((n) => (
                  <button key={n} type="button" onClick={() => set({ maxEntries: n })} className={segment(q.maxEntries === n)}>
                    {n}
                  </button>
                ))}
              </div>
            </Field>
            <Check label="Approve before showing" checked={q.moderate} onChange={(v) => set({ moderate: v })} />
          </div>
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
          </div>
        )}

        {q.type === 'number' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Min">
              <input inputMode="decimal" value={nums.min} onChange={(e) => setNums({ ...nums, min: e.target.value })} className={field} />
            </Field>
            <Field label="Max">
              <input inputMode="decimal" value={nums.max} onChange={(e) => setNums({ ...nums, max: e.target.value })} className={field} />
            </Field>
            <Field label="Unit (optional)">
              <input value={q.unit} maxLength={LIMITS.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="e.g. km" className={field} />
            </Field>
            <Field label="Correct answer (optional)">
              <input inputMode="decimal" value={nums.correct} onChange={(e) => setNums({ ...nums, correct: e.target.value })} className={field} />
            </Field>
          </div>
        )}

        {(q.type === 'poll' || q.type === 'scale' || q.type === 'awesome') && (
          <Check label="Mirror results on phones" checked={q.showOnPhones} onChange={(v) => set({ showOnPhones: v })} />
        )}

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

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl bg-white/5 px-3 py-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-saffron" />
      <span className="text-sm font-semibold">{label}</span>
    </label>
  );
}
