import type { CSSProperties } from 'react';

// SVG instead of Unicode glyphs because some phones lack the glyph fonts.
export default function Shape({ i, className = '', style }: { i: number; className?: string; style?: CSSProperties }) {
  const k = i % 6;
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden>
      {k === 0 && <path d="M12 3 L22 20 H2 Z" />}
      {k === 1 && <path d="M12 2 L22 12 L12 22 L2 12 Z" />}
      {k === 2 && <circle cx="12" cy="12" r="9.5" />}
      {k === 3 && <rect x="3.5" y="3.5" width="17" height="17" rx="2" />}
      {k === 4 && <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />}
      {k === 5 && <path d="M7 3h10l5 9-5 9H7l-5-9z" />}
    </svg>
  );
}
