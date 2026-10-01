import { useEffect, useState, useSyncExternalStore } from 'react';
import { isMuted, musicStatus, onMusicChange, setMuted, startMusic, stopMusic } from '../lib/music';

// Plays the party music while mounted, with a mute toggle. Browsers hold sound back until the first tap, click or key
// press anywhere on the page, so until then the icon just pulses and the music starts with that first touch.
export default function MusicToggle({ className = '' }: { className?: string }) {
  const [muted, setMutedState] = useState(isMuted);
  const status = useSyncExternalStore(onMusicChange, musicStatus);
  const waiting = !muted && status !== 'playing';

  useEffect(() => {
    if (muted) return;
    startMusic();
    return () => stopMusic();
  }, [muted]);

  const toggle = () => {
    if (waiting) return; // this tap has just started the music
    setMuted(!muted);
    setMutedState(!muted);
    if (muted) startMusic(); // start inside the tap so iOS allows it
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? 'Unmute music' : waiting ? 'Play music' : 'Mute music'}
      className={`rounded-full bg-black/45 px-4 py-2 font-bold text-white shadow-lg backdrop-blur ${waiting ? 'animate-pulse' : ''} ${className}`}
    >
      {muted ? '🔇' : waiting ? '🔈' : '🔊'}
    </button>
  );
}
