import { useEffect } from 'react';
import type { ReactNode } from 'react';

export default function Modal({ title, onClose, wide = false, children }: { title: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full rounded-2xl bg-[#1d1440] p-5 shadow-2xl ring-1 ring-white/10 ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-xl hover:bg-white/10">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
