import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { client, useGame } from '../lib/client';
import Button from '../components/Button';
import ConnectionBanner from '../components/ConnectionBanner';
import MadeWith from '../components/MadeWith';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import DangerZone from './DangerZone';
import ImportExport from './ImportExport';
import LivePanel from './LivePanel';
import PeoplePanel from './PeoplePanel';
import QuestionList from './QuestionList';
import SurveyPanel, { LiveSurveyChip } from './survey/SurveyPanel';

type Tab = 'live' | 'questions' | 'people' | 'survey' | 'more';
const TABS: { id: Tab; label: string }[] = [
  { id: 'live', label: '🎛️ Live' },
  { id: 'questions', label: '❓ Questions' },
  { id: 'people', label: '👥 People' },
  { id: 'survey', label: '📝 Survey' },
  { id: 'more', label: '⚙️ More' },
];

export default function AdminApp() {
  const admin = useGame((s) => s.admin);
  const name = useGame((s) => s.session?.name ?? 'Host');
  const open = useGame((s) => s.status === 'open');
  const [tab, setTab] = useState<Tab>('live');
  const [qr, setQr] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null); // event shown in the Questions tab
  // Laptop: Live is always the left column, so the right column shows the other tabs.
  const right = tab === 'live' ? 'questions' : tab;

  useEffect(() => client.onCelebrate(() => setNotice('🎉 Celebration sent to the big screen')), []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2000);
    return () => clearTimeout(id);
  }, [notice]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.origin);
      setNotice('Copied ✓');
    } catch {
      prompt('Copy the join link:', location.origin); // clipboard needs HTTPS
    }
  };

  if (!admin) return <div className="grid min-h-dvh place-items-center text-2xl">Connecting to the game… 🎤</div>;

  const eventId = picked && admin.events.some((e) => e.id === picked) ? picked : (admin.game.eventId ?? admin.events[0]?.id ?? '');
  const eventName = admin.events.find((e) => e.id === eventId)?.name ?? '';

  return (
    <div className="flex min-h-dvh flex-col">
      <ConnectionBanner />
      <header className="sticky top-0 z-20 border-b border-white/10 bg-night/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <h1 className="font-display text-xl font-extrabold">🎤 Host console · {name}</h1>
          <p className="text-sm opacity-80">
            🟢 {admin.online} online · {admin.total} joined
          </p>
          <LiveSurveyChip onOpen={() => setTab('survey')} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Its own window, so it can be shared in the meeting or dragged to the projector while this tab stays private. */}
            <Button onClick={() => window.open('/present', 'cfid-present', 'popup,width=1280,height=720')}>Open presenter ↗</Button>
            <Button onClick={copyLink}>Copy join link</Button>
            <Button onClick={() => setQr(true)}>QR</Button>
            <span className={`size-2.5 rounded-full ${open ? 'bg-green-400' : 'bg-amber-400'}`} title={open ? 'Connected' : 'Reconnecting'} />
            <Button variant="ghost" onClick={() => confirm('Log out of the host console on this device?') && client.leave()}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 lg:grid lg:grid-cols-2 lg:gap-6">
        <section className={tab === 'live' ? '' : 'hidden lg:block'}>
          <LivePanel admin={admin} />
        </section>
        <section className={tab === 'live' ? 'hidden lg:block' : ''}>
          <nav className="mb-4 hidden gap-2 lg:flex" aria-label="Sections">
            {TABS.slice(1).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-xl px-4 py-2 text-sm font-bold ${right === t.id ? 'bg-saffron text-night' : 'bg-white/10 hover:bg-white/20'}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          {right === 'questions' && <QuestionList admin={admin} eventId={eventId} onSelectEvent={setPicked} />}
          {right === 'people' && <PeoplePanel players={admin.players} />}
          {right === 'survey' && <SurveyPanel admin={admin} />}
          {right === 'more' && (
            <div className="flex flex-col gap-4">
              <section className="rounded-2xl bg-white/5 p-4">
                <h3 className="font-display text-xl font-bold">💾 Questions backup · {eventName}</h3>
                <p className="mt-1 mb-3 text-sm opacity-70">
                  Exports or imports the questions of “{eventName}” (pick the event in the Questions tab). Export before the event; import restores them.
                </p>
                <div className="flex flex-wrap gap-2">
                  <ImportExport questions={admin.questions.filter((q) => q.eventId === eventId)} eventId={eventId} eventName={eventName} />
                </div>
              </section>
              <DangerZone />
            </div>
          )}
        </section>
      </div>

      {/* On phones the bottom padding keeps it clear of the fixed tab bar. */}
      <MadeWith className="pt-6 pb-[calc(3.5rem_+_env(safe-area-inset-bottom))] lg:pb-4" />

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/10 bg-night/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`py-3 text-xs font-bold ${tab === t.id ? 'text-saffron' : 'opacity-70'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {qr && (
        <Modal title="Scan to join" onClose={() => setQr(false)}>
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-2xl bg-white p-4">
              <QRCodeSVG value={location.origin} size={320} marginSize={0} />
            </div>
            <p className="font-mono text-lg font-bold">{location.host}</p>
          </div>
        </Modal>
      )}
      {notice && (
        <div role="status" className="animate-pop fixed inset-x-4 bottom-24 z-50 mx-auto max-w-xs rounded-2xl bg-white px-4 py-3 text-center font-bold text-night shadow-2xl">
          {notice}
        </div>
      )}
      <Toast />
    </div>
  );
}
