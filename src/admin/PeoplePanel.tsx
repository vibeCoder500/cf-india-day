import { useState } from 'react';
import type { AdminPlayer } from '../../shared/protocol';
import { client } from '../lib/client';
import Button from '../components/Button';

export default function PeoplePanel({ players }: { players: AdminPlayer[] }) {
  const [search, setSearch] = useState('');
  const s = search.trim().toLowerCase();
  const list = s ? players.filter((p) => p.name.toLowerCase().includes(s)) : players;
  const online = players.filter((p) => p.online).length;

  const remove = (p: AdminPlayer) => {
    if (confirm(`Remove ${p.name}? Their entries get hidden and the name is blocked.`)) client.send({ t: 'kick', playerId: p.id });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-bold">👥 People</h2>
        <span className="text-sm opacity-80">
          🟢 {online} online · {players.length} joined
        </span>
      </div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search names…"
        aria-label="Search names"
        className="rounded-xl bg-white/10 px-4 py-2 outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-saffron"
      />
      {list.length === 0 ? (
        <p className="rounded-2xl bg-white/5 p-4 text-center opacity-70">{players.length === 0 ? 'Nobody has joined yet.' : 'No matches.'}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-white/5 rounded-2xl bg-white/5">
          {list.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <span className={`size-2.5 shrink-0 rounded-full ${p.online ? 'bg-green-400' : 'bg-white/20'}`} title={p.online ? 'Online' : 'Offline'} />
              <span className="text-xl">{p.avatar}</span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="text-sm tabular-nums opacity-80">{p.score.toLocaleString('en-IN')}</span>
              <Button variant="danger" onClick={() => remove(p)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
