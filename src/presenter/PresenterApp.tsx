import { useEffect, useState } from 'react';
import { client, useGame } from '../lib/client';
import CornerQR from '../components/CornerQR';
import DrawOverlay from '../components/DrawOverlay';
import MadeWith from '../components/MadeWith';
import Celebration from './Celebration';
import FloatingReactions from './FloatingReactions';
import LeaderboardScreen from './LeaderboardScreen';
import LobbyScreen from './LobbyScreen';
import PhotoBomb from './PhotoBomb';
import PodiumScreen from './PodiumScreen';
import QuestionScreen from './QuestionScreen';
import ResultsScreen from './ResultsScreen';

const PRESENTED_KEY = 'cfid.presented';

// The celebration plays once when this tab first opens (not on reloads), and again whenever the host asks.
function firstOpen() {
  try {
    return sessionStorage.getItem(PRESENTED_KEY) !== '1';
  } catch {
    return true;
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => {});
}

// Read-only big screen: it never sends messages and never shows moderation data.
export default function PresenterApp() {
  const admin = useGame((s) => s.admin);
  const [idle, setIdle] = useState(false);
  const [party, setParty] = useState<number | null>(() => (firstOpen() ? Date.now() : null));

  useEffect(() => client.onCelebrate(() => setParty(Date.now())), []);

  const endParty = () => {
    try {
      sessionStorage.setItem(PRESENTED_KEY, '1');
    } catch {
      // ignore
    }
    setParty(null);
  };

  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), 3000);
    const onMove = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 3000);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) toggleFullscreen();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!admin) return <div className="grid min-h-dvh place-items-center text-3xl">Connecting to the game… ✨</div>;

  const { game } = admin;
  const q = admin.questions.find((x) => x.id === game.qid) ?? null;
  const lobby = game.phase === 'lobby' || ((game.phase === 'question' || game.phase === 'results') && !q);

  return (
    <div className={`relative flex h-dvh flex-col overflow-hidden ${idle ? 'cursor-none' : ''}`}>
      <div className="splash-bg pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative min-h-0 flex-1">
        {lobby ? (
          <LobbyScreen admin={admin} />
        ) : game.phase === 'leaderboard' ? (
          <LeaderboardScreen top={admin.top} />
        ) : game.phase === 'podium' ? (
          <PodiumScreen top={admin.top} />
        ) : game.phase === 'question' && q ? (
          <QuestionScreen admin={admin} q={q} />
        ) : (
          q && <ResultsScreen admin={admin} q={q} />
        )}
      </div>
      <MadeWith big className="py-[0.6vh]" />
      {!lobby && <CornerQR />}
      <div className="fixed bottom-4 left-4 z-30 rounded-full bg-black/40 px-4 py-2 text-[clamp(1rem,1.4vw,1.5rem)] font-bold">
        🟢 {admin.online} online
      </div>
      <FloatingReactions />
      {party !== null && (
        <Celebration
          key={party}
          next={lobby ? 'Show the join QR 📲' : game.phase === 'podium' ? 'Back to the podium 🏆' : 'Back to the game 🎮'}
          onDone={endParty}
        />
      )}
      {game.phase !== 'question' && <PhotoBomb />}
      <DrawOverlay draw={game.draw} variant="screen" />
      {!idle && (
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Toggle fullscreen"
          title="Fullscreen (F)"
          className="fixed top-4 right-4 z-[60] rounded-full bg-white/10 px-4 py-2 text-2xl hover:bg-white/20"
        >
          ⛶
        </button>
      )}
    </div>
  );
}
