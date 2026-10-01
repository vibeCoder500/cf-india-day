import { useState } from 'react';
import type { ModItem } from '../../shared/protocol';
import { client } from '../lib/client';
import Button from '../components/Button';

type Filter = 'all' | 'hidden' | 'visible';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'hidden', label: 'Pending/hidden' },
  { id: 'visible', label: 'Visible' },
];

const time = (at: number) => new Date(at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function ModerationPanel({ items }: { items: ModItem[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const list = items.filter((m) => filter === 'all' || (filter === 'hidden' ? m.hidden : !m.hidden));
  const hidden = items.filter((m) => m.hidden).length;
  return (
    <section className="rounded-2xl bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-bold">
          🛡️ Moderation <span className="text-sm font-normal opacity-70">· {hidden} hidden</span>
        </h3>
        <div className="flex gap-1" role="group" aria-label="Filter entries">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-2 py-1 text-xs font-bold ${filter === f.id ? 'bg-saffron text-night' : 'bg-white/10 hover:bg-white/20'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <p className="mt-3 text-sm opacity-70">Nothing here yet.</p>
      ) : (
        <ul className="mt-3 flex max-h-96 flex-col gap-1 overflow-y-auto pr-1">
          {list.map((m) => (
            <li key={m.id} className="flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className={`break-words ${m.hidden ? 'line-through opacity-50' : ''}`}>{m.text}</p>
                <p className="text-xs opacity-60">
                  {m.name} · {time(m.at)}
                </p>
              </div>
              <Button variant={m.hidden ? 'primary' : 'secondary'} onClick={() => client.send({ t: 'hide', answerId: m.id, hidden: !m.hidden })}>
                {m.hidden ? '✅ Show' : '🙈 Hide'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
