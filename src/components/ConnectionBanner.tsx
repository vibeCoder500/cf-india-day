import { useEffect, useState } from 'react';
import { useGame } from '../lib/client';

// Only shows after 1.5 s offline, so brief blips don't flash the banner.
export default function ConnectionBanner() {
  const open = useGame((s) => s.status === 'open');
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) return;
    const id = setTimeout(() => setShow(true), 1500);
    return () => {
      clearTimeout(id);
      setShow(false);
    };
  }, [open]);

  if (!show) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 bg-amber-400 py-2 text-center font-bold text-night shadow-lg">
      Reconnecting… hang tight <span className="inline-block animate-spin">🔄</span>
    </div>
  );
}
