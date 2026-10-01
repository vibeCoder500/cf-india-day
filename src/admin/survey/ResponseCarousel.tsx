import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AdminSurvey } from '../../../shared/survey';
import { SURVEY_TYPE_INFO, answerLabel } from '../../../shared/survey';
import Button from '../../components/Button';
import { istTime } from './results';
import { hide, useSurveyData } from './SurveyResults';

const mod = (i: number, n: number) => ((i % n) + n) % n;

// Where a card sits on the ring, `off` cards away from the front one: neighbours turn away and sink back.
function place(off: number, jump: boolean): CSSProperties {
  const a = Math.abs(off);
  return {
    transform: `translateX(${off * 56}%) translateZ(${-a * 170}px) rotateY(${off * -40}deg) scale(${1 - Math.min(a, 3) * 0.04})`,
    opacity: a > 2 ? 0 : a === 2 ? 0.35 : a === 1 ? 0.75 : 1,
    zIndex: 10 - a,
    pointerEvents: a > 1 ? 'none' : 'auto',
    transition: jump ? 'none' : undefined, // wrapping round the back: move instantly instead of flying across
  };
}

// Every response on its own card, in a rotating 3-D carousel. Arrows, ← → keys or a swipe turn it one card at a time.
export default function ResponseCarousel({ s, live }: { s: AdminSurvey; live: boolean }) {
  const d = useSurveyData(s);
  const cards = d?.cards ?? [];
  const n = cards.length;
  const [index, setIndex] = useState(0); // unbounded, so the ring always turns the way you pressed
  const cur = n ? mod(index, n) : 0;
  const currentId = useRef<string | null>(null);
  const lastOff = useRef(new Map<string, number>());
  const swipe = useRef<number | null>(null);

  // New responses can land anywhere in the (shuffled) order: keep the card you're reading in front.
  useLayoutEffect(() => {
    if (!n) return;
    const was = currentId.current ? cards.findIndex((c) => c.id === currentId.current) : -1;
    if (was >= 0 && was !== cur) setIndex((i) => i + (was - cur));
    else currentId.current = cards[cur].id;
  }, [cards, cur, n]);

  // Each card's place on the ring, and where it was in the last render that reached the screen.
  const offsets = new Map<string, number>();
  cards.forEach((c, i) => {
    let off = i - cur;
    if (off > n / 2) off -= n;
    if (off < -n / 2) off += n;
    offsets.set(c.id, off);
  });
  const prev = lastOff.current;
  useEffect(() => {
    lastOff.current = offsets;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowLeft') turn(-1);
      if (e.key === 'ArrowRight') turn(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!d) return <p className="rounded-2xl bg-white/5 p-6 text-center opacity-80">Loading responses… 🃏</p>;

  function turn(by: number) {
    if (n < 2) return;
    setIndex((i) => {
      const next = i + by;
      currentId.current = cards[mod(next, n)].id;
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm opacity-80">
        🃏 {n} {n === 1 ? 'response' : 'responses'}, one card each, in random order: no names, no times.
        {live && ' New ones appear here as they arrive.'}
        {d.sealed > 0 && ` 🔒 ${d.sealed} more ${d.sealed === 1 ? 'is' : 'are'} sealed until there are enough to show together.`}
      </p>

      {n === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-white/5 p-10 text-center">
          <p className="text-5xl">🫙</p>
          <p className="font-display text-xl font-bold">No responses yet</p>
          <p className="opacity-75">Share the link — each response shows up here as its own card.</p>
        </div>
      ) : (
        <>
          <div
            className="carousel-stage"
            onPointerDown={(e) => {
              swipe.current = e.clientX;
            }}
            onPointerUp={(e) => {
              if (swipe.current === null) return;
              const dx = e.clientX - swipe.current;
              swipe.current = null;
              if (Math.abs(dx) > 50) turn(dx < 0 ? 1 : -1);
            }}
          >
            {cards.map((c, i) => {
              const off = offsets.get(c.id) ?? 0;
              if (Math.abs(off) > 3) return null;
              const before = prev.get(c.id);
              const jump = before !== undefined && Math.abs(before - off) > 1;
              return (
                <article
                  key={c.id}
                  className={`carousel-card ${off === 0 ? 'carousel-front' : ''} ${c.hidden ? 'carousel-hidden' : ''}`}
                  style={place(off, jump)}
                  aria-hidden={off !== 0}
                  onClick={() => off !== 0 && turn(off)}
                >
                  <header className="flex items-center gap-2">
                    <span className="rounded-full bg-saffron px-3 py-1 text-sm font-extrabold text-night">#{i + 1}</span>
                    <span className="text-sm opacity-75">of {n}</span>
                    {c.at !== null && <span className="text-xs opacity-70">· {istTime(c.at)}</span>}
                    {c.hidden && <span className="ml-auto rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-bold text-amber-200">Hidden</span>}
                  </header>
                  <ol className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
                    {s.questions.map((q, j) => {
                      const a = answerLabel(q, c.answers[q.id]);
                      return (
                        <li key={q.id} className="rounded-2xl bg-white/[0.07] px-3 py-2">
                          <p className="text-xs leading-snug opacity-70">
                            {SURVEY_TYPE_INFO[q.type].icon} Q{j + 1}. {q.text}
                          </p>
                          <p className={`font-semibold break-words whitespace-pre-wrap ${a ? '' : 'opacity-45'}`}>{a || '— skipped'}</p>
                        </li>
                      );
                    })}
                  </ol>
                  {off === 0 && (
                    <footer className="flex justify-end">
                      <Button variant={c.hidden ? 'secondary' : 'danger'} onClick={() => hide(s, c.id, !c.hidden)}>
                        {c.hidden ? '👁 Unhide' : '🙈 Hide from results'}
                      </Button>
                    </footer>
                  )}
                </article>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-4">
            <button type="button" className="carousel-arrow" aria-label="Previous response" disabled={n < 2} onClick={() => turn(-1)}>
              ◀
            </button>
            <p className="min-w-24 text-center font-display text-lg font-bold tabular-nums" aria-live="polite">
              {cur + 1} / {n}
            </p>
            <button type="button" className="carousel-arrow" aria-label="Next response" disabled={n < 2} onClick={() => turn(1)}>
              ▶
            </button>
          </div>
        </>
      )}
    </div>
  );
}
