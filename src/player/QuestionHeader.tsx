import type { Question } from '../../shared/protocol';
import { TYPE_INFO } from '../../shared/constants';

export default function QuestionHeader({ q }: { q: Question }) {
  const info = TYPE_INFO[q.type];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 text-sm font-bold">
        <span className="rounded-full bg-saffron/20 px-3 py-1 text-saffron">
          {info.icon} {info.label}
        </span>
      </div>
      <h2 className="text-2xl leading-snug font-bold">{q.text}</h2>
      <p className="opacity-70">{info.hint}</p>
    </div>
  );
}
