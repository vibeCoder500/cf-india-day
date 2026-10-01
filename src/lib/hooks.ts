import { useEffect, useReducer } from 'react';
import { client } from './client';

export function useServerNow(everyMs = 250): number {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(tick, everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return Date.now() + client.state.offset;
}

export function useSecondsLeft(endsAt: number | null): number | null {
  const now = useServerNow(250);
  return endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000));
}
