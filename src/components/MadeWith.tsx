import { Fragment, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { calm, pick } from '../lib/fun';

const PHRASE = ['Made', 'with', '💖', 'by', 'Agents', 'for', 'Humans'];
let at = 0;
// Each letter knows its place in the phrase, so the hover wave ripples from left to right.
const WORDS = PHRASE.map((word) => Array.from(word, (ch) => ({ ch, i: at++ })));

const FLOATERS = ['💖', '💗', '💕', '💞', '💓', '✨'];
const POP: Keyframe[] = [
  { transform: 'scale(1)' },
  { transform: 'scale(1.5) rotate(-12deg)', offset: 0.3 },
  { transform: 'scale(0.9) rotate(6deg)', offset: 0.6 },
  { transform: 'scale(1)' },
];
const RIPPLE: Keyframe[] = [
  { transform: 'scale(0.6)', opacity: 0.9 },
  { transform: 'scale(2.6)', opacity: 0 },
];

// C major pentatonic from C5: any notes of it ring sweetly together, even when clicks overlap.
const SCALE = [72, 74, 76, 79, 81, 84, 86, 88, 91];
let audio: { ctx: AudioContext; out: GainNode } | null = null;

// A soft rising bell arpeggio, synthesised like the music, so there is no audio file to ship.
function chime() {
  if (!audio) {
    const ctx = new AudioContext();
    const out = ctx.createGain();
    out.gain.value = 0.35;
    out.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
    audio = { ctx, out };
  }
  const { ctx, out } = audio;
  if (ctx.state !== 'running') ctx.resume().catch(() => undefined);
  const root = Math.floor(Math.random() * 5);
  const t0 = ctx.currentTime + 0.02;
  [0, 2, 4].forEach((step, n) => {
    const hz = 440 * 2 ** ((SCALE[root + step] - 69) / 12);
    const t = t0 + n * 0.07;
    // A sine plus a quieter, shorter octave sounds like a glass bell.
    for (const [mult, peak, decay] of [[1, 0.5, 0.8], [2, 0.12, 0.3]] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = hz * mult;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      osc.connect(gain).connect(out);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    }
  });
}

// A small heart drifts up from the 💖 and fades. Sized from the 💖, so the big screen gets bigger ones.
function floatHeart(from: Element) {
  const r = from.getBoundingClientRect();
  const s = r.height;
  const el = document.createElement('span');
  el.textContent = pick(FLOATERS);
  el.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${r.top + s / 2}px;font-size:${s * (0.5 + Math.random() * 0.5)}px;pointer-events:none;z-index:80;user-select:none`;
  document.body.appendChild(el);
  const dx = (Math.random() - 0.5) * s * 4;
  const rise = s * (2.5 + Math.random() * 2.5);
  el.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.3}px), calc(-50% - ${rise * 0.3}px)) scale(1)`, opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${rise}px)) scale(0.7) rotate(${(Math.random() - 0.5) * 60}deg)`, opacity: 0 },
    ],
    { duration: 1200 + Math.random() * 600, easing: 'ease-out' },
  ).onfinish = () => el.remove();
}

// Footer credit. Mouse hover plays the full show silently; a click (or tap) gives a small pop and a chime.
export default function MadeWith({ big = false, className = '' }: { big?: boolean; className?: string }) {
  const [hover, setHover] = useState(false);
  const heart = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLSpanElement>(null);

  // The letter wave, heartbeat and glowing lines are CSS keyed off data-hover; this adds the floating hearts.
  useEffect(() => {
    if (!hover || calm()) return;
    const id = setInterval(() => heart.current && floatHeart(heart.current), 160);
    return () => clearInterval(id);
  }, [hover]);

  const click = () => {
    chime();
    if (calm()) return;
    heart.current?.animate(POP, { duration: 550, easing: 'ease-out' });
    ring.current?.animate(RIPPLE, { duration: 700, easing: 'ease-out' });
  };

  return (
    <footer
      data-hover={hover || undefined}
      className={`madewith flex items-center justify-center gap-3 ${big ? 'text-[clamp(0.8rem,1.05vw,1.35rem)]' : 'text-xs'} ${className}`}
    >
      <span className="mw-line" />
      <button
        type="button"
        aria-label="Made with love by Agents for Humans"
        onClick={click}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
        onPointerLeave={() => setHover(false)}
        className="mw-text rounded-full px-2 py-0.5 font-display leading-tight font-semibold tracking-wide whitespace-nowrap"
      >
        {WORDS.map((letters, w) => (
          <Fragment key={w}>
            {w > 0 && ' '}
            {PHRASE[w] === '💖' ? (
              <span ref={heart} className="mw-heart">
                <span ref={ring} className="mw-ring" />
                <span className="mw-beat">💖</span>
              </span>
            ) : (
              letters.map(({ ch, i }) => (
                <span key={i} className="mw-ch" style={{ '--i': i } as CSSProperties}>
                  {ch}
                </span>
              ))
            )}
          </Fragment>
        ))}
      </button>
      <span className="mw-line mw-line-r" />
    </footer>
  );
}
