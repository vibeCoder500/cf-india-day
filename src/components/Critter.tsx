import type { CSSProperties, ReactNode } from 'react';

export type Species = 'kitten' | 'puppy' | 'squirrel' | 'capybara';
export type Face = 'happy' | 'bliss' | 'whee';
export const SPECIES: readonly Species[] = ['kitten', 'puppy', 'squirrel', 'capybara'];

export const INK = '#3b2417';
const EYE = '#2b1a12';
const TONGUE = '#ff7f98';

// fur, markings, muzzle and belly
type Coat = readonly [fur: string, dark: string, light: string];
const COATS: Record<Species, Coat> = {
  kitten: ['#ffb66e', '#ee8a3a', '#fff2df'],
  puppy: ['#f7e1bd', '#a86b3c', '#fffaf0'],
  squirrel: ['#d97a40', '#b35a2a', '#fbe3c1'],
  capybara: ['#bb8a5b', '#8a5c3a', '#dcb487'],
};
export const furOf = (s: Species) => COATS[s][0];

// Pivot for CSS rotations, in viewBox units (SVG's default transform-box).
export const pivot = (x: number, y: number): CSSProperties => ({ transformOrigin: `${x}px ${y}px` });

// A thick stroke with an ink outline: arms, sticks, tails, the collar.
export function Limb({ d, color, width = 8, className, style }: { d: string; color: string; width?: number; className?: string; style?: CSSProperties }) {
  return (
    <g className={className} style={style} fill="none">
      <path d={d} strokeWidth={width + 4.5} />
      <path d={d} stroke={color} strokeWidth={width} />
    </g>
  );
}

function Eyes({ face, y = 63, dx = 14 }: { face: Face; y?: number; dx?: number }) {
  const [l, r] = [60 - dx, 60 + dx];
  if (face === 'bliss') return <path d={`M${l - 6} ${y - 1}q6 6 12 0M${r - 6} ${y - 1}q6 6 12 0`} fill="none" strokeWidth={2.6} />;
  if (face === 'whee') return <path d={`M${l - 5} ${y - 4.5}l9 4.5l-9 4.5M${r + 5} ${y - 4.5}l-9 4.5l9 4.5`} fill="none" strokeWidth={2.8} />;
  return (
    <g className="cr-blink" style={pivot(60, y)} stroke="none">
      {[l, r].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={y} rx={4.6} ry={5.8} fill={EYE} />
          <circle cx={x - 1.5} cy={y - 2.3} r={1.8} fill="#fff" />
          <circle cx={x + 1.4} cy={y + 2.4} r={0.9} fill="#fff" />
        </g>
      ))}
    </g>
  );
}

const Blush = ({ y = 73, dx = 23 }: { y?: number; dx?: number }) => (
  <g fill="#ff8fab" opacity={0.55} stroke="none">
    <ellipse cx={60 - dx} cy={y} rx={5.5} ry={3.2} />
    <ellipse cx={60 + dx} cy={y} rx={5.5} ry={3.2} />
  </g>
);

// The wide-open "wheee!" mouth.
const Shout = ({ y }: { y: number }) => (
  <>
    <path d={`M53 ${y}Q60 ${y + 14} 67 ${y}Z`} fill="#7a2233" strokeWidth={2} />
    <ellipse cx={60} cy={y + 4.6} rx={3.6} ry={2.1} fill={TONGUE} stroke="none" />
  </>
);

