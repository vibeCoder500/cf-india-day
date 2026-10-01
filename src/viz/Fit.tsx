import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

// Shrinks every size written with var(--fit) until nothing spills out of the box, so long options show in full.
export default function Fit({ watch, children }: { watch: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    const fits = (scale: number) => {
      el.style.setProperty('--fit', String(scale));
      return el.scrollHeight <= el.clientHeight;
    };
    const fit = () => {
      if (fits(1)) return;
      let [lo, hi] = [0.25, 1];
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      fits(lo);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [watch]);

  return (
    <div ref={ref} className="h-full overflow-hidden">
      {children}
    </div>
  );
}
