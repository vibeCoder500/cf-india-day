import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AdminState, Question } from '../../shared/protocol';
import { TYPE_INFO, defaultQuestion } from '../../shared/constants';
import { client } from '../lib/client';
import Button from '../components/Button';
import ImportExport from './ImportExport';
import QuestionEditor from './QuestionEditor';
import TemplatesModal from './TemplatesModal';
import { ANIMAL_PACK, STARTER_PACK } from './templates';

export default function QuestionList({ admin, eventId, onSelectEvent }: { admin: AdminState; eventId: string; onSelectEvent: (id: string) => void }) {
  const { questions, asked, game, events } = admin;
  const [editing, setEditing] = useState<Question | null>(null);
  const [templates, setTemplates] = useState(false);
  const creating = useRef<number | null>(null); // event count when "New event" was sent
  const live = game.phase === 'question' ? game.qid : null;
  const event = events.find((e) => e.id === eventId);
  const eventName = event?.name ?? '';
  const isLiveEvent = eventId === game.eventId;
  const liveName = events.find((e) => e.id === game.eventId)?.name ?? '';
  const list = questions.filter((q) => q.eventId === eventId);

  // Open a new event as soon as the server has created it (new events are appended).
  useEffect(() => {
    if (creating.current === null || events.length <= creating.current) return;
    creating.current = null;
    onSelectEvent(events[events.length - 1].id);
  }, [events, onSelectEvent]);

  const newEvent = () => {
    const name = prompt('Name of the new event (for example "Morning townhall")')?.trim();
    if (!name) return;
    creating.current = events.length;
    client.send({ t: 'event:save', event: { id: '', name } });
  };
  const renameEvent = () => {
    const name = prompt('Rename the event', eventName)?.trim();
    if (event && name && name !== event.name) client.send({ t: 'event:save', event: { id: event.id, name } });
  };
  const deleteEvent = () => {
    if (event && confirm(`Delete the event “${event.name}” and its ${list.length} question(s)?`)) client.send({ t: 'event:delete', id: event.id });
  };
  const makeLive = () => {
    if (event && confirm(`Make “${event.name}” the live event? Everyone goes back to the lobby, and only its questions can be launched.`)) {
      client.send({ t: 'event:live', id: event.id });
    }
  };
  const addPack = (pack: Question[]) => client.send({ t: 'q:import', questions: pack, replace: false, eventId });

  const launch = (q: Question, n: number) => {
    if (live && !confirm(live === q.id ? `Restart Q${n}? This clears its answers.` : 'Another question is live. Close it and launch this one?')) return;
    if (!live && asked[q.id] && !confirm(`Q${n} was already asked. Re-running it clears its answers and points.`)) return;
    client.send({ t: 'launch', qid: q.id });
  };

  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-3 rounded-2xl bg-white/5 p-3">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Events">
          <span className="text-sm font-bold opacity-70">🎪 Events</span>
          {events.map((e) => (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={e.id === eventId}
              onClick={() => onSelectEvent(e.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold ${e.id === eventId ? 'bg-saffron text-night' : 'bg-white/10 hover:bg-white/20'}`}
            >
              {e.id === game.eventId && <span className="size-2 animate-pulse rounded-full bg-red-500" title="Live event" />}
              {e.name}
              <span className="font-normal opacity-70">· {questions.filter((q) => q.eventId === e.id).length}</span>
            </button>
          ))}
          <Button onClick={newEvent}>＋ New event</Button>
        </div>
        {event && (
          <div className="flex flex-wrap items-center gap-2">
            {isLiveEvent ? (
              <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">🔴 LIVE EVENT</span>
            ) : (
              <Button
                variant="primary"
                disabled={game.phase === 'question'}
                title={game.phase === 'question' ? 'Close the current question first' : undefined}
                onClick={makeLive}
              >
                ▶ Make “{event.name}” live
              </Button>
            )}
            <Button onClick={renameEvent}>✏️ Rename</Button>
            <Button variant="danger" disabled={events.length === 1} title={events.length === 1 ? 'Keep at least one event' : undefined} onClick={deleteEvent}>
              🗑 Delete event
            </Button>
          </div>
        )}
        {!isLiveEvent && (
          <p className="rounded-xl bg-sky-500/15 px-3 py-2 text-sm ring-1 ring-sky-400/40">
            👀 You're preparing “{eventName}”. “{liveName}” is live, so these questions can't be launched until you make this event live.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-display text-2xl font-bold">❓ Questions · {list.length}</h2>
        <Button variant="primary" onClick={() => setEditing({ ...defaultQuestion('poll'), eventId })}>
          ＋ New question
        </Button>
        <Button onClick={() => setTemplates(true)}>📚 Templates</Button>
        <ImportExport questions={list} eventId={eventId} eventName={eventName} />
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/5 p-8 text-center">
          <p className="text-lg opacity-80">No questions in “{eventName}” yet</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button big variant="primary" onClick={() => addPack(STARTER_PACK)}>
              Add starter pack ({STARTER_PACK.length})
            </Button>
            <Button big variant="primary" onClick={() => addPack(ANIMAL_PACK)}>
              Add spirit animal pack ({ANIMAL_PACK.length})
            </Button>
          </div>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {list.map((q, i) => {
            const info = TYPE_INFO[q.type];
            const isLive = live === q.id;
            const done = asked[q.id];
            return (
              <li key={q.id} className={`rounded-2xl p-3 ${isLive ? 'bg-red-500/15 ring-2 ring-red-500' : 'bg-white/5'}`}>
                <div className="flex items-start gap-3">
                  <span className="w-6 shrink-0 pt-0.5 text-right font-bold tabular-nums opacity-60">{i + 1}</span>
                  <span className="text-xl" title={info.label}>
                    {info.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-semibold break-words">{q.text}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      {q.timer > 0 && <Badge>⏱ {q.timer}s</Badge>}
                      {q.points === 2 && <Badge>✨ 2× points</Badge>}
                      {(q.type === 'quiz' || q.type === 'number') && q.correct !== null && <Badge>✅ answer set</Badge>}
                      {q.moderate && <Badge>🛡️ moderated</Badge>}
                      {isLive ? (
                        <Badge live>🔴 LIVE</Badge>
                      ) : done ? (
                        <Badge>✓ done · {done.n} answered</Badge>
                      ) : (
                        <span className="px-1 py-0.5 opacity-50">not asked</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                  <Button
                    variant="primary"
                    disabled={!isLiveEvent}
                    title={isLiveEvent ? undefined : `Make “${eventName}” live to launch its questions`}
                    onClick={() => launch(q, i + 1)}
                  >
                    ▶ Launch
                  </Button>
                  <Button onClick={() => setEditing(q)}>✏️ Edit</Button>
                  <Button onClick={() => client.send({ t: 'q:save', q: { ...q, id: '' } })}>⧉ Duplicate</Button>
                  <Button aria-label="Move up" disabled={i === 0} onClick={() => client.send({ t: 'q:move', id: q.id, dir: -1 })}>
                    ↑
                  </Button>
                  <Button aria-label="Move down" disabled={i === list.length - 1} onClick={() => client.send({ t: 'q:move', id: q.id, dir: 1 })}>
                    ↓
                  </Button>
                  <Button
                    disabled={!done && !isLive}
                    title="Delete this question's answers and points, as if it was never asked"
                    onClick={() => confirm(`Clear all answers for Q${i + 1}? Its responses and points are deleted, as if it was never asked.`) && client.send({ t: 'q:clear', id: q.id })}
                  >
                    🧹 Clear
                  </Button>
                  <Button
                    variant="danger"
                    aria-label="Delete"
                    disabled={isLive}
                    onClick={() => confirm(`Delete Q${i + 1} “${q.text}”?`) && client.send({ t: 'q:delete', id: q.id })}
                  >
                    🗑
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {editing && <QuestionEditor initial={editing} events={events} onClose={() => setEditing(null)} />}
      {templates && <TemplatesModal eventId={eventId} eventName={eventName} onClose={() => setTemplates(false)} />}
    </div>
  );
}

function Badge({ live = false, children }: { live?: boolean; children: ReactNode }) {
  return <span className={`rounded-md px-1.5 py-0.5 font-semibold ${live ? 'bg-red-500 text-white' : 'bg-white/10'}`}>{children}</span>;
}
