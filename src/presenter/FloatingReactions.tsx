import { useEffect, useRef } from 'react';
import { client } from '../lib/client';

export default function FloatingReactions() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      client.onReactions((r) => {
        const box = ref.current;
        if (!box) return;
        for (const [emoji, count] of Object.entries(r)) {
          for (let i = 0; i < Math.min(count, 6); i++) {
            if (box.childElementCount > 60) box.firstElementChild?.remove();
            const el = document.createElement('span');
            el.textContent = emoji; // textContent, never innerHTML
            el.className = 'float-rx';
            el.style.left = `${5 + Math.random() * 90}%`;
            el.style.fontSize = `${2 + Math.random() * 2.5}rem`;
            el.style.animationDuration = `${2.4 + Math.random() * 1.6}s`;
            el.style.animationDelay = `${i * 120}ms`;
            el.addEventListener('animationend', () => el.remove());
            box.appendChild(el);
          }
        }
      }),
    [],
  );
  return <div ref={ref} className="pointer-events-none fixed inset-0 z-40 overflow-hidden" />;
}
