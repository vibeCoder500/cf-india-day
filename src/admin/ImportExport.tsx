import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Question } from '../../shared/protocol';
import { client } from '../lib/client';
import Button from '../components/Button';
import Modal from '../components/Modal';

// ⬇ Export / ⬆ Import of one event's questions as JSON (used in the Questions toolbar and the More tab).
export default function ImportExport({ questions, eventId, eventName }: { questions: Question[]; eventId: string; eventName: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [incoming, setIncoming] = useState<Question[] | null>(null);

  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    const slug = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event';
    a.download = `corpfun-day-${slug}-questions.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!Array.isArray(data) || data.length === 0) throw new Error('not a list');
      setIncoming(data as Question[]); // the server validates every question
    } catch {
      alert("That file doesn't look like a questions export (a JSON list of questions).");
    }
  };

  const doImport = (replace: boolean) => {
    if (incoming) client.send({ t: 'q:import', questions: incoming, replace, eventId });
    setIncoming(null);
  };

  return (
    <>
      <Button onClick={exportJson} disabled={questions.length === 0}>
        ⬇ Export
      </Button>
      <Button onClick={() => fileRef.current?.click()}>⬆ Import</Button>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
      {incoming && (
        <Modal title="Import questions" onClose={() => setIncoming(null)}>
          <p>
            Found {incoming.length} question(s) for “{eventName}”. Replace its {questions.length} existing questions, or append them to the end?
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setIncoming(null)}>
              Cancel
            </Button>
            <Button onClick={() => doImport(false)}>Append</Button>
            <Button variant="danger" onClick={() => doImport(true)}>
              Replace all
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
