import { lazy, Suspense, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { SURVEY_ROUTE } from '../lib/client';
import Zoomies from '../components/Zoomies';
import SurveyRespond from './SurveyRespond';

const SurveyStudio = lazy(() => import('./SurveyStudio')); // respondents never download the studio

// Slow-drifting colour orbs behind frosted glass (CSS custom properties: colour, drift and duration).
const ORBS: Record<string, string>[] = [
  { '--c': '#ff3cac', top: '-14%', left: '-12%', '--x': '14vmax', '--y': '10vmax', '--d': '19s' },
  { '--c': '#784ba0', top: '30%', right: '-18%', '--x': '-16vmax', '--y': '-8vmax', '--d': '23s' },
  { '--c': '#2b86c5', bottom: '-20%', left: '8%', '--x': '12vmax', '--y': '-12vmax', '--d': '27s' },
  { '--c': '#ff9933', top: '8%', left: '42%', '--x': '-10vmax', '--y': '14vmax', '--d': '31s' },
];

// The survey site: /survey (anyone answers, no login) and /surveyAdmin (hosts run surveys). No game, no presenter.
export default function SurveySite() {
  const studio = SURVEY_ROUTE === 'admin';
  useEffect(() => {
    document.title = studio ? 'Survey studio · CorpFun Day' : 'Feedback · CorpFun Day 📝';
  }, [studio]);
  return (
    <div className="survey-site">
      <div className="glass-bg" aria-hidden>
        {ORBS.map((style, i) => (
          <span key={i} className="glass-orb" style={style as CSSProperties} />
        ))}
      </div>
      <div className="relative z-[1]">
        {studio ? (
          <Suspense fallback={<p className="grid min-h-dvh place-items-center text-xl">Loading the studio… ✨</p>}>
            <SurveyStudio />
          </Suspense>
        ) : (
          <SurveyRespond />
        )}
      </div>
      {/* The leaders' caricatures pop in, dash past or zoom up close every 15–30 s, with their sounds. */}
      <Zoomies minGapMs={15_000} maxGapMs={30_000} pops />
    </div>
  );
}
