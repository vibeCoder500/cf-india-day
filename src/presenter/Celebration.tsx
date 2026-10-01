import { useEffect, useEffectEvent, useState } from 'react';
import { SPLASH_MS } from '../../shared/constants';
import CornerQR from '../components/CornerQR';
import MusicToggle from '../components/MusicToggle';
import PartyShow from '../components/PartyShow';
import { musicStatus } from '../lib/music';

// The phones' splash, full size on the big screen, with music. Stays until the host clicks the button (or presses S or Esc).
export default function Celebration({ next, onDone }: { next: string; onDone: () => void }) {
  const [run, setRun] = useState(0);
  const [ready, setReady] = useState(false);
  const finish = useEffectEvent(onDone);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key.toLowerCase() === 's') finish();
    };
    // Browsers block sound until the first click here, so that click restarts the show in fullscreen with music.
    const start = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== ' ' && e.key !== 'Enter') return;
      window.removeEventListener('pointerup', start);
      window.removeEventListener('keydown', start);
      if (musicStatus() !== 'blocked') return;
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => undefined);
      setRun((r) => r + 1);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerup', start);
    window.addEventListener('keydown', start);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerup', start);
      window.removeEventListener('keydown', start);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[35] overflow-hidden bg-night">
      <PartyShow key={run} durationMs={SPLASH_MS} onDone={() => setReady(true)} big />
      {/* Beside the band, above the music button: it covers neither the photos nor the animals. */}
      {ready && (
        <div className="absolute bottom-24 left-6 z-10 animate-pop">
          <button
            type="button"
            onPointerUp={(e) => e.stopPropagation()} // not the first click that restarts the show with music
            onClick={onDone}
            className="animate-glow rounded-full bg-saffron px-[1.3em] py-[0.6em] font-display text-[clamp(1.1rem,1.8vw,2.2rem)] font-extrabold text-night shadow-2xl"
          >
            {next}
          </button>
        </div>
      )}
      <CornerQR />
      <MusicToggle className="absolute bottom-6 left-6 z-10 text-xl" />
    </div>
  );
}
