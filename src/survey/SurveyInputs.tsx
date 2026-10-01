import { useState } from 'react';
import type { SurveyAnswer, SurveyQuestion } from '../../shared/survey';
import { SURVEY_LIMITS } from '../../shared/survey';
import { ANIMALS, AWESOME, LIMITS } from '../../shared/constants';
import { pick, puffFrom } from '../lib/fun';
import AnimalCard from '../components/AnimalCard';

const FACES = ['😴', '😐', '🙂', '😀', '🤩'];
const field = 'w-full rounded-2xl bg-white/10 px-5 py-4 outline-none ring-2 ring-white/20 focus:ring-saffron';

export interface InputProps {
  q: SurveyQuestion;
  value: SurveyAnswer | undefined;
  onChange: (a: SurveyAnswer | undefined) => void;
  onPicked: () => void; // single-tap types: move on
}

// The answer area for one survey question. Looks like the game's own answer screens.
export default function SurveyInput(props: InputProps) {
  switch (props.q.type) {
    case 'poll':
    case 'multi':
      return <Choices {...props} />;
    case 'scale':
    case 'awesome':
      return <Rating {...props} />;
    case 'animal':
      return <Animals {...props} />;
    case 'wordcloud':
      return <Words {...props} />;
    case 'open':
      return <Comment {...props} />;
  }
}

function Choices({ q, value, onChange, onPicked }: InputProps) {
  const multi = q.type === 'multi';
  const picked = value && 'choices' in value ? value.choices : value && 'choice' in value ? [value.choice] : [];
  const full = multi && picked.length >= q.maxPicks;

  const tap = (i: number, el: HTMLElement) => {
    if (!multi) {
      puffFrom(el, pick(['😎', '🙌', '💯', '✨', '🌶️']));
      onChange({ choice: i });
      return onPicked();
    }
    const next = picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i].sort((a, b) => a - b);
    if (!picked.includes(i)) puffFrom(el, '✅', 1);
    onChange(next.length > 0 ? { choices: next } : undefined);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {q.options.map((label, i) => {
        const on = picked.includes(i);
        return (
          <button
            key={i}
            type="button"
            aria-pressed={on}
            disabled={full && !on}
            onClick={(e) => tap(i, e.currentTarget)}
            className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-bold transition active:scale-[0.98] ${
              on ? 'bg-saffron text-night ring-4 ring-white' : 'bg-white/10 hover:bg-white/15'
            } ${full && !on ? 'opacity-40' : ''}`}
          >
            {multi && <span className="text-xl leading-none">{on ? '☑' : '☐'}</span>}
            <span className="min-w-0 flex-1 break-words">{label}</span>
            {on && !multi && <span className="animate-boing text-2xl">✓</span>}
          </button>
        );
      })}
      {multi && (
        <p className="text-center text-sm font-semibold opacity-80">
          {picked.length} of {q.maxPicks} picked
        </p>
      )}
    </div>
  );
}

function Rating({ q, value, onChange, onPicked }: InputProps) {
  const selected = value && 'rating' in value ? value.rating : null;
  const steps = Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i);
  const cols = steps.length <= 6 ? steps.length : Math.ceil(steps.length / 2);
  const faces = q.type === 'awesome' ? AWESOME.map((l) => l.emoji) : steps.length === 5 ? FACES : null;

  const tap = (r: number, el: HTMLElement) => {
    if (faces) puffFrom(el, faces[r - q.min], 2);
    onChange({ rating: r });
    onPicked();
  };

  return (
    <div className="flex flex-col gap-3">
      {q.type === 'awesome' ? (
        AWESOME.map((l, i) => {
          const r = q.min + i;
          const on = selected === r;
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={(e) => tap(r, e.currentTarget)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-2 text-left font-display text-2xl font-extrabold text-night shadow-lg transition active:scale-[0.98] ${on ? 'ring-4 ring-white' : ''}`}
              style={{ background: l.color }}
            >
              <span className={`text-3xl leading-none ${on ? 'animate-boing inline-block' : ''}`}>{l.emoji}</span>
              <span className="min-w-0 flex-1 break-words">{l.label}</span>
            </button>
          );
        })
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {steps.map((r, i) => (
            <button
              key={r}
              type="button"
              aria-pressed={selected === r}
              aria-label={`${r}${r === q.min && q.minLabel ? ` (${q.minLabel})` : ''}${r === q.max && q.maxLabel ? ` (${q.maxLabel})` : ''}`}
              onClick={(e) => tap(r, e.currentTarget)}
              className={`flex min-h-16 flex-col items-center justify-center rounded-2xl py-2 font-display text-2xl font-extrabold transition active:scale-95 ${
                selected === r ? 'bg-saffron text-night ring-4 ring-white' : 'bg-white/10'
              }`}
            >
              {faces && <span className={`text-3xl leading-none ${selected === r ? 'animate-boing inline-block' : ''}`}>{faces[i]}</span>}
              <span>{r}</span>
            </button>
          ))}
        </div>
      )}
      {(q.minLabel || q.maxLabel) && (
        <div className="flex justify-between gap-4 text-sm opacity-80">
          <span>{q.minLabel}</span>
          <span className="text-right">{q.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

function Animals({ q, value, onChange, onPicked }: InputProps) {
  const selected = value && 'choice' in value ? value.choice : null;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {q.options.map((key, i) => (
        <AnimalCard
          key={key}
          animal={ANIMALS[key]}
          selected={selected === i}
          onClick={(e) => {
            puffFrom(e.currentTarget, ANIMALS[key].emoji);
            onChange({ choice: i });
            onPicked();
          }}
        />
      ))}
    </div>
  );
}

function Words({ q, value, onChange, onPicked }: InputProps) {
  const texts = value && 'texts' in value ? value.texts : [];
  const [shown, setShown] = useState(Math.max(1, Math.min(q.maxEntries, texts.length)));

  const update = (i: number, text: string) => {
    const next = Array.from({ length: shown }, (_, j) => (j === i ? text : (texts[j] ?? '')));
    onChange(next.some((t) => t.trim()) ? { texts: next } : undefined);
  };

  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: shown }, (_, i) => (
        <input
          key={i}
          autoFocus={i === shown - 1}
          value={texts[i] ?? ''}
          onChange={(e) => update(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
            e.preventDefault();
            onPicked();
          }}
          maxLength={LIMITS.word}
          enterKeyHint="next"
          placeholder={i === 0 ? 'A word or two' : 'Another one (optional)'}
          aria-label={`Word ${i + 1}`}
          className={`${field} text-xl`}
        />
      ))}
      {shown < q.maxEntries && (
        <button type="button" onClick={() => setShown(shown + 1)} className="self-start rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/15">
          ＋ another word
        </button>
      )}
    </div>
  );
}

function Comment({ value, onChange }: InputProps) {
  const text = value && 'text' in value ? value.text : '';
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value ? { text: e.target.value } : undefined)}
        maxLength={SURVEY_LIMITS.text}
        rows={5}
        placeholder="Type here…"
        aria-label="Your comment"
        className={`${field} resize-none text-base`}
      />
      <p className="text-right text-sm tabular-nums opacity-70">
        {Array.from(text).length}/{SURVEY_LIMITS.text}
      </p>
    </div>
  );
}
