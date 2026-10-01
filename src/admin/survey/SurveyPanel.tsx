import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AdminSurvey, PublicSurvey, SurveyDraft } from '../../../shared/survey';
import { DAY_MS, SURVEY_GRACE_MS, SURVEY_LIMITS, endOfIstDay, surveyMinutes, surveyStatus } from '../../../shared/survey';
import { client, useGame } from '../../lib/client';
import { useServerNow } from '../../lib/hooks';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import SurveyForm from '../../survey/SurveyForm';
import { istDateTime, timeLeft } from '../../survey/time';
import LaunchDialog from './LaunchDialog';
import ResponseCarousel from './ResponseCarousel';
import SurveyBuilder from './SurveyBuilder';
import SurveyResults from './SurveyResults';
import SurveyShare from './SurveyShare';
import { SURVEY_TEMPLATES } from './templates';

type Status = 'draft' | 'live' | 'closing' | 'closed' | 'finalized';
type Pop = 'templates' | 'launch' | 'share' | 'preview' | null;
type View = 'setup' | 'responses' | 'summary';

// "closing" = the 2-minute grace after the deadline: late answers still count, Finalize and new launches wait.
function statusOf(s: AdminSurvey, now: number): Status {
  if (s.finalized) return 'finalized';
  const st = surveyStatus(s, now);
  if (st !== 'closed') return st;
  return now <= (s.closesAt ?? 0) + SURVEY_GRACE_MS ? 'closing' : 'closed';
}

// For the preview: a draft shows the deadline it would get if launched now with its saved settings.
const asPublic = (s: AdminSurvey, now: number): PublicSurvey => ({
  id: s.id, title: s.title, intro: s.intro, thanks: s.thanks, anonymous: s.anonymous, k: s.k,
  closesAt: s.closesAt ?? (s.endOfDay ? endOfIstDay(now + s.days * DAY_MS) : now + s.days * DAY_MS), questions: s.questions,
});

const modeText = (s: AdminSurvey) => `🕶️ Anonymous${s.k > 1 ? ` · groups of ${s.k}` : ''}`;

function Badge({ s, now }: { s: AdminSurvey; now: number }) {
  const st = statusOf(s, now);
  const [text, style] =
    st === 'draft'
      ? ['📝 Draft', 'bg-white/15']
      : st === 'live'
        ? [`🟢 Live · ${timeLeft((s.closesAt ?? now) - now)} left`, 'bg-green-500/20 text-green-200']
        : st === 'closing'
          ? ['⏳ Closing…', 'bg-amber-500/20 text-amber-200']
          : st === 'closed'
            ? ['🔒 Closed', 'bg-white/15']
            : ['🗄️ Finalized', 'bg-white/10 opacity-80'];
  return <span className={`rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${style}`}>{text}</span>;
}

