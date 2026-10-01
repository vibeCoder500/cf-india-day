import type { ClientMsg } from '../../shared/protocol';
import { client } from '../lib/client';
import Button from '../components/Button';

type Scope = Extract<ClientMsg, { t: 'reset' }>['scope'];

const reset = (scope: Scope) => client.send({ t: 'reset', scope });

export default function DangerZone() {
  return (
    <section className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4">
      <h3 className="font-display text-xl font-bold text-red-300">⚠️ Danger zone</h3>
      <div className="mt-3 flex flex-col gap-3">
        <Row
          title="Reset answers & scores"
          desc="Everyone's score goes back to 0. Players and questions stay."
          action="Reset"
          onClick={() => confirm('Reset all answers and scores?') && reset('answers')}
        />
        <Row
          title="Remove all players"
          desc="Everyone has to join again. Questions and host sessions stay."
          action="Remove all"
          onClick={() => prompt('Type RESET to remove all players') === 'RESET' && reset('players')}
        />
        <Row
          title="Wipe everything"
          desc="Deletes questions, players, answers, surveys (with their responses) and host sessions (logs everyone out). Use after the event."
          action="Wipe"
          onClick={() => prompt('Type WIPE to delete everything') === 'WIPE' && reset('wipe')}
        />
      </div>
    </section>
  );
}

function Row({ title, desc, action, onClick }: { title: string; desc: string; action: string; onClick: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/20 p-3">
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        <p className="text-sm opacity-70">{desc}</p>
      </div>
      <Button variant="danger" onClick={onClick}>
        {action}
      </Button>
    </div>
  );
}
