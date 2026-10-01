import { useEffect } from 'react';
import { client, useGame } from '../lib/client';

export default function Toast() {
  const error = useGame((s) => s.error);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => client.clearError(), 4000);
    return () => clearTimeout(id);
  }, [error]);

  if (!error) return null;
  return (
    <div
      key={error.at}
      role="alert"
      className="animate-pop fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-2xl bg-white px-4 py-3 text-center font-bold text-night shadow-2xl"
    >
      {error.message}
    </div>
  );
}
