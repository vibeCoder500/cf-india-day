import { useState } from 'react';
import { calm } from '../lib/fun';
import { isMuted, setMuted } from '../lib/music';

// Turns the run-bys' funny sounds on or off on this device (the same setting as the game's music). Starts no music.
export default function SoundToggle({ className = '' }: { className?: string }) {
  const [muted, setState] = useState(isMuted);
  if (calm()) return null; // reduced motion: no run-bys, so no sounds either
  return (
    <button
      type="button"
      onClick={() => {
        setMuted(!muted);
        setState(!muted);
      }}
      aria-label={muted ? 'Turn sounds on' : 'Turn sounds off'}
      title={muted ? 'Sounds off' : 'Sounds on'}
      className={`grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-lg ring-1 ring-white/25 hover:bg-white/20 ${className}`}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
