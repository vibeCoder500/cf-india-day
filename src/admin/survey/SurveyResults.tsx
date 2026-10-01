import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Display } from '../../../shared/protocol';
import type { AdminSurvey, SurveyData, SurveyQuestion } from '../../../shared/survey';
import { SURVEY_FORMATS, SURVEY_GRACE_MS, SURVEY_TYPE_INFO, answerLabel, istDay } from '../../../shared/survey';
import { DISPLAY_LABELS } from '../../../shared/constants';
import { client, useGame } from '../../lib/client';
import Button from '../../components/Button';
import SurveyChart from './SurveyChart';
import { commentsOf, download, istTime, slug, surveyCsv, surveyJson, surveySummary } from './results';

type Copy = (text: string, what: string) => void;

// Results are pulled: once when opened, again whenever the survey's rev moves (at most every 2 s), and once more
// right after the closing grace period, when the sealed pool is revealed.
export function useSurveyData(s: AdminSurvey): SurveyData | null {
  const data = useGame((st) => st.surveyData);
  const lastAsk = useRef(0);
  const fresh = data?.sid === s.id && data.rev === s.rev;

  useEffect(() => {
    if (fresh) return;
    const t = setTimeout(() => {
      lastAsk.current = Date.now();
      client.send({ t: 'survey:data', id: s.id });
    }, Math.max(0, lastAsk.current + 2000 - Date.now()));
    return () => clearTimeout(t);
  }, [s.id, s.rev, fresh]);

  useEffect(() => {
    if (s.closesAt === null) return;
    const wait = s.closesAt + SURVEY_GRACE_MS + 1500 - (Date.now() + client.state.offset);
    if (wait <= 0 || wait > 2_000_000_000) return;
    const t = setTimeout(() => client.send({ t: 'survey:data', id: s.id }), wait);
    return () => clearTimeout(t);
  }, [s.id, s.closesAt]);

  return data?.sid === s.id ? data : null;
}

const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const hide = (s: AdminSurvey, rid: string, hidden: boolean) => client.send({ t: 'survey:hide', id: s.id, rid, hidden });

