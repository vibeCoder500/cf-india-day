import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { ViewMsg } from '../../shared/protocol';
import { LIMITS } from '../../shared/constants';
import { client, confirmLeave, useGame } from '../lib/client';
import { pick, POKES, trick } from '../lib/fun';
import AvatarPicker from '../components/AvatarPicker';
import Button from '../components/Button';

export default function PlayerLobby({ view }: { view: ViewMsg }) {
  const { me, online } = view;
  const [editing, setEditing] = useState<'name' | 'avatar' | null>(null);
  const [name, setName] = useState(me.name);
  const [poke, setPoke] = useState<{ id: number; text: string } | null>(null);
  const error = useGame((s) => s.error);
  const trimmed = name.trim();
  const valid = Array.from(trimmed).length >= LIMITS.nameMin;

  // The server confirmed the rename: close the editor.
  useEffect(() => {
    setEditing((e) => (e === 'name' ? null : e));
  }, [me.name]);

  useEffect(() => {
    if (!poke) return;
    const id = setTimeout(() => setPoke(null), 2200);
    return () => clearTimeout(id);
  }, [poke]);

  const saveName = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    if (trimmed === me.name) return setEditing(null);
    client.clearError();
    client.send({ t: 'rename', name: trimmed });
  };

  return (
    <div className="flex flex-col items-center gap-5 pt-4 text-center">
      <button
        type="button"
        aria-label="Poke your avatar"
        className="relative"
        onClick={(e) => {
          trick(e.currentTarget.firstElementChild!);
          setPoke({ id: Date.now(), text: pick(POKES) });
          navigator.vibrate?.(15);
        }}
      >
        {/* Separate layers so the trick, the float and the button's jelly never fight over the same transform. */}
        <span className="inline-block">
          <span className="animate-float inline-block text-8xl">{me.avatar}</span>
        </span>
        {poke && (
          <span
            key={poke.id}
            className="animate-pop absolute -top-4 left-[70%] z-10 rounded-2xl rounded-bl-none bg-white px-3 py-1.5 text-sm font-bold whitespace-nowrap text-night shadow-xl"
          >
            {poke.text}
          </span>
        )}
      </button>
      <h2 className="font-display text-3xl leading-tight font-extrabold">
        You're in, <span className="text-saffron">{me.name}</span>!
      </h2>
      <p className="text-lg opacity-90">👀 Keep this page open and watch the big screen.</p>
      <p key={online} className="animate-boing rounded-full bg-white/10 px-4 py-2 font-bold">
        {online} {online === 1 ? 'person' : 'people'} here
      </p>
      <p className="-mt-2 text-xs opacity-50">Psst… try poking your avatar 👆</p>

      {editing === 'name' && (
        <form onSubmit={saveName} className="flex w-full flex-col gap-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoComplete="nickname"
            enterKeyHint="done"
            aria-label="Your name"
            className="rounded-2xl bg-white/10 px-5 py-4 text-xl outline-none ring-2 ring-white/20 focus:ring-saffron"
          />
          {error && (error.code === 'NAME_TAKEN' || error.code === 'NAME_INVALID') && (
            <p className="rounded-xl bg-red-500/20 px-4 py-3 text-red-100">{error.message}</p>
          )}
          <div className="flex gap-2">
            <Button big className="flex-1" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button big type="submit" variant="primary" className="flex-1" disabled={!valid}>
              Save
            </Button>
          </div>
        </form>
      )}

      {editing === 'avatar' && (
        <div className="w-full">
          <AvatarPicker
            value={me.avatar}
            onChange={(avatar) => {
              client.send({ t: 'avatar', avatar });
              setEditing(null);
            }}
          />
        </div>
      )}

      {editing === null && (
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              setName(me.name);
              setEditing('name');
            }}
          >
            ✏️ Edit name
          </Button>
          <Button onClick={() => setEditing('avatar')}>🎭 Change avatar</Button>
        </div>
      )}

      <button type="button" className="mt-2 text-sm underline opacity-60" onClick={confirmLeave}>
        Not you? Switch
      </button>
    </div>
  );
}
