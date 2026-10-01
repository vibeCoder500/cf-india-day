import type { ReactNode } from 'react';
import type { Display, Question, Results } from '../../shared/protocol';
import { FORMATS } from '../../shared/constants';
import { choiceItems, numberBins, scaleItems, wordItems } from './adapters';
import type { Size } from './adapters';
import Average from './Average';
import Bars from './Bars';
import Bubbles from './Bubbles';
import Closest from './Closest';
import Cloud from './Cloud';
import Columns from './Columns';
import Donut from './Donut';
import Dots from './Dots';
import Fit from './Fit';
import Gauge from './Gauge';
import Spotlight from './Spotlight';
import SpiritBubbles from './SpiritBubbles';
import Versus from './Versus';
import Wall from './Wall';

interface Props {
  q: Question;
  results: Results;
  display: Display;
  revealed?: boolean;
  size: Size;
}

export default function ResultView({ q, results, display, revealed = false, size }: Props) {
  const formats = FORMATS[q.type];
  let d = formats.includes(display) ? display : formats[0];
  if (d === 'versus' && q.options.length !== 2) d = formats[0];

  if (results.total === 0) {
    return (
      <div className={`grid place-items-center text-center opacity-80 ${size === 'lg' ? 'h-full' : 'min-h-32'}`}>
        <p className={size === 'lg' ? 'font-display text-[clamp(2rem,4vw,4rem)] font-bold' : 'text-lg'}>Waiting for answers… ⏳</p>
      </div>
    );
  }

  switch (results.kind) {
    case 'choice': {
      const items = choiceItems(q, results, revealed);
      let chart: ReactNode;
      if (d === 'columns') chart = <Columns items={items} size={size} shapes />;
      else if (d === 'donut') chart = <Donut items={items} total={results.total} size={size} />;
      else if (d === 'bubbles') chart = <Bubbles items={items} size={size} labelsBelow />;
      else if (d === 'versus') chart = <Versus items={items} total={results.total} size={size} />;
      else chart = <Bars items={items} total={results.total} size={size} shapes />;
      return size === 'lg' ? <Fit watch={`${d}|${revealed}|${q.options.join('\n')}`}>{chart}</Fit> : chart;
    }
    case 'words': {
      const items = wordItems(results);
      if (d === 'bubbles') return <Bubbles items={items.slice(0, 30)} size={size} />;
      if (d === 'list') return <Bars items={items.slice(0, 15)} total={results.total} size={size} />;
      return <Cloud items={items} size={size} />;
    }
    case 'texts':
      return d === 'spotlight' ? (
        <Spotlight items={results.items} total={results.total} size={size} />
      ) : (
        <Wall items={results.items} size={size} />
      );
    case 'scale':
      if (d === 'gauge') return <Gauge q={q} avg={results.avg} total={results.total} size={size} />;
      if (d === 'average') return <Average q={q} results={results} size={size} />;
      return <Columns items={scaleItems(q, results)} size={size} />;
    case 'numbers':
      if (d === 'histogram') return <Columns items={numberBins(q, results)} size={size} />;
      if (d === 'closest') return <Closest q={q} results={results} revealed={revealed} size={size} />;
      return <Dots q={q} results={results} revealed={revealed} size={size} />;
    case 'animals':
      return <SpiritBubbles q={q} picks={results.picks} size={size} />;
  }
}