// The summary: KPIs, charts per question, comments and exports. Individual responses live in ResponseCarousel.
export default function SurveyResults({ s, live, closing, copy }: { s: AdminSurvey; live: boolean; closing: boolean; copy: Copy }) {
  const d = useSurveyData(s);
  const [formats, setFormats] = useState<Record<string, Display>>({});
  if (!d) return <p className="rounded-2xl bg-white/5 p-6 text-center opacity-80">Loading results… 📊</p>;

  const visible = d.released - d.hidden;
  const sealing = s.anonymous && s.k > 1;
  const maxDay = Math.max(1, ...d.perDay.map((p) => p.n));
  const file = `corpfun-survey-${slug(s.title)}-${istDay(Date.now())}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Responses" value={d.n} />
        <Kpi label="Visible" value={visible} />
        {sealing && <Kpi label="🔒 Sealed" value={d.sealed} />}
        <Kpi label="Hidden" value={d.hidden} />
      </div>

      {d.perDay.length > 0 && (
        <div className="flex items-end gap-2 overflow-x-auto rounded-2xl bg-white/5 p-3" aria-label="Responses per day (IST)">
          {d.perDay.map((p) => (
            <div key={p.day} className="flex min-w-10 flex-1 flex-col items-center gap-1">
              <span className="text-xs font-bold tabular-nums">{p.n}</span>
              <div className="w-full rounded-t bg-saffron" style={{ height: Math.max(4, Math.round((p.n / maxDay) * 64)) }} />
              <span className="text-[10px] whitespace-nowrap opacity-70">{dayLabel(p.day)}</span>
            </div>
          ))}
        </div>
      )}

      {closing && <Note tone="amber">⏳ Just closed — late answers still count for 2 minutes. Then everything is revealed.</Note>}
      {sealing && live && d.released === 0 && d.n > 0 && (
        <Note tone="sky">
          🔒 {d.n} received — results unlock at {2 * s.k} responses, so nobody can be identified by when they answered.
        </Note>
      )}
      {sealing && live && d.released > 0 && d.sealed > 0 && (
        <Note tone="sky">
          🔒 {d.sealed} more {d.sealed === 1 ? 'response is' : 'responses are'} sealed. They're revealed in random groups of {s.k}, and all together when
          the survey closes.
        </Note>
      )}
      {sealing && !live && !closing && d.sealed > 0 && (
        <Note tone="amber">
          🔒 {d.sealed} {d.sealed === 1 ? 'response stays' : 'responses stay'} sealed: fewer than {s.k} arrived after the last reveal, so showing them could
          point at the people who sent them.
        </Note>
      )}

      <div className="flex flex-wrap gap-2">
        <Button disabled={visible === 0} onClick={() => download(`${file}.csv`, surveyCsv(s, d), 'text/csv;charset=utf-8')}>
          ⬇ CSV
        </Button>
        <Button disabled={visible === 0} onClick={() => download(`${file}.json`, surveyJson(s, d), 'application/json')}>
          ⬇ JSON
        </Button>
        <Button disabled={visible === 0} onClick={() => copy(surveySummary(s, d), 'Summary')}>
          📋 Copy summary
        </Button>
        <Button variant="ghost" onClick={() => client.send({ t: 'survey:data', id: s.id })}>
          ↻ Refresh
        </Button>
      </div>

      {s.questions.map((q, i) => {
        const row = d.questions.find((x) => x.qid === q.id);
        if (!row) return null;
        const info = SURVEY_TYPE_INFO[q.type];
        const choices = SURVEY_FORMATS[q.type].filter((f) => f !== 'versus' || q.options.length === 2);
        const display = formats[q.id] ?? q.display;
        return (
          <section key={q.id} className="flex flex-col gap-3 rounded-2xl bg-white/5 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold opacity-80">
              <span>Q{i + 1}</span>
              <span>
                {info.icon} {info.label}
              </span>
              <span className="ml-auto font-normal">
                {row.answered} of {visible} answered
              </span>
            </div>
            <h4 className="text-lg leading-snug font-semibold">{q.text}</h4>
            {q.type === 'open' ? (
              <Comments s={s} q={q} d={d} copy={copy} />
            ) : (
              <>
                {choices.length > 1 && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chart">
                    {choices.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormats({ ...formats, [q.id]: f })}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold ${display === f ? 'bg-saffron text-night' : 'bg-white/10 hover:bg-white/20'}`}
                      >
                        {DISPLAY_LABELS[f]}
                      </button>
                    ))}
                  </div>
                )}
                <SurveyChart q={q} row={row} display={display} />
                {row.results.kind === 'scale' && row.results.total > 0 && (
                  <p className="text-sm opacity-80">
                    Average {row.results.avg} / {q.max}
                  </p>
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Every comment, newest-first for named surveys and shuffled for anonymous ones. Hiding hides that whole response.
function Comments({ s, q, d, copy }: { s: AdminSurvey; q: SurveyQuestion; d: SurveyData; copy: Copy }) {
  const [search, setSearch] = useState('');
  const all = commentsOf(q, d);
  const term = search.trim().toLowerCase();
  const list = term ? all.filter((c) => c.text.toLowerCase().includes(term)) : all;
  const shown = all.filter((c) => !c.hidden);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search comments…"
          aria-label="Search comments"
          className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-saffron"
        />
        <Button disabled={shown.length === 0} onClick={() => copy(shown.map((c) => c.text).join('\n\n'), 'Comments')}>
          📋 Copy all
        </Button>
      </div>
      {list.length === 0 ? (
        <p className="opacity-70">{all.length === 0 ? 'No comments yet.' : 'No matches.'}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((c) => (
            <li key={c.rid} className={`flex items-start gap-3 rounded-xl bg-black/20 p-3 ${c.hidden ? 'opacity-50' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="break-words whitespace-pre-wrap">{c.text}</p>
                {c.who && (
                  <p className="mt-1 text-xs opacity-70">
                    {c.who.avatar} {c.who.name}
                    {c.at !== null && ` · ${istTime(c.at)}`}
                  </p>
                )}
                {c.hidden && <p className="mt-1 text-xs font-bold text-amber-300">Hidden from results and exports</p>}
              </div>
              <Button
                variant={c.hidden ? 'secondary' : 'danger'}
                title="Hides this person's whole response from the results and exports"
                onClick={() => hide(s, c.rid, !c.hidden)}
              >
                {c.hidden ? 'Unhide' : 'Hide'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3 text-center">
      <p className="font-display text-3xl font-extrabold tabular-nums">{value.toLocaleString('en-IN')}</p>
      <p className="text-xs font-bold tracking-wide uppercase opacity-70">{label}</p>
    </div>
  );
}

function Note({ tone, children }: { tone: 'sky' | 'amber'; children: ReactNode }) {
  const style = tone === 'sky' ? 'bg-sky-500/15 ring-sky-400/40' : 'bg-amber-500/15 ring-amber-400/50';
  return <p className={`rounded-xl px-3 py-2 text-sm ring-1 ${style}`}>{children}</p>;
}
