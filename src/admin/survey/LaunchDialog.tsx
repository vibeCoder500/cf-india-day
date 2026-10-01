import { useEffect, useState } from 'react';
import type { AdminState, Phase } from '../../../shared/protocol';
import type { AdminSurvey } from '../../../shared/survey';
import { DAY_MS, DAY_PRESETS, DEFAULT_K, K_CHOICES, SURVEY_LIMITS, endOfIstDay } from '../../../shared/survey';
import { client, useGame } from '../../lib/client';
import { useServerNow } from '../../lib/hooks';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { istDateTime, timeLeft } from '../../survey/time';

const PHASE_TEXT: Record<Phase, string> = {
  lobby: 'the lobby',
  question: 'a question with voting open',
  results: 'question results',
  leaderboard: 'the leaderboard',
  podium: 'the podium',
};
const card = (on: boolean) =>
  `flex flex-col gap-1 rounded-2xl p-4 text-left ring-2 ${on ? 'bg-saffron/15 ring-saffron' : 'bg-white/5 ring-transparent hover:bg-white/10'}`;
const chip = (on: boolean) => `rounded-xl px-3 py-2 text-sm font-bold ${on ? 'bg-saffron text-night' : 'bg-white/10 hover:bg-white/20'}`;

// Anonymity, reveal group, how many days. Host messages have no ack, so success = the survey list shows it launched.
export default function LaunchDialog({ s, admin, onClose, onLaunched }: { s: AdminSurvey; admin: AdminState; onClose: () => void; onLaunched: () => void }) {
  const [anonymous, setAnonymous] = useState(s.anonymous);
  const [k, setK] = useState(K_CHOICES.includes(s.k) ? s.k : DEFAULT_K);
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
  const current = admin.questions.find((q) => q.id === admin.game.qid);

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
    client.send({ t: 'survey:launch', id: s.id, days: n, endOfDay, anonymous, k: anonymous ? k : 1 });
  };

  return (
    <Modal title={`Launch “${s.title}”`} onClose={onClose} wide>
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold tracking-wide uppercase opacity-70">Who sees names?</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" aria-pressed={anonymous} onClick={() => setAnonymous(true)} className={card(anonymous)}>
              <span className="font-bold">🕶️ Anonymous (recommended)</span>
              <span className="text-sm opacity-80">
                Names are never stored with answers. One-way fingerprints of the name and device only stop double responses, and are erased 7 days
                after closing.
              </span>
            </button>
            <button type="button" aria-pressed={!anonymous} onClick={() => setAnonymous(false)} className={card(!anonymous)}>
              <span className="font-bold">👤 Named</span>
              <span className="text-sm opacity-80">You'll see who said what, and when.</span>
            </button>
          </div>
        </section>

        {anonymous && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold tracking-wide uppercase opacity-70">Reveal answers in groups of</h3>
            <div className="flex flex-wrap gap-2">
              {K_CHOICES.map((c) => (
                <button key={c} type="button" aria-pressed={k === c} onClick={() => setK(c)} className={chip(k === c)}>
                  {c === 1 ? '1 — instantly (no timing protection)' : c}
                </button>
              ))}
            </div>
            <p className="text-sm opacity-75">
              {k > 1
                ? `Answers appear in random groups of ${k} while the survey runs, so nobody can be spotted by when they submitted. Results unlock at ${2 * k} responses. When it closes, everything is revealed if at least ${k} people responded.`
                : 'Every answer shows up the moment it arrives — someone watching the results could tell whose answer just came in.'}
            </p>
          </section>
        )}

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

        {admin.game.phase !== 'lobby' && (
          <section className="flex flex-col gap-2 rounded-2xl bg-amber-500/15 p-4 ring-1 ring-amber-400/50">
            <p className="font-semibold">
              🎮 The game is still on {admin.game.phase === 'question' && current ? `“${current.text}” (voting open)` : PHASE_TEXT[admin.game.phase]}.
              People who open the app still go straight to the survey, but they'll land there when they finish or skip it.
            </p>
            <div>
              <Button onClick={() => client.send({ t: 'phase', phase: 'lobby' })}>🏠 Send everyone to the lobby</Button>
            </div>
          </section>
        )}

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
