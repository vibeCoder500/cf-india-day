import { startMusic } from '../lib/music';

// Phones hold sound back until the first tap, so the party starts with one: it switches the music on for the splash.
export default function TapToStart({ onStart }: { onStart: () => void }) {
  const start = () => {
    // iPhones in silent mode mute web audio unless the page asks to play like a music app.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    startMusic();
    onStart();
  };

  return (
    <button type="button" onClick={start} className="fixed inset-0 flex flex-col items-center justify-center gap-7 bg-night p-6 text-center">
      <span className="splash-bg absolute inset-0" />
      <span className="animate-glow relative grid size-40 place-items-center rounded-full bg-saffron text-7xl shadow-2xl">
        <span className="animate-bob inline-block">🎉</span>
      </span>
      <span className="relative font-display text-4xl leading-tight font-extrabold">Tap to start the party!</span>
      <span className="relative rounded-full bg-white/10 px-5 py-2 text-lg font-bold">🔊 Sound on</span>
    </button>
  );
}
