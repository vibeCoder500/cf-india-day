import { REACTIONS } from '../../shared/constants';
import { client } from '../lib/client';
import { puff } from '../lib/fun';

export default function ReactionBar({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <nav
      aria-label="Reactions"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-night/90 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
    >
      <div className="mx-auto grid max-w-md grid-cols-6 gap-1">
        {REACTIONS.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={`React ${e}`}
            className="h-14 rounded-xl text-3xl transition hover:bg-white/10 active:scale-90"
            onClick={(ev) => {
              client.react(e);
              const r = ev.currentTarget.getBoundingClientRect();
              // Now and then a reaction goes mega.
              puff(r.left + r.width / 2, r.top, e, Math.random() < 0.12 ? 3.5 : 1.3);
              navigator.vibrate?.(10);
            }}
          >
            {e}
          </button>
        ))}
      </div>
    </nav>
  );
}
