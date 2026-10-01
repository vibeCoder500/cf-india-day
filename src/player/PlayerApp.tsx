import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { Question, ViewMsg } from '../../shared/protocol';
import { client, useGame } from '../lib/client';
import { burst } from '../lib/celebrate';
import ConnectionBanner from '../components/ConnectionBanner';
import DrawOverlay from '../components/DrawOverlay';
import MadeWith from '../components/MadeWith';
import ReactionBar from '../components/ReactionBar';
import TimerBar from '../components/TimerBar';
import Toast from '../components/Toast';
import TopBar from '../components/TopBar';
import SurveyBanner from '../survey/SurveyBanner';
import AnswerAnimal from './AnswerAnimal';
import AnswerChoice from './AnswerChoice';
import AnswerNumber from './AnswerNumber';
import AnswerScale from './AnswerScale';
import AnswerText from './AnswerText';
import PlayerLobby from './PlayerLobby';
import PlayerPodium from './PlayerPodium';
import PlayerRank from './PlayerRank';
import PlayerResult from './PlayerResult';
import QuestionHeader from './QuestionHeader';

const SurveyApp = lazy(() => import('../survey/SurveyApp')); // phones only download it when they open the survey

export default function PlayerApp({ surveyLink = false }: { surveyLink?: boolean }) {
  const view = useGame((s) => s.view);
  const survey = useGame((s) => s.survey);
  const me = useGame((s) => (s.survey ? s.surveyMe[s.survey.id] : undefined));
  const [surveyOpen, setSurveyOpen] = useState(surveyLink);
  const autoOpened = useRef(new Set<string>());
  const liveKey = view?.game.phase === 'question' ? `${view.game.qid}:${view.game.startedAt}` : null;

  useEffect(() => {
    burst(0.6);
  }, []);

  // A live survey this device hasn't answered opens by itself, once per survey per visit. After "Not now" the
  // banner is the way back in. Waiting for `me` (the "already answered?" check) keeps people who are done in the lobby.
  useEffect(() => {
    if (!survey || !me || me.done || autoOpened.current.has(survey.id)) return;
    if (Date.now() + client.state.offset >= survey.closesAt) return;
    autoOpened.current.add(survey.id);
    setSurveyOpen(true);
    window.scrollTo(0, 0);
  }, [survey, me]);

  useEffect(() => {
    if (!liveKey) return;
    navigator.vibrate?.(60);
    window.scrollTo(0, 0);
  }, [liveKey]);

  if (!view) return <div className="grid min-h-dvh place-items-center text-2xl">Joining the party… ✨</div>;

  const reactions = view.game.reactions && !surveyOpen;
  const openSurvey = () => {
    setSurveyOpen(true);
    window.scrollTo(0, 0);
  };
  const closeSurvey = () => {
    setSurveyOpen(false);
    if (location.pathname !== '/') history.replaceState(history.state, '', '/'); // keeps App's history marker
    window.scrollTo(0, 0);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <ConnectionBanner />
      <TopBar me={view.me} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-5 pb-6">
        {surveyOpen ? (
          <Suspense fallback={<p className="pt-10 text-center text-xl">Loading the survey… 📝</p>}>
            <SurveyApp onExit={closeSurvey} />
          </Suspense>
        ) : (
          <>
            <SurveyBanner lobby={view.game.phase === 'lobby'} onOpen={openSurvey} />
            <Phase view={view} />
          </>
        )}
      </main>
      {/* The bottom padding keeps it clear of the fixed reaction bar. */}
      <MadeWith className={reactions ? 'pb-[calc(5rem_+_max(0.5rem,env(safe-area-inset-bottom)))]' : 'pb-[max(1rem,env(safe-area-inset-bottom))]'} />
      <ReactionBar enabled={reactions} />
      <DrawOverlay draw={view.game.draw} variant="phone" meId={view.me.id} />
      <Toast />
    </div>
  );
}

function Phase({ view }: { view: ViewMsg }) {
  const { game, q } = view;
  if (game.phase === 'leaderboard') return <PlayerRank view={view} />;
  if (game.phase === 'podium') return <PlayerPodium view={view} />;
  // The host may have deleted the current question: fall back to the lobby.
  if (game.phase === 'lobby' || !q) return <PlayerLobby view={view} />;
  if (game.phase === 'results') return <PlayerResult view={view} q={q} />;
  return (
    <div className="flex flex-col gap-5">
      <TimerBar endsAt={game.endsAt} startedAt={game.startedAt} />
      <QuestionHeader q={q} />
      <Answer key={`${q.id}:${game.startedAt}`} view={view} q={q} />
    </div>
  );
}

function Answer({ view, q }: { view: ViewMsg; q: Question }) {
  switch (q.type) {
    case 'poll':
    case 'quiz':
      return <AnswerChoice view={view} q={q} />;
    case 'wordcloud':
    case 'open':
      return <AnswerText view={view} q={q} />;
    case 'scale':
    case 'awesome':
      return <AnswerScale view={view} q={q} />;
    case 'number':
      return <AnswerNumber view={view} q={q} />;
    case 'animal':
      return <AnswerAnimal view={view} q={q} />;
  }
}