function Head({ species, face, back, coat: [fur, dark, light] }: { species: Species; face: Face; back: boolean; coat: Coat }) {
  switch (species) {
    case 'kitten':
      return (
        <>
          <path d="M25 54L29 15L57 34ZM95 54L91 15L63 34Z" fill={fur} />
          {!back && <path d="M31 44L32.5 24L47 34.5ZM89 44L87.5 24L73 34.5Z" fill="#ffa3b8" stroke="none" />}
          <ellipse cx={60} cy={62} rx={38} ry={32} fill={fur} />
          <path d="M60 31v9M50.5 32.8l2.1 7.2M69.5 32.8l-2.1 7.2" stroke={dark} strokeWidth={3} />
          {!back && (
            <>
              <path d="M23 57h7M23.5 64h6M97 57h-7M96.5 64h-6" stroke={dark} strokeWidth={2.6} />
              <ellipse cx={60} cy={78} rx={12.5} ry={8.5} fill={light} stroke="none" />
              <Eyes face={face} />
              <Blush />
              <path d="M56.5 71.5h7L60 75Z" fill={TONGUE} strokeWidth={1.6} />
              {face === 'whee' ? <Shout y={77} /> : <path d="M60 75v2.2M54.5 77q2.7 3.4 5.5.2q2.8 3.2 5.5-.2" fill="none" strokeWidth={1.8} />}
              <path d="M15 70l17 2.5M16 77.5l16-1M105 70l-17 2.5M104 77.5l-16-1" strokeWidth={1.4} />
            </>
          )}
        </>
      );
    case 'puppy':
      return (
        <>
          <ellipse cx={60} cy={62} rx={37} ry={32} fill={fur} />
          {!back && (
            <>
              <ellipse cx={75} cy={60} rx={10.5} ry={9.5} fill="#e3b27a" stroke="none" />
              <ellipse cx={60} cy={77} rx={15} ry={11} fill={light} stroke="none" />
              <Eyes face={face} />
              <Blush dx={21} />
              <ellipse cx={60} cy={71} rx={5.6} ry={4} fill={EYE} stroke="none" />
              <ellipse cx={58.2} cy={69.7} rx={1.7} ry={0.9} fill="#fff" stroke="none" opacity={0.85} />
              {face === 'whee' ? (
                <Shout y={77} />
              ) : (
                <>
                  <path d="M57.8 78.5Q60 86 62.2 78.5Z" fill={TONGUE} strokeWidth={1.4} />
                  <path d="M60 75v2M54 76.3q3 4 6 .7q3 3.3 6-.7" fill="none" strokeWidth={1.8} />
                </>
              )}
            </>
          )}
          <path className="cr-ear-l" style={pivot(34, 40)} d="M34 38C20 36 11 54 15 74C17 84 29 85 31 75C33 63 38 50 34 38Z" fill={dark} />
          <path className="cr-ear-r" style={pivot(86, 40)} d="M86 38C100 36 109 54 105 74C103 84 91 85 89 75C87 63 82 50 86 38Z" fill={dark} />
          <Limb d="M38 89Q60 101 82 89" color="#3fa9f5" width={5} />
          {!back && <circle cx={60} cy={100} r={4.2} fill="#ffd23f" strokeWidth={1.8} />}
        </>
      );
    case 'squirrel':
      return (
        <>
          <path d="M30 47C24 31 30 19 40 16C44 24 46 32 48 39ZM90 47C96 31 90 19 80 16C76 24 74 32 72 39Z" fill={fur} />
          {!back && <path d="M34.5 41C31 32 34 25 39 22.5C41 28 42.5 33 43.5 37.5ZM85.5 41C89 32 86 25 81 22.5C79 28 77.5 33 76.5 37.5Z" fill="#f4b690" stroke="none" />}
          <path d="M40 16l-2.5-7.5M40 16l3.5-6.5M80 16l2.5-7.5M80 16l-3.5-6.5" stroke={dark} strokeWidth={2.4} />
          <ellipse cx={60} cy={62} rx={36} ry={32} fill={fur} />
          {!back && (
            <>
              <ellipse cx={46.5} cy={77.5} rx={12} ry={9} fill={light} stroke="none" />
              <ellipse cx={73.5} cy={77.5} rx={12} ry={9} fill={light} stroke="none" />
              <Eyes face={face} />
              <Blush dx={25} y={71} />
              <ellipse cx={60} cy={71} rx={3.6} ry={2.5} fill={EYE} stroke="none" />
              {face === 'whee' ? (
                <Shout y={76} />
              ) : (
                <>
                  <path d="M57.5 76.6h5v4h-5ZM60 76.6v4" fill="#fff" strokeWidth={1.3} />
                  <path d="M54.5 75.5q2.8 2.8 5.5.5q2.7 2.3 5.5-.5" fill="none" strokeWidth={1.7} />
                </>
              )}
            </>
          )}
        </>
      );
    case 'capybara':
      return (
        <>
          <ellipse cx={30} cy={33} rx={5.5} ry={5} fill={dark} />
          <ellipse cx={90} cy={33} rx={5.5} ry={5} fill={dark} />
          <rect x={25} y={27} width={70} height={68} rx={22} fill={fur} />
          {!back && (
            <>
              <rect x={35} y={61} width={50} height={31} rx={15} fill={light} stroke="none" />
              <Eyes face={face} y={52} dx={17} />
              <Blush y={66} dx={26} />
              <rect x={48} y={64} width={24} height={9} rx={4.5} fill="#5a3a26" stroke="none" />
              {face === 'whee' ? <Shout y={80} /> : <path d="M60 73v4M54.5 79.5q5.5 4 11 0" fill="none" strokeWidth={1.8} />}
            </>
          )}
          {/* The famous capybara look: a little orange balanced on its head. */}
          <g className="cr-fruit" style={pivot(60, 31)}>
            <circle cx={60} cy={22} r={10} fill="#ff9933" />
            <path d="M54.8 18.8q1.4-3 4.4-3.5" stroke="#fff" strokeWidth={1.8} fill="none" opacity={0.75} />
            <path d="M60 12.3V9" strokeWidth={2} />
            <path d="M61 11.6Q67 3.5 74 7.6Q68 14 61 11.6Z" fill="#5fbf4a" strokeWidth={1.8} />
          </g>
        </>
      );
  }
}

