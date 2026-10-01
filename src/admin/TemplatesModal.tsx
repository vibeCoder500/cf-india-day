import { useState } from 'react';
import type { Question } from '../../shared/protocol';
import { TYPE_INFO } from '../../shared/constants';
import { client } from '../lib/client';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { ANIMAL_PACK, STARTER_PACK } from './templates';

const PACKS = [
  { label: '📚 Starter pack', blurb: 'India/townhall icebreakers. Add them all or pick a few, then swap in your own team questions.', questions: STARTER_PACK },
  {
    label: '🐾 Spirit animals',
    blurb: 'Phones show the animal cards; every pick floats up as a bubble on the big screen. Edit the text or the animals after adding.',
    questions: ANIMAL_PACK,
  },
];

export default function TemplatesModal({ eventId, eventName, onClose }: { eventId: string; eventName: string; onClose: () => void }) {
  const [pack, setPack] = useState(0);
  const [added, setAdded] = useState<string[]>([]);
  const add = (questions: Question[]) => client.send({ t: 'q:import', questions, replace: false, eventId });
  const { blurb, questions } = PACKS[pack];

  return (
    <Modal title={`📚 Templates → ${eventName}`} onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Question packs">
        {PACKS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            role="tab"
            aria-selected={i === pack}
            onClick={() => setPack(i)}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${i === pack ? 'bg-saffron text-night' : 'bg-white/10 hover:bg-white/20'}`}
          >
            {p.label} ({p.questions.length})
          </button>
        ))}
      </div>
      <p className="mb-3 text-sm opacity-80">{blurb}</p>
      <ul className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
        {questions.map((q, i) => {
          const id = `${pack}:${i}`;
          return (
            <li key={id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
              <span className="text-xl" title={TYPE_INFO[q.type].label}>
                {TYPE_INFO[q.type].icon}
              </span>
              <span className="min-w-0 flex-1 text-sm">{q.text}</span>
              <Button
                disabled={added.includes(id)}
                onClick={() => {
                  add([q]);
                  setAdded((a) => [...a, id]);
                }}
              >
                {added.includes(id) ? 'Added ✓' : '＋ Add'}
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            add(questions);
            onClose();
          }}
        >
          Add all {questions.length}
        </Button>
      </div>
    </Modal>
  );
}
