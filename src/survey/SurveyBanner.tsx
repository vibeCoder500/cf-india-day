import { surveyMinutes } from '../../shared/survey';
import { useGame } from '../lib/client';
import { useServerNow } from '../lib/hooks';
import Button from '../components/Button';
import { timeLeft } from './time';

// The way into the live survey from the player app: a big card in the lobby, a slim bar during the game.
export default function SurveyBanner({ lobby, onOpen }: { lobby: boolean; onOpen: () => void }) {
  const survey = useGame((s) => s.survey);
  const mine = useGame((s) => s.surveyMe);
  const now = useServerNow(30_000);
  if (!survey || now >= survey.closesAt) return null;
  const me = mine[survey.id];
  if (me?.done) {
    return lobby ? (
      <p className="mx-auto mb-4 w-fit rounded-full bg-green-500/15 px-4 py-2 text-sm font-bold text-green-200 ring-1 ring-green-400/40">
        ✅ Feedback sent — thank you! 💛
      </p>
    ) : null;
  }
  const left = timeLeft(survey.closesAt - now);
  if (!lobby) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-saffron/15 px-4 py-2 ring-1 ring-saffron/40">
        <p className="min-w-0 flex-1 text-sm font-semibold">📝 Feedback survey open · {left} left</p>
        <Button variant="primary" onClick={onOpen}>
          Open
        </Button>
      </div>
    );
  }
  return (
    <section className="animate-pop mb-5 flex flex-col items-center gap-3 rounded-3xl bg-linear-to-br from-saffron/25 to-fuchsia-500/20 p-5 text-center ring-2 ring-saffron/50">
      <p className="animate-wiggle text-5xl">📝</p>
      <h2 className="font-display text-2xl leading-tight font-extrabold">{survey.title}</h2>
      <p className="text-sm opacity-90">
        Takes ~{surveyMinutes(survey.questions)} min · closes in {left} ⏳
      </p>
      <p className="text-sm opacity-80">{survey.anonymous ? '🕶️ Anonymous — your name is never saved with your answers' : '👤 Your name is shown with your answers'}</p>
      {me && me.n >= 3 && <p className="text-sm font-semibold">🎉 {me.n} colleagues have already shared</p>}
      <Button big variant="primary" className="animate-glow w-full" onClick={onOpen}>
        Share your feedback ▶
      </Button>
    </section>
  );
}
