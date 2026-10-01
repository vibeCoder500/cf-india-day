import confetti from 'canvas-confetti';
import { useEffect, useEffectEvent, useRef } from 'react';
import { SPLASH_TEXT } from '../../shared/constants';
import { startSplashShow } from '../lib/splashShow';
import Band from './Band';
import PhotoReel from './PhotoReel';

const LETTER_COLORS = ['#FF9933', '#FFFFFF', '#22c55e', '#facc15', '#f472b6', '#38bdf8', '#a78bfa'];

// The celebration show: ever-changing confetti, the animal band, and the waving CorpFun Day text with the party photos
// revolving round it. Used by the splash and the presenter.
export default function PartyShow({ durationMs, onDone, big = false }: { durationMs: number; onDone: () => void; big?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const done = useEffectEvent(onDone);

  useEffect(() => {
    // Worker mode: rendering happens off the main thread. canvas-confetti marks the canvas so StrictMode's second run doesn't re-transfer it.
    const fire = confetti.create(canvasRef.current!, { resize: true, useWorker: true });
    const stop = startSplashShow(fire, durationMs, () => done());
    return () => {
      stop();
      fire.reset();
    };
  }, [durationMs]);

  const words = SPLASH_TEXT.split(' ');
  let n = 0;
  return (
    <>
      <div className="splash-bg absolute inset-0" />
      <Band big={big} />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <PhotoReel big={big}>
        <h1 className={`splash-text font-display ${big ? 'splash-big' : ''}`} aria-label={SPLASH_TEXT}>
          {words.map((w, wi) => (
            <span key={wi} className="inline-block whitespace-nowrap" aria-hidden>
              {Array.from(w).map((ch) => {
                const i = n++;
                return (
                  <span key={i} className="wave-letter" style={{ animationDelay: `${i * 55}ms`, color: LETTER_COLORS[i % LETTER_COLORS.length] }}>
                    {ch}
                  </span>
                );
              })}
              {wi < words.length - 1 ? '\u00A0' : null}
            </span>
          ))}
        </h1>
      </PhotoReel>
    </>
  );
}
