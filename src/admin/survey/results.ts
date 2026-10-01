import type { Question, Results } from '../../../shared/protocol';
import type { AdminSurvey, SurveyData, SurveyQuestion } from '../../../shared/survey';
import { defaultQuestion } from '../../../shared/constants';
import { IST_MS, animalLabel, answerLabel } from '../../../shared/survey';

// The live game's charts (ResultView) take a game Question; survey questions map onto the closest game type.
export function asGameQuestion(q: SurveyQuestion): Question {
  const type = q.type === 'multi' || q.type === 'animal' ? 'poll' : q.type;
  return {
    ...defaultQuestion(type),
    id: q.id,
    text: q.text,
    options: q.type === 'animal' ? q.options.map(animalLabel) : q.options,
    min: q.min,
    max: q.max,
    minLabel: q.minLabel,
    maxLabel: q.maxLabel,
    display: q.display,
  };
}

// Net Promoter Score for 0–10 ratings: % of 9–10 minus % of 0–6.
export function nps(q: SurveyQuestion, r: Results): number | null {
  if (q.type !== 'scale' || q.min !== 0 || q.max !== 10 || r.kind !== 'scale' || r.total === 0) return null;
  const promoters = r.counts[9] + r.counts[10];
  const detractors = r.counts.slice(0, 7).reduce((a, b) => a + b, 0);
  return Math.round(((promoters - detractors) / r.total) * 100);
}

export const istTime = (ms: number) => `${new Date(ms + IST_MS).toISOString().slice(0, 16).replace('T', ' ')} IST`;

// Excel reads UTF-8 (emoji, Hindi) correctly with a BOM. Cells that look like formulas get a ' so they stay text.
const cell = (v: string) => {
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// One row per visible response. Anonymous surveys have no name or time columns, and rows are in random order.
export function surveyCsv(s: AdminSurvey, d: SurveyData): string {
  const head = ['Response', ...(s.anonymous ? [] : ['Name', 'Submitted']), ...s.questions.map((q, i) => `Q${i + 1}. ${q.text}`)];
  const rows = d.cards
    .filter((c) => !c.hidden)
    .map((c) => [
      c.id,
      ...(s.anonymous ? [] : [c.who?.name ?? '', c.at ? istTime(c.at) : '']),
      ...s.questions.map((q) => answerLabel(q, c.answers[q.id])),
    ]);
  return `\uFEFF${[head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}`;
}

const pct = (n: number, total: number) => `${total ? Math.round((n / total) * 100) : 0}%`;

// Plain text for pasting into Teams or an email. Comments are counted, never quoted.
export function surveySummary(s: AdminSurvey, d: SurveyData): string {
  const days = d.perDay.length ? ` · ${d.perDay[0].day} → ${d.perDay[d.perDay.length - 1].day}` : '';
  const shown = d.released - d.hidden;
  const out = [`📝 ${s.title}`, `${shown} responses${d.sealed ? ` (+${d.sealed} sealed for anonymity)` : ''}${days}`, ''];
  s.questions.forEach((q, i) => {
    const row = d.questions.find((x) => x.qid === q.id);
    if (!row) return;
    const r = row.results;
    let line = '';
    if (r.kind === 'choice') {
      const labels = q.type === 'animal' ? q.options.map(animalLabel) : q.options;
      line = labels
        .map((label, j) => ({ label, n: r.counts[j] ?? 0 }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 3)
        .filter((x) => x.n > 0)
        .map((x) => `${x.label} ${pct(x.n, r.total)}`)
        .join(' · ');
    } else if (r.kind === 'scale') {
      const score = nps(q, r);
      line = r.total ? `avg ${r.avg}/${q.max}${score === null ? '' : ` · NPS ${score > 0 ? '+' : ''}${score}`}` : '';
    } else if (r.kind === 'words') {
      line = r.words.slice(0, 5).map((w) => (w.count > 1 ? `${w.text} ×${w.count}` : w.text)).join(' · ');
    } else if (r.kind === 'texts') {
      line = `${row.answered} comment${row.answered === 1 ? '' : 's'} (read them in the app)`;
    }
    out.push(`${i + 1}. ${q.text}`, `   ${line || '—'}${row.answered && r.kind !== 'texts' ? `  (${row.answered} answered)` : ''}`);
  });
  return out.join('\n');
}

// Exports leave hidden responses out, like the charts. (The dashboard still lists them, dimmed, so they can be unhidden.)
export function surveyJson(s: AdminSurvey, d: SurveyData): string {
  return JSON.stringify({ survey: s, data: { ...d, cards: d.cards.filter((c) => !c.hidden) } }, null, 2);
}

// Every comment for an open question, with its response id (for Hide) and, in named surveys, who wrote it and when.
export function commentsOf(q: SurveyQuestion, d: SurveyData) {
  return d.cards.flatMap((c) => {
    const a = c.answers[q.id];
    return a && 'text' in a ? [{ rid: c.id, text: a.text, hidden: c.hidden, who: c.who, at: c.at }] : [];
  });
}

export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'survey';
