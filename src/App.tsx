import { lazy, Suspense, useEffect, useState } from 'react';
import { SURVEY_ROUTE, client, confirmLeave, useGame } from './lib/client';
import Splash from './screens/Splash';
import Join from './screens/Join';
import TapToStart from './screens/TapToStart';
import PlayerApp from './player/PlayerApp';
import MusicToggle from './components/MusicToggle';
import Zoomies from './components/Zoomies';

const AdminApp = lazy(() => import('./admin/AdminApp'));
const PresenterApp = lazy(() => import('./presenter/PresenterApp'));
const SurveySite = lazy(() => import('./survey/SurveySite'));

const Loading = () => <div className="grid min-h-dvh place-items-center text-2xl">Loading… ✨</div>;

// One extra history entry while past the splash, so Back steps out of the game instead of leaving the site.
const STAGE = 'cfid-stage';

// Two sites in one: the icebreaker game, and the survey site (/survey to answer, /surveyAdmin to run surveys).
export default function App() {
  if (SURVEY_ROUTE) {
    return (
      <Suspense fallback={<Loading />}>
        <SurveySite />
      </Suspense>
    );
  }
  return <GameApp />;
}

function GameApp() {
  const session = useGame((s) => s.session);
  const presenter = location.pathname.startsWith('/present');
  // D12: people who already joined on this device skip the splash after a reload.
  const [entered, setEntered] = useState(() => client.state.session !== null);
  // Audience phones start with one tap, so the splash gets its music. Hosts log in on laptops, which skip it, as do the
  // presenter screen and anyone already logged in.
  const [tapped, setTapped] = useState(
    () => presenter || client.state.session !== null || !matchMedia('(hover: none) and (pointer: coarse)').matches,
  );

  // Back walks one stage back: game → (confirm) log out → join → splash.
  useEffect(() => {
    if (presenter) return;
    const onPop = () => {
      if (client.state.session) {
        history.pushState(STAGE, '');
        confirmLeave();
      } else {
        setEntered(false);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [presenter]);

  useEffect(() => {
    if (!presenter && entered && history.state !== STAGE) history.pushState(STAGE, '');
  }, [presenter, entered]);

  if (presenter) {
    return (
      <Suspense fallback={<Loading />}>
        {session?.role === 'admin' ? <PresenterApp /> : <NotHost />}
      </Suspense>
    );
  }
  if (entered && session?.role === 'admin') {
    return (
      <Suspense fallback={<Loading />}>
        <AdminApp />
      </Suspense>
    );
  }
  if (!tapped) return <TapToStart onStart={() => setTapped(true)} />;
  return (
    <>
      {!entered ? <Splash onEnter={() => setEntered(true)} /> : session ? <PlayerApp /> : <Join />}
      {/* Party music from the splash until they've joined. Phones only allow sound after a tap, so the Enter tap starts it at the latest. */}
      {!session && <MusicToggle className="fixed top-[max(1rem,env(safe-area-inset-top))] right-4 z-40" />}
      {/* Audience only: the host console and the big screen stay free of surprise animals. */}
      {entered && <Zoomies />}
    </>
  );
}

function NotHost() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-3xl">🎤 Presenter screen</p>
        <p className="mt-3 opacity-80">Log in as the host on this device first, then reopen /present.</p>
        <a className="mt-6 inline-block rounded-full bg-white px-6 py-3 font-bold text-night" href="/">Go to login</a>
      </div>
    </div>
  );
}
