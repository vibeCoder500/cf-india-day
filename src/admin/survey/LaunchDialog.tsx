import { useEffect, useState } from 'react';
import type { AdminSurvey } from '../../../shared/survey';
import { DAY_MS, DAY_PRESETS, SURVEY_LIMITS, endOfIstDay } from '../../../shared/survey';
import { client, useGame } from '../../lib/client';
import { useServerNow } from '../../lib/hooks';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { istDateTime, timeLeft } from '../../survey/time';

const chip = (on: boolean) => `rounded-xl px-3 py-2 text-sm font-bold ${on ? 'bg-saffron text-night' : 'bg-white/10 hover:bg-white/20'}`;

// How many days it stays open. Host messages have no ack, so success = the survey list shows it launched.
export default function LaunchDialog({ s, onClose, onLaunched }: { s: AdminSurvey; onClose: () => void; onLaunched: () => void }) {
  const [days, setDays] = useState(DAY_PRESETS.includes(s.days) ? s.days : 3);
  const [custom, setCustom] = useState('');
  const [endOfDay, setEndOfDay] = useState(s.endOfDay);
  const [sentAt, setSentAt] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const surveys = useGame((st) => st.surveys);
  const error = useGame((st) => st.error);
  const now = useServerNow(15_000);

  const n = custom.trim() ? Number(custom) : days;
  const validDays = Number.isInteger(n) && n >= 1 && n <= SURVEY_LIMITS.days;
  const target = now + (validDays ? n : 0) * DAY_MS;
  const closesAt = endOfDay ? endOfIstDay(target) : target;
  const launched = surveys?.find((x) => x.id === s.id)?.opensAt != null;

  useEffect(() => {
    if (sentAt && launched) onLaunched();
  }, [sentAt, launched, onLaunched]);

  useEffect(() => {
    if (!sentAt || !error || error.at < sentAt) return;
    setProblem(error.message);
    setSentAt(0);
  }, [sentAt, error]);

  const launch = () => {
    setProblem(null);
    setSentAt(Date.now());
    client.send({ t: 'survey:launch', id: s.id, days: n, endOfDay, anonymous: true, k: 1 });
  };

  return (
    <Modal title={`Launch “${s.title}”`} onClose={onClose} wide>
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold tracking-wide uppercase opacity-70">Open for</h3>
          <div className="flex flex-wrap items-center gap-2">
            {DAY_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={!custom.trim() && days === d}
                onClick={() => {
                  setDays(d);
                  setCustom('');
                }}
                className={chip(!custom.trim() && days === d)}
              >
                {d} {d === 1 ? 'day' : 'days'}
              </button>
            ))}
            <input
              inputMode="numeric"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
              placeholder="Other"
              aria-label={`Number of days (1–${SURVEY_LIMITS.days})`}
              className="w-24 rounded-xl bg-white/10 px-3 py-2 text-sm outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-saffron"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-3 self-start rounded-xl bg-white/5 px-3 py-2">
            <input type="checkbox" checked={endOfDay} onChange={(e) => setEndOfDay(e.target.checked)} className="size-5 accent-saffron" />
            <span className="text-sm font-semibold">Close at 11:59 pm IST</span>
          </label>
          <p className="font-bold">
            {validDays ? `⏳ Closes ${istDateTime(closesAt)} · in ${timeLeft(closesAt - now)}` : `Pick 1–${SURVEY_LIMITS.days} days`}
          </p>
        </section>

        <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm opacity-90">
          🕶️ Responses are anonymous: nobody logs in or gives a name. A one-way fingerprint of each device stops double responses and is erased 7
          days after closing. You'll see every response on its own, as it arrives.
        </p>

        {problem && <p className="rounded-xl bg-red-500/20 px-4 py-3 text-red-100">{problem}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!validDays || sentAt > 0} onClick={launch}>
            {sentAt > 0 ? 'Launching…' : '🚀 Launch survey'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}