function Tail({ species, back, coat: [fur, dark] }: { species: Species; back: boolean; coat: Coat }) {
  switch (species) {
    case 'kitten':
      return back ? (
        <Limb className="cr-tail" style={pivot(60, 134)} d="M60 135Q61 112 74 104Q86 97 84 85" color={fur} width={7.5} />
      ) : (
        <Limb className="cr-tail" style={pivot(80, 127)} d="M80 127C100 129 105 110 98 98C94 91 99 85 104 90" color={fur} width={7.5} />
      );
    case 'puppy':
      return back ? (
        <Limb className="cr-tail" style={pivot(60, 118)} d="M60 118Q61 106 69 99" color={fur} width={7} />
      ) : (
        <Limb className="cr-tail" style={pivot(82, 115)} d="M82 115Q95 109 95 95" color={fur} width={7} />
      );
    case 'squirrel':
      return back ? (
        <g className="cr-tail" style={pivot(60, 140)}>
          <path d="M60 142C30 142 22 110 36 88C46 72 30 56 40 38C48 22 72 16 80 30C86 40 78 50 70 44C74 60 90 74 84 96C80 116 90 140 60 142Z" fill={dark} />
          <path d="M58 132C44 118 40 100 48 84C56 68 44 52 56 38" fill="none" stroke={fur} strokeWidth={5} opacity={0.7} />
        </g>
      ) : (
        <g className="cr-tail" style={pivot(74, 130)}>
          <path d="M70 134C104 142 124 110 112 84C104 66 124 50 110 30C100 16 78 18 76 32C75 40 82 44 88 40C96 54 88 70 92 88C95 106 86 124 70 128Z" fill={dark} />
          <path d="M100 124C112 104 100 84 106 62C110 46 102 30 90 30" fill="none" stroke={fur} strokeWidth={5} opacity={0.7} />
        </g>
      );
    case 'capybara':
      return null;
  }
}

// A chibi animal in a 120 × 150 viewBox, seen from the front (or from behind). CSS animates the named parts.
export default function Critter({ species, face = 'happy', back = false, arms = true, className, children }: {
  species: Species;
  face?: Face;
  back?: boolean;
  arms?: boolean; // off when the children draw their own arms (holding an instrument)
  className?: string;
  children?: ReactNode;
}) {
  const coat = COATS[species];
  const [fur, dark, light] = coat;
  const capy = species === 'capybara';
  const shoulder = capy ? 23 : 20;
  const tail = <Tail species={species} back={back} coat={coat} />;
  return (
    <svg viewBox="0 0 120 150" className={`cr-${species} ${className ?? ''}`} aria-hidden>
      <g className="cr-all" stroke={INK} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        {!back && tail}
        <ellipse className="cr-leg-l" cx={47} cy={140} rx={10} ry={6.5} fill={capy ? dark : fur} />
        <ellipse className="cr-leg-r" cx={73} cy={140} rx={10} ry={6.5} fill={capy ? dark : fur} />
        <ellipse cx={60} cy={capy ? 114 : 112} rx={capy ? 31 : 26} ry={capy ? 25 : 26} fill={fur} />
        {!back && !capy && <ellipse cx={60} cy={117} rx={15.5} ry={16} fill={light} stroke="none" />}
        {arms && (
          <>
            <Limb className="cr-arm-l" style={pivot(60 - shoulder, 101)} d={`M${60 - shoulder} 101l-9 17`} color={fur} />
            <Limb className="cr-arm-r" style={pivot(60 + shoulder, 101)} d={`M${60 + shoulder} 101l9 17`} color={fur} />
          </>
        )}
        <g className="cr-head" style={pivot(60, 94)}>
          <Head species={species} face={face} back={back} coat={coat} />
        </g>
        {back && tail}
        {children}
      </g>
    </svg>
  );
}
