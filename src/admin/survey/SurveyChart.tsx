import type { Display } from '../../../shared/protocol';
import type { SurveyData, SurveyQuestion } from '../../../shared/survey';
import ResultView from '../../viz/ResultView';
import { asGameQuestion, nps } from './results';

// One question's chart in the host's results, drawn by the live game's visualisations.
export default function SurveyChart({ q, row, display }: { q: SurveyQuestion; row: SurveyData['questions'][number]; display: Display }) {
  const score = nps(q, row.results);
  return (
    <div className="flex flex-col gap-2">
      <ResultView q={asGameQuestion(q)} results={row.results} display={display} revealed size="sm" />
      {score !== null && <p className="text-sm font-bold">NPS {score > 0 ? `+${score}` : score}</p>}
    </div>
  );
}
