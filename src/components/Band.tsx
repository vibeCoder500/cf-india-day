import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BEAT_MS, nextBeatAt, onMusicChange } from '../lib/music';
import Caricature, { Arm, INK, Limb, headsReady, pivot, star } from './Caricature';
import type { Person } from './Caricature';

const WOOD = '#7a4a26';

function Guitar() {
  return (
    <>
      <g transform="translate(64 123) rotate(32)">
        <rect x={-52} y={-3.2} width={42} height={6.4} rx={1.5} fill="#3a2a20" />
        <rect x={-59} y={-5.5} width={9} height={11} rx={2.5} fill="#1f1f26" />
        {/* Outlined bouts first, then plain ones on top, so the two circles read as one body. */}
        <g fill="#e63946">
          <circle cx={-7} r={9.5} />
          <circle cx={7} r={12} />
          <circle cx={-7} r={9.5} stroke="none" />
          <circle cx={7} r={12} stroke="none" />
        </g>
        <path d="M-4 4Q4 11 13 5Q8 0 2 2Z" fill="#fff" stroke="none" opacity={0.9} />
        <rect x={-1} y={-4} width={3} height={8} rx={1} fill="#cfd6dd" strokeWidth={1.2} />
        <rect x={9.5} y={-5} width={3} height={10} rx={1} fill="#1f1f26" strokeWidth={1.2} />
        <path d="M-57-1.6H11M-57 1.6H11" stroke="#fff6dd" strokeWidth={0.7} />
      </g>
      <Arm who="rockstar" from={[40, 108]} to={[31, 102]} />
      <Arm who="rockstar" className="band-strum" style={pivot(80, 108)} from={[80, 108]} to={[69, 120]} />
    </>
  );
}

// The chef drums on a cooking pot with two wooden spoons.
function Pot() {
  const spoon = (x1: number, y1: number, x2: number, y2: number) => (
    <>
      <Limb d={`M${x1} ${y1}L${x2} ${y2}`} color={WOOD} width={2.6} />
      <ellipse cx={x2 + (x2 - x1) * 0.18} cy={y2 + (y2 - y1) * 0.18} rx={3.2} ry={4.2} fill={WOOD} strokeWidth={1.8} />
    </>
  );
  return (
    <>
      <path d="M33 116L36 139Q60 145 84 139L87 116Z" fill="#c9d1d9" />
      <path d="M38 121L40 136" fill="none" stroke="#fff" strokeWidth={2} opacity={0.7} />
      <path d="M33 120q-7 0 -7 4.5q0 4.5 7 4.5M87 120q7 0 7 4.5q0 4.5 -7 4.5" fill="none" strokeWidth={2.6} />
      <ellipse cx={60} cy={116} rx={27} ry={5.5} fill="#6b7785" />
      <ellipse cx={60} cy={117} rx={22} ry={3.2} fill="#4a5361" stroke="none" />
      {/* A heavy spoon on one side and a light one on the other, like a real drummer's left and right. */}
      <g className="band-stick-l" style={pivot(40, 108)}>
        {spoon(23, 102, 29, 113)}
        <Arm who="chef" from={[40, 108]} to={[23, 102]} />
      </g>
      <g className="band-stick-r" style={pivot(80, 108)}>
        {spoon(97, 102, 91, 113)}
        <Arm who="chef" from={[80, 108]} to={[97, 102]} />
      </g>
    </>
  );
}

function Keys() {
  const gaps = Array.from({ length: 11 }, (_, i) => 25 + i * 7);
  return (
    <>
      <path d="M36 150L84 128M84 150L36 128" stroke="#4a4e69" strokeWidth={3.5} />
      <rect x={14} y={118} width={92} height={19} rx={3.5} fill="#2d3047" />
      <rect x={18} y={125} width={84} height={9.5} fill="#fff" stroke="none" />
      <path d={gaps.map((x) => `M${x} 125v9.5`).join('')} stroke="#b9bdc9" strokeWidth={0.8} />
      <g fill={INK} stroke="none">
        {[0, 1, 3, 4, 5, 7, 8, 10].map((i) => (
          <rect key={i} x={gaps[i] - 2} y={125} width={4} height={6} rx={0.6} />
        ))}
      </g>
      <g fill="#ffd23f" stroke="none">
        <circle cx={21} cy={121.5} r={1.5} />
        <circle cx={26} cy={121.5} r={1.5} />
      </g>
      <rect x={44} y={119.8} width={32} height={3.6} rx={1} fill="#7df9ff" stroke="none" opacity={0.85} />
      <Arm who="hero" className="band-key-l" from={[40, 108]} to={[46, 123]} />
      <Arm who="hero" className="band-key-r" from={[80, 108]} to={[74, 123]} />
    </>
  );
}

