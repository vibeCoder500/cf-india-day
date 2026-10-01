import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { BEAT_MS, nextBeatAt, onMusicChange } from '../lib/music';
import Critter, { INK, Limb, furOf, pivot } from './Critter';
import type { Face, Species } from './Critter';

const WOOD = '#7a4a26';

function Guitar() {
  const fur = furOf('kitten');
  return (
    <>
      <g transform="translate(64 113) rotate(32)">
        <rect x={-50} y={-3.2} width={40} height={6.4} rx={1.5} fill="#8a5a33" />
        <rect x={-57} y={-5.5} width={9} height={11} rx={2.5} fill="#8a5a33" />
        {/* Outlined bouts first, then plain ones on top, so the two circles read as one body. */}
        <g fill="#2ec4b6">
          <circle cx={-7} r={9.5} />
          <circle cx={7} r={12} />
          <circle cx={-7} r={9.5} stroke="none" />
          <circle cx={7} r={12} stroke="none" />
        </g>
        <circle cx={1} r={3.8} fill="#17494a" stroke="none" />
        <rect x={9.5} y={-5} width={3} height={10} rx={1} fill="#8a5a33" strokeWidth={1.2} />
        <path d="M-55-1.6H11M-55 1.6H11" stroke="#fff6dd" strokeWidth={0.7} />
      </g>
      <Limb d="M40 101L33 93.5" color={fur} />
      <Limb className="band-strum" style={pivot(80, 101)} d="M80 101L69 111" color={fur} />
    </>
  );
}

function Dhol() {
  const fur = furOf('puppy');
  return (
    <>
      <rect x={30} y={100} width={60} height={28} rx={7} fill="#e63946" />
      <path d="M36 101L42 127L48 101L54 127L60 101L66 127L72 101L78 127L84 101" fill="none" stroke="#ffd23f" strokeWidth={2} />
      <ellipse cx={30} cy={114} rx={5.5} ry={14} fill="#fff4dd" />
      <ellipse cx={90} cy={114} rx={5.5} ry={14} fill="#fff4dd" />
      {/* A heavy stick on the bass side and a thin one on the treble side, like a real dhol. */}
      <g className="band-stick-l" style={pivot(40, 101)}>
        <Limb d="M21 96L27 112" color={WOOD} width={3.2} />
        <Limb d="M40 101L22 96" color={fur} />
      </g>
      <g className="band-stick-r" style={pivot(80, 101)}>
        <Limb d="M99 96L93 112" color={WOOD} width={2} />
        <Limb d="M80 101L98 96" color={fur} />
      </g>
    </>
  );
}

function Keys() {
  const fur = furOf('capybara');
  const gaps = Array.from({ length: 11 }, (_, i) => 25 + i * 7);
  return (
    <>
      <path d="M36 147L84 119M84 147L36 119" stroke="#4a4e69" strokeWidth={3.5} />
      <rect x={14} y={105} width={92} height={19} rx={3.5} fill="#2d3047" />
      <rect x={18} y={112} width={84} height={9.5} fill="#fff" stroke="none" />
      <path d={gaps.map((x) => `M${x} 112v9.5`).join('')} stroke="#b9bdc9" strokeWidth={0.8} />
      <g fill={INK} stroke="none">
        {[0, 1, 3, 4, 5, 7, 8, 10].map((i) => (
          <rect key={i} x={gaps[i] - 2} y={112} width={4} height={6} rx={0.6} />
        ))}
      </g>
      <g fill="#ffd23f" stroke="none">
        <circle cx={21} cy={108.5} r={1.5} />
        <circle cx={26} cy={108.5} r={1.5} />
      </g>
      <rect x={44} y={106.8} width={32} height={3.6} rx={1} fill="#7df9ff" stroke="none" opacity={0.85} />
      <Limb className="band-key-l" d="M37 101L45 111" color={fur} />
      <Limb className="band-key-r" d="M83 101L75 111" color={fur} />
    </>
  );
}

function Maracas() {
  const fur = furOf('squirrel');
  const maraca = (x: number, tilt: number) => (
    <g transform={`rotate(${tilt} ${x} 71)`}>
      <ellipse cx={x} cy={71} rx={7} ry={9} fill="#ffd23f" />
      <path d={`M${x - 6.5} 70q6.5 5 13 0`} fill="none" stroke="#e63946" strokeWidth={2.4} />
    </g>
  );
  return (
    <>
      <g className="band-shake-l" style={pivot(40, 101)}>
        <Limb d="M24 90L17 79" color={WOOD} width={3} />
        {maraca(13.5, -30)}
        <Limb d="M40 101L25 91" color={fur} />
      </g>
      <g className="band-shake-r" style={pivot(80, 101)}>
        <Limb d="M96 90L103 79" color={WOOD} width={3} />
        {maraca(106.5, 30)}
        <Limb d="M80 101L95 91" color={fur} />
      </g>
    </>
  );
}

const MEMBERS: { species: Species; face: Face; gear: ReactNode; notes: [x: number, y: number][] }[] = [
  { species: 'kitten', face: 'bliss', gear: <Guitar />, notes: [[62, 62], [40, 50]] },
  { species: 'puppy', face: 'happy', gear: <Dhol />, notes: [[22, 62], [80, 58]] },
  { species: 'capybara', face: 'bliss', gear: <Keys />, notes: [[38, 64], [64, 60]] },
  { species: 'squirrel', face: 'happy', gear: <Maracas />, notes: [[12, 40], [88, 44]] },
];
const NOTE_COLORS = ['#ffffff', '#ffd23f', '#ff8fab', '#7dd3fc'];

// The splash's house band: a kitten, a puppy, a capybara and a squirrel jamming to the party music.
export default function Band({ big = false }: { big?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

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
    <div ref={ref} className={`band ${big ? 'band-big' : ''}`} aria-hidden>
      {MEMBERS.map((m, i) => (
        <div key={m.species} className={`band-${m.species}`}>
          <Critter species={m.species} face={m.face} arms={false}>
            {m.gear}
          </Critter>
          {m.notes.map(([x, y], n) => (
            <span
              key={n}
              className="band-note"
              style={{ left: `${x}%`, top: `${y}%`, color: NOTE_COLORS[(i + n) % 4], animationDelay: `calc(var(--beat) * ${-(i * 1.5 + n * 3)})` }}
            >
              {n ? '♫' : '♪'}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
