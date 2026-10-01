import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Draw } from '../../shared/protocol';
import { DRAW_SHOW_MS, DRAW_SPIN_MS } from '../../shared/constants';
import { burst } from '../lib/celebrate';
import { client } from '../lib/client';
import { useServerNow } from '../lib/hooks';

type Variant = 'phone' | 'screen';

const serverNow = () => Date.now() + client.state.offset;

export default function DrawOverlay({ draw, variant, meId }: { draw: Draw | null; variant: Variant; meId?: string }) {
  return draw ? <Visible key={draw.at} draw={draw} variant={variant} meId={meId} /> : null;
}

// Unmounts the ticking overlay once the draw is DRAW_SHOW_MS old.
function Visible({ draw, variant, meId }: { draw: Draw; variant: Variant; meId?: string }) {
  const [over, setOver] = useState(() => serverNow() >= draw.at + DRAW_SHOW_MS);
  useEffect(() => {
    const id = setTimeout(() => setOver(true), draw.at + DRAW_SHOW_MS - serverNow());
    return () => clearTimeout(id);
  }, [draw.at]);
  if (over) return null;
  return variant === 'screen' ? <ScreenDraw draw={draw} /> : <PhoneDraw draw={draw} meId={meId} />;
}

// Offsets (ms after draw.at) at which the slot shows its next name: 50 ms apart at first, easing out to 400 ms.
function spinSchedule(): number[] {
  const steps: number[] = [];
  for (let t = 0; t < DRAW_SPIN_MS; t += 50 + 350 * (t / DRAW_SPIN_MS) ** 2) steps.push(t);
  return steps;
}

function ScreenDraw({ draw }: { draw: Draw }) {
  const now = useServerNow(100);
  const steps = useMemo(spinSchedule, []);
  const elapsed = now - draw.at;
  const revealed = elapsed >= DRAW_SPIN_MS;

  useEffect(() => {
    if (revealed) burst(2);
  }, [revealed]);

  const pool = draw.pool.length > 0 ? draw.pool : [draw.name];
  const winnerAt = Math.max(0, pool.indexOf(draw.name));
  let step = 0;
  while (step + 1 < steps.length && steps[step + 1] <= elapsed) step++;
  // Count backwards from the winner so the last name shown is always the winner.
  const back = steps.length - 1 - step;
  const name = pool[(((winnerAt - back) % pool.length) + pool.length) % pool.length];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-night/85 p-[4vw] text-center backdrop-blur-sm">
      {revealed ? (
        <div className="animate-pop">
          <p className="font-display text-[clamp(2rem,4vw,4rem)] font-bold text-saffron">🎰 Lucky draw</p>
          <p className="mt-[2vh] font-display text-[clamp(3rem,8vw,9rem)] leading-none font-extrabold">
            🎉 {draw.avatar} {draw.name}!
          </p>
        </div>
      ) : (
        <div>
          <p className="font-display text-[clamp(2rem,4vw,4rem)] font-bold">🎰 Lucky draw…</p>
          <div className="mt-[3vh] min-w-[60vw] overflow-hidden rounded-3xl border-4 border-saffron bg-black/40 px-[4vw] py-[4vh] shadow-2xl">
            <p className="truncate font-display text-[clamp(2.5rem,7vw,7rem)] leading-tight font-extrabold">{name}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PhoneDraw({ draw, meId }: { draw: Draw; meId?: string }) {
  const now = useServerNow(100);
  // Wait for the big-screen reveal so phones don't spoil it.
  const revealed = now >= draw.at + DRAW_SPIN_MS;
  const mine = draw.winnerId === meId;

  useEffect(() => {
    if (!revealed || !mine) return;
    burst(1.5);
    navigator.vibrate?.([100, 50, 200]);
  }, [revealed, mine]);

  if (!revealed) return <TopToast>🎰 Lucky draw… look at the screen!</TopToast>;
  if (!mine) return <TopToast>🎰 {draw.avatar} {draw.name} got picked!</TopToast>;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-saffron p-6 text-center text-night">
      <div className="animate-pop">
        <p className="animate-bounce text-8xl">🎉</p>
        <p className="mt-4 font-display text-4xl font-extrabold">You've been picked, {draw.name}!</p>
        <p className="mt-2 text-lg font-bold">Look at the big screen 👀</p>
      </div>
    </div>
  );
}

function TopToast({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="animate-pop fixed inset-x-4 top-20 z-50 mx-auto max-w-md rounded-2xl bg-white px-4 py-3 text-center font-bold text-night shadow-2xl">
      {children}
    </div>
  );
}
