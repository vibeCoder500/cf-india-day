import { useState } from 'react';
import { SPLASH_MS } from '../../shared/constants';
import PartyShow from '../components/PartyShow';
import { keepScreenOn } from '../lib/wakelock';

const SEEN_KEY = 'cfid.splashDone';

function seenThisTab() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export default function Splash({ onEnter }: { onEnter: () => void }) {
  const [ready, setReady] = useState(false);
  const [skipWait] = useState(seenThisTab); // a reload in the same tab shows the Enter button right away
  const duration = skipWait ? 0 : SPLASH_MS;

  const finish = () => {
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignore
    }
    setReady(true);
  };

  return (
    <main className="fixed inset-0 overflow-hidden bg-night">
      <PartyShow durationMs={duration} onDone={finish} />
      {!ready && (
        <div className="splash-progress absolute bottom-0 left-0 h-1.5 w-full bg-white/60" style={{ animationDuration: `${duration}ms` }} />
      )}
      {ready && (
        <div className="above-band absolute inset-x-0 z-10 flex justify-center">
          <div className="animate-pop">
            <button
              type="button"
              className="animate-glow rounded-full bg-saffron px-10 py-5 font-display text-3xl font-extrabold text-night shadow-2xl"
              onClick={() => {
                keepScreenOn();
                onEnter();
              }}
            >
              Enter 🚀
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