function Maracas() {
  const maraca = (x: number, tilt: number) => (
    <g transform={`rotate(${tilt} ${x} 80)`}>
      <ellipse cx={x} cy={80} rx={7} ry={9} fill="#ffd23f" />
      <path d={`M${x - 6.5} 79q6.5 5 13 0`} fill="none" stroke="#e63946" strokeWidth={2.4} />
    </g>
  );
  return (
    <>
      <g className="band-shake-l" style={pivot(40, 108)}>
        <Limb d="M24 99L17 88" color={WOOD} width={3} />
        {maraca(13.5, -30)}
        <Arm who="viking" from={[40, 108]} to={[25, 100]} />
      </g>
      <g className="band-shake-r" style={pivot(80, 108)}>
        <Limb d="M96 99L103 88" color={WOOD} width={3} />
        {maraca(106.5, 30)}
        <Arm who="viking" from={[80, 108]} to={[95, 100]} />
      </g>
    </>
  );
}

// The wizard conducts the band with a star-tipped wand.
function Wand() {
  return (
    <>
      <Arm who="wizard" className="band-wave" style={pivot(40, 108)} from={[40, 108]} to={[27, 97]} />
      <g className="band-conduct" style={pivot(80, 108)}>
        <Limb d="M94 97L107 79" color="#5a3a1e" width={2.4} />
        <path d={star(108, 77, 6)} fill="#ffd23f" strokeWidth={1.6} />
        <Arm who="wizard" from={[80, 108]} to={[94, 97]} />
      </g>
    </>
  );
}

// The captain's sea-shanty squeezebox: the ends push in and out, the bellows fold with them.
function Accordion() {
  return (
    <>
      <g className="band-bellows" style={pivot(60, 123)}>
        <rect x={38} y={112} width={44} height={22} fill="#e63946" />
        <path d="M43 112v22M48.5 112v22M54 112v22M60 112v22M66 112v22M71.5 112v22M77 112v22" stroke="#7a1d25" strokeWidth={1.4} />
      </g>
      <g className="band-squeeze-l">
        <rect x={27} y={110} width={13} height={26} rx={2.5} fill="#1d1d25" />
        <g fill="#fff" stroke="none">
          {[115, 120, 125, 130].map((y) => (
            <circle key={y} cx={33.5} cy={y} r={1.6} />
          ))}
        </g>
        <Arm who="captain" from={[40, 108]} to={[31, 116]} />
      </g>
      <g className="band-squeeze-r">
        <rect x={80} y={110} width={13} height={26} rx={2.5} fill="#1d1d25" />
        <rect x={83} y={113} width={7} height={20} fill="#fff" strokeWidth={1} />
        <path d="M83 117h4M83 121h4M83 125h4M83 129h4" stroke={INK} strokeWidth={1.4} />
        <Arm who="captain" from={[80, 108]} to={[89, 116]} />
      </g>
    </>
  );
}

const MEMBERS: { who: Person; gear: ReactNode; notes: [x: number, y: number][]; glyphs?: [string, string] }[] = [
  { who: 'rockstar', gear: <Guitar />, notes: [[10, 52], [90, 30]] },
  { who: 'chef', gear: <Pot />, notes: [[8, 44], [92, 50]] },
  { who: 'wizard', gear: <Wand />, notes: [[92, 46], [84, 26]], glyphs: ['✨', '✨'] },
  { who: 'captain', gear: <Accordion />, notes: [[6, 40], [94, 36]] },
  { who: 'hero', gear: <Keys />, notes: [[8, 52], [92, 44]] },
  { who: 'viking', gear: <Maracas />, notes: [[10, 30], [90, 32]] },
];
const NOTE_COLORS = ['#ffffff', '#ffd23f', '#ff8fab', '#7dd3fc'];

// The splash's house band: six leaders, as bobblehead caricatures, jamming to the party music.
export default function Band({ big = false }: { big?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let live = true;
    void headsReady().then(() => live && setShown(true));
    return () => {
      live = false;
    };
  }, []);

  // Every dance loop lasts whole beats (or halves), so starting them all on a beat puts the band in time with the music.
  useEffect(() => {
    const sync = () => {
      const beat = nextBeatAt();
      if (beat === null || !ref.current) return;
      for (const a of ref.current.getAnimations({ subtree: true })) a.startTime = beat - BEAT_MS * 24;
    };
    sync();
    return onMusicChange(sync);
  }, []);

  return (
    <div ref={ref} className={`band ${big ? 'band-big' : ''} ${shown ? '' : 'band-wait'}`} aria-hidden>
      {MEMBERS.map((m, i) => (
        <div key={m.who} className={`band-${m.who}`}>
          <Caricature who={m.who} arms={false}>
            {m.gear}
          </Caricature>
          {m.notes.map(([x, y], n) => (
            <span
              key={n}
              className="band-note"
              style={{ left: `${x}%`, top: `${y}%`, color: NOTE_COLORS[(i + n) % 4], animationDelay: `calc(var(--beat) * ${-(i * 1.5 + n * 3)})` }}
            >
              {m.glyphs?.[n] ?? (n ? '♫' : '♪')}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