export default function SurveyPanel() {
  const surveys = useGame((st) => st.surveys);
  const now = useServerNow(5_000);
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<View>('setup');
  const [pop, setPop] = useState<Pop>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const creating = useRef<{ count: number; at: number } | null>(null); // open the survey the server is about to add

  useEffect(() => {
    const c = creating.current;
    if (!c || !surveys || surveys.length <= c.count) return;
    creating.current = null;
    if (Date.now() - c.at > 10_000) return;
    setOpenId(surveys[surveys.length - 1].id);
    setView('setup');
  }, [surveys]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2000);
    return () => clearTimeout(id);
  }, [notice]);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied ✓`);
    } catch {
      prompt(`Copy the ${what.toLowerCase()}:`, text); // the clipboard needs HTTPS
    }
  };

  if (!surveys) return <p className="rounded-2xl bg-white/5 p-6 text-center opacity-80">Loading surveys… 📝</p>;

  const s = openId ? surveys.find((x) => x.id === openId) : undefined;
  const expect = () => {
    creating.current = { count: surveys.length, at: Date.now() };
  };
  const create = (draft: SurveyDraft) => {
    if (surveys.length >= SURVEY_LIMITS.surveys) return alert(`Up to ${SURVEY_LIMITS.surveys} surveys — delete an old one first.`);
    expect();
    client.send({ t: 'survey:save', survey: { ...draft, id: '' } });
  };
  const newSurvey = () => {
    const title = prompt('Survey title (for example "Townhall feedback")')?.trim();
    if (title) create({ id: '', title, intro: '', thanks: '', questions: [] });
  };
  const open = (id: string, v: View = 'setup', p: Pop = null) => {
    setOpenId(id);
    setView(v);
    setPop(p);
  };

  // Actions shared by the list and the detail view.
  const act = {
    duplicate: (x: AdminSurvey) => {
      if (surveys.length >= SURVEY_LIMITS.surveys) return alert(`Up to ${SURVEY_LIMITS.surveys} surveys — delete an old one first.`);
      expect();
      client.send({ t: 'survey:duplicate', id: x.id });
    },
    remove: (x: AdminSurvey) => {
      const ok =
        x.n === 0
          ? confirm(`Delete “${x.title}”?`)
          : prompt(`Type DELETE to delete “${x.title}” and its ${x.n} response(s)`) === 'DELETE';
      if (!ok) return;
      client.send({ t: 'survey:delete', id: x.id });
      if (openId === x.id) setOpenId(null);
    },
    close: (x: AdminSurvey) =>
      confirm(`Close “${x.title}” now? Phones stop showing it. Answers already being typed still count for 2 minutes.`) &&
      client.send({ t: 'survey:close', id: x.id }),
    finalize: (x: AdminSurvey) =>
      confirm(
        `Finalize “${x.title}”? This permanently erases the fingerprints that stop double responses: nobody can respond again and it can't be reopened. The results stay.`,
      ) && client.send({ t: 'survey:finalize', id: x.id }),
    extend: (x: AdminSurvey, label: string) => {
      const v = Number(prompt(`${label} by how many days? (1–${SURVEY_LIMITS.days})`, '1'));
      if (Number.isInteger(v) && v >= 1 && v <= SURVEY_LIMITS.days) client.send({ t: 'survey:extend', id: x.id, days: v });
    },
    clear: (x: AdminSurvey) =>
      prompt(`Type CLEAR to delete all ${x.n} response(s) of “${x.title}” (for test runs). Everyone can respond again.`) === 'CLEAR' &&
      client.send({ t: 'survey:reset', id: x.id }),
  };

  const listActions = (x: AdminSurvey): ReactNode => {
    switch (statusOf(x, now)) {
      case 'draft':
        return (
          <>
            <Button onClick={() => open(x.id)}>✏️ Edit</Button>
            <Button disabled={x.questions.length === 0} onClick={() => open(x.id, 'setup', 'preview')}>
              👀 Preview
            </Button>
            <Button variant="primary" disabled={x.questions.length === 0} onClick={() => open(x.id, 'setup', 'launch')}>
              🚀 Launch…
            </Button>
            <Button onClick={() => act.duplicate(x)}>⧉ Duplicate</Button>
            <Button variant="danger" onClick={() => act.remove(x)}>
              🗑
            </Button>
          </>
        );
      case 'live':
        return (
          <>
            <Button variant="primary" onClick={() => open(x.id, 'responses')}>
              🃏 Responses
            </Button>
            <Button onClick={() => open(x.id)}>⚙️ Manage</Button>
            <Button onClick={() => open(x.id, 'setup', 'share')}>🔗 Share</Button>
            <Button variant="danger" onClick={() => act.close(x)}>
              ⏹ Close now
            </Button>
          </>
        );
      case 'closing':
        return (
          <Button variant="primary" onClick={() => open(x.id, 'responses')}>
            🃏 Responses
          </Button>
        );
      case 'closed':
        return (
          <>
            <Button variant="primary" onClick={() => open(x.id, 'responses')}>
              🃏 Responses
            </Button>
            <Button onClick={() => act.extend(x, 'Reopen')}>🔁 Reopen…</Button>
            <Button onClick={() => act.finalize(x)}>🔐 Finalize</Button>
            <Button onClick={() => act.duplicate(x)}>⧉ Duplicate</Button>
            <Button variant="danger" onClick={() => act.remove(x)}>
              🗑
            </Button>
          </>
        );
      case 'finalized':
        return (
          <>
            <Button variant="primary" onClick={() => open(x.id, 'responses')}>
              🃏 Responses
            </Button>
            <Button onClick={() => act.duplicate(x)}>⧉ Duplicate</Button>
            <Button variant="danger" onClick={() => act.remove(x)}>
              🗑
            </Button>
          </>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!s ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-display text-2xl font-bold">📝 Surveys</h2>
            <Button variant="primary" onClick={newSurvey}>
              ＋ New survey
            </Button>
            <Button onClick={() => setPop('templates')}>📚 Templates</Button>
          </div>
          <p className="-mt-2 text-sm opacity-70">Launch a survey once: people answer at /survey whenever they like, until it closes. No logins, no names.</p>
          {surveys.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/5 p-8 text-center">
              <p className="text-lg opacity-80">No surveys yet</p>
              <Button big variant="primary" onClick={() => create(SURVEY_TEMPLATES[0])}>
                Start with “{SURVEY_TEMPLATES[0].title}”
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {[...surveys].reverse().map((x) => (
                <li key={x.id} className="flex flex-col gap-3 rounded-2xl bg-white/5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="min-w-0 flex-1 text-left font-display text-lg font-bold hover:underline" onClick={() => open(x.id)}>
                      {x.title}
                    </button>
                    <Badge s={x} now={now} />
                  </div>
                  <p className="text-sm opacity-80">
                    {x.questions.length} questions · {x.n} {x.n === 1 ? 'response' : 'responses'}
                    {x.opensAt !== null && ` · ${modeText(x)}`}
                  </p>
                  <div className="flex flex-wrap gap-2">{listActions(x)}</div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <Detail s={s} now={now} view={view} setView={setView} onBack={() => setOpenId(null)} onPop={setPop} act={act} copy={copy} />
      )}

      {pop === 'templates' && (
        <Modal title="Survey templates" onClose={() => setPop(null)} wide>
          <div className="flex flex-col gap-3">
            {SURVEY_TEMPLATES.map((t) => (
              <div key={t.title} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/5 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold">{t.title}</p>
                  <p className="text-sm opacity-80">
                    {t.questions.length} questions · about {surveyMinutes(t.questions)} min
                  </p>
                  <p className="mt-1 text-sm opacity-70">{t.intro}</p>
                </div>
                <Button
                  variant="primary"
                  onClick={() => {
                    create(t);
                    setPop(null);
                  }}
                >
                  Use this
                </Button>
              </div>
            ))}
            <p className="text-xs opacity-60">A template becomes a draft you can edit before launching.</p>
          </div>
        </Modal>
      )}
      {s && pop === 'preview' && (
        <Modal title="Preview on a phone" onClose={() => setPop(null)} wide>
          <div className="mx-auto h-[min(640px,72vh)] w-full max-w-sm overflow-y-auto rounded-[2rem] bg-night p-4 ring-4 ring-white/15">
            <SurveyForm preview survey={asPublic(s, now)} onSubmit={() => undefined} onExit={() => setPop(null)} />
          </div>
        </Modal>
      )}
      {s && pop === 'launch' && <LaunchDialog s={s} onClose={() => setPop(null)} onLaunched={() => setPop('share')} />}
      {s && pop === 'share' && <SurveyShare s={s} copy={copy} onClose={() => setPop(null)} />}
      {notice && (
        <div role="status" className="animate-pop fixed inset-x-4 bottom-24 z-50 mx-auto max-w-xs rounded-2xl bg-white px-4 py-3 text-center font-bold text-night shadow-2xl">
          {notice}
        </div>
      )}
    </div>
  );
}

type Actions = {
  duplicate: (x: AdminSurvey) => void;
  remove: (x: AdminSurvey) => void;
  close: (x: AdminSurvey) => unknown;
  finalize: (x: AdminSurvey) => unknown;
  extend: (x: AdminSurvey, label: string) => void;
  clear: (x: AdminSurvey) => unknown;
};

function Detail({
  s,
  now,
  view,
  setView,
  onBack,
  onPop,
  act,
  copy,
}: {
  s: AdminSurvey;
  now: number;
  view: View;
  setView: (v: View) => void;
  onBack: () => void;
  onPop: (p: Pop) => void;
  act: Actions;
  copy: (text: string, what: string) => void;
}) {
  const st = statusOf(s, now);
  const launched = s.opensAt !== null;
  const tab = (v: View, label: string) => (
    <button
      type="button"
      onClick={() => setView(v)}
      className={`rounded-xl px-4 py-2 text-sm font-bold ${view === v ? 'bg-saffron text-night' : 'bg-white/10 hover:bg-white/20'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onBack}>
          ◀ All surveys
        </Button>
        <Badge s={s} now={now} />
      </div>
      <h2 className="font-display text-2xl leading-tight font-bold">{s.title}</h2>
      {launched && (
        <nav className="flex gap-2" aria-label="Survey sections">
          {tab('responses', '🃏 Responses')}
          {tab('summary', '📊 Summary')}
          {tab('setup', '⚙️ Manage')}
        </nav>
      )}

      {launched && view === 'responses' ? (
        <ResponseCarousel s={s} live={st === 'live'} />
      ) : launched && view === 'summary' ? (
        <SurveyResults s={s} live={st === 'live'} closing={st === 'closing'} copy={copy} />
      ) : (
        <>
          {launched ? (
            <section className="flex flex-col gap-3 rounded-2xl bg-white/5 p-4">
              <p className="font-semibold">
                {st === 'live' && `🟢 Live · closes ${istDateTime(s.closesAt ?? now)} · in ${timeLeft((s.closesAt ?? now) - now)}`}
                {st === 'closing' && '⏳ Just closed — late answers still count for 2 minutes.'}
                {st === 'closed' && `🔒 Closed ${istDateTime(s.closesAt ?? now)}. Fingerprints are erased 7 days after closing, or now with Finalize.`}
                {st === 'finalized' && '🗄️ Finalized: fingerprints erased, results kept. It can no longer be reopened.'}
              </p>
              <p className="text-sm opacity-80">
                {modeText(s)} · {s.n} {s.n === 1 ? 'response' : 'responses'}
                {s.pending > 0 && ` (${s.pending} sealed)`}
              </p>
              <div className="flex flex-wrap gap-2">
                {st === 'live' && (
                  <>
                    <Button onClick={() => onPop('share')}>🔗 Share</Button>
                    <Button onClick={() => client.send({ t: 'survey:extend', id: s.id, days: 1 })}>+1 day</Button>
                    <Button onClick={() => client.send({ t: 'survey:extend', id: s.id, days: 3 })}>+3 days</Button>
                    <Button onClick={() => act.extend(s, 'Extend')}>+N days…</Button>
                    <Button variant="danger" onClick={() => act.close(s)}>
                      ⏹ Close now
                    </Button>
                  </>
                )}
                {st === 'closed' && (
                  <>
                    <Button onClick={() => act.extend(s, 'Reopen')}>🔁 Reopen…</Button>
                    <Button onClick={() => act.finalize(s)}>🔐 Finalize</Button>
                  </>
                )}
                <Button onClick={() => onPop('preview')}>👀 Preview</Button>
                <Button onClick={() => act.duplicate(s)}>⧉ Duplicate</Button>
                {s.n > 0 && st !== 'finalized' && (
                  <Button variant="danger" onClick={() => act.clear(s)}>
                    🧹 Clear responses
                  </Button>
                )}
                {(st === 'closed' || st === 'finalized') && (
                  <Button variant="danger" onClick={() => act.remove(s)}>
                    🗑 Delete
                  </Button>
                )}
              </div>
            </section>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button disabled={s.questions.length === 0} onClick={() => onPop('preview')}>
                👀 Preview
              </Button>
              <Button variant="primary" disabled={s.questions.length === 0} onClick={() => onPop('launch')}>
                🚀 Launch…
              </Button>
              <Button onClick={() => act.duplicate(s)}>⧉ Duplicate</Button>
              <Button variant="danger" onClick={() => act.remove(s)}>
                🗑 Delete
              </Button>
            </div>
          )}
          <SurveyBuilder s={s} />
        </>
      )}
    </div>
  );
}
