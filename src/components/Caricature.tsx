import type { CSSProperties, ReactNode } from 'react';
import captain from '../assets/heads/captain.webp';
import captainBack from '../assets/heads/captain-back.webp';
import chef from '../assets/heads/chef.webp';
import chefBack from '../assets/heads/chef-back.webp';
import hero from '../assets/heads/hero.webp';
import heroBack from '../assets/heads/hero-back.webp';
import rockstar from '../assets/heads/rockstar.webp';
import rockstarBack from '../assets/heads/rockstar-back.webp';
import viking from '../assets/heads/viking.webp';
import vikingBack from '../assets/heads/viking-back.webp';
import wizard from '../assets/heads/wizard.webp';
import wizardBack from '../assets/heads/wizard-back.webp';

// Six of our leaders (they said yes) as bobblehead caricatures: their own photo as the head, on a cartoon body in a
// funny costume. The photos were cut out, levelled and upscaled offline, never redrawn or reshaped, so everyone is
// recognisable. Every head file is 660 × 780 px with the face 264 px wide (cheek to cheek) and the point between the
// eyes at (330, 375), so one placement fits all six. The *-back files are the same outline in hair colour.
export type Person = 'rockstar' | 'chef' | 'wizard' | 'captain' | 'hero' | 'viking';
export const PEOPLE: readonly Person[] = ['rockstar', 'chef', 'wizard', 'captain', 'hero', 'viking'];

export const INK = '#3b2417';
const K = 58 / 264; // viewBox units per photo pixel: every face is 58 units wide, a proper bobblehead
const EYES = 58;
const HEAD = { x: 60 - 330 * K, y: EYES - 375 * K, w: 660 * K, h: 780 * K };

type Look = { front: string; back: string; sleeve: string; hand: string };
const LOOKS: Record<Person, Look> = {
  rockstar: { front: rockstar, back: rockstarBack, sleeve: '#1f1f26', hand: '#9a6448' },
  chef: { front: chef, back: chefBack, sleeve: '#fbfbf8', hand: '#c08a6e' },
  wizard: { front: wizard, back: wizardBack, sleeve: '#6c3fc7', hand: '#b57a5f' },
  captain: { front: captain, back: captainBack, sleeve: '#b91c1c', hand: '#c4896d' },
  hero: { front: hero, back: heroBack, sleeve: '#2a6fdb', hand: '#e63946' }, // red gloves
  viking: { front: viking, back: vikingBack, sleeve: '#3a7d44', hand: '#8f6450' },
};

let ready: Promise<void> | null = null;
// Loads and decodes every head once, so nobody ever appears headless for a moment.
export function headsReady(): Promise<void> {
  ready ??= Promise.all(
    Object.values(LOOKS).flatMap(({ front, back }) =>
      [front, back].map((src) => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => undefined);
      }),
    ),
  ).then(() => undefined);
  return ready;
}

// Pivot for CSS rotations, in viewBox units (SVG's default transform-box).
export const pivot = (x: number, y: number): CSSProperties => ({ transformOrigin: `${x}px ${y}px` });

// A thick stroke with an ink outline: sleeves, sticks, the wand.
export function Limb({ d, color, width = 7.5, className, style }: { d: string; color: string; width?: number; className?: string; style?: CSSProperties }) {
  return (
    <g className={className} style={style} fill="none">
      <path d={d} strokeWidth={width + 4.5} />
      <path d={d} stroke={color} strokeWidth={width} />
    </g>
  );
}

// A sleeve from the shoulder with the hand (or glove) at the end.
export function Arm({ who, from: [x1, y1], to: [x2, y2], width, className, style }: {
  who: Person;
  from: [number, number];
  to: [number, number];
  width?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <g className={className} style={style}>
      <Limb d={`M${x1} ${y1}L${x2} ${y2}`} color={LOOKS[who].sleeve} width={width ?? (who === 'wizard' ? 9 : 7.5)} />
      <circle cx={x2} cy={y2} r={4} fill={LOOKS[who].hand} strokeWidth={2} />
    </g>
  );
}

export function star(cx: number, cy: number, r: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }
  return `${d}Z`;
}

// The body: shoulders just under the chin (the neckline dips a little to show the neck), hips at 136.
const TORSO = 'M37 109C37 103 44 101 52 101Q60 108 68 101C76 101 83 103 83 109L81 136Q60 140 39 136Z';
const TORSO_BACK = 'M37 109C37 103 44 101 52 101Q60 103 68 101C76 101 83 103 83 109L81 136Q60 140 39 136Z';
const ROBE = 'M37 109C37 103 44 101 52 101Q60 108 68 101C76 101 83 103 83 109L89 141Q60 147 31 141Z';
const ROBE_BACK = 'M37 109C37 103 44 101 52 101Q60 103 68 101C76 101 83 103 83 109L89 141Q60 147 31 141Z';

function Legs({ who }: { who: Person }) {
  const [pants, shoe] = {
    rockstar: ['#2b3a67', '#f4f4f4'],
    chef: ['#e3e3e3', '#2a2a2a'],
    wizard: ['#4b2a8a', '#4b2a8a'],
    captain: ['#f1e4c8', '#1d1d25'],
    hero: ['#2a6fdb', '#e63946'],
    viking: ['#7a6a58', '#8b5a2b'],
  }[who];
  const leg = (x: number, foot: number, className: string) => (
    <g className={className}>
      <rect x={x} y={128} width={11} height={15} rx={3} fill={pants} />
      {who === 'chef' && (
        <g fill="#3a3a3a" stroke="none">
          <rect x={x + 1.5} y={131} width={3} height={3} />
          <rect x={x + 6.5} y={131} width={3} height={3} />
          <rect x={x + 4} y={135.5} width={3} height={3} />
        </g>
      )}
      {who === 'viking' && <path d={`M${x} 133l11 4M${x} 137l11 -4M${x} 141l11 -4`} fill="none" stroke="#c9b48f" strokeWidth={1.4} />}
      <ellipse cx={foot} cy={145} rx={8.5} ry={4.5} fill={shoe} />
    </g>
  );
  return (
    <>
      {leg(44, 48, 'cr-leg-l')}
      {leg(65, 72, 'cr-leg-r')}
    </>
  );
}

// Seen from the front, a cape or a cloak hangs behind everything else.
function Behind({ who }: { who: Person }) {
  if (who === 'hero') return <path className="cr-cape" style={pivot(60, 104)} d="M41 104L27 141Q43 146 60 142Q77 146 93 141L79 104Z" fill="#e63946" />;
  if (who === 'viking') return <path className="cr-cape" style={pivot(60, 104)} d="M38 104L31 140Q60 146 89 140L82 104Z" fill="#6b4423" />;
  return null;
}

function Torso({ who, back }: { who: Person; back: boolean }) {
  switch (who) {
    case 'rockstar':
      return back ? (
        <>
          <path d={TORSO_BACK} fill="#1f1f26" />
          <path d={star(60, 119, 9)} fill="#fff" strokeWidth={1.6} />
          <g fill="#cfd6dd" stroke="none">
            {[42, 47, 73, 78].map((x) => <circle key={x} cx={x} cy={x < 60 ? 105 + (47 - x) * 0.4 : 105 + (x - 73) * 0.4} r={1.3} />)}
          </g>
        </>
      ) : (
        <>
          <path d={TORSO} fill="#1f1f26" />
          <path d="M53 102Q60 108 67 102L64 138L56 138Z" fill="#e63946" strokeWidth={1.8} />
          <path d="M61.5 110L57.5 118H61.5L58.5 127" fill="none" stroke="#fff" strokeWidth={1.8} />
          <g fill="#cfd6dd" stroke="none">
            {[42, 47, 73, 78].map((x) => <circle key={x} cx={x} cy={x < 60 ? 105 + (47 - x) * 0.4 : 105 + (x - 73) * 0.4} r={1.3} />)}
          </g>
        </>
      );
    case 'chef':
      return back ? (
        <>
          <path d={TORSO_BACK} fill="#fbfbf8" />
          {/* The apron's bow. */}
          <path d="M60 128Q51 121 50 128Q51 135 60 128Q69 121 70 128Q69 135 60 128Z" fill="#e63946" strokeWidth={1.8} />
          <path d="M58 129L55 138M62 129L65 138" fill="none" stroke="#e63946" strokeWidth={2.4} />
        </>
      ) : (
        <>
          <path d={TORSO} fill="#fbfbf8" />
          <path d="M65 108V137" fill="none" stroke="#c9ccd3" strokeWidth={1.4} />
          <g fill={INK} stroke="none">
            {[116, 124, 132].map((y) => (
              <g key={y}>
                <circle cx={55} cy={y} r={1.3} />
                <circle cx={71} cy={y} r={1.3} />
              </g>
            ))}
          </g>
          {/* Neckerchief. */}
          <path d="M51 102Q60 110 69 102L60 117Z" fill="#e63946" strokeWidth={2} />
          <circle cx={60} cy={106} r={2.6} fill="#c62f3b" strokeWidth={1.6} />
        </>
      );
    case 'wizard':
      return back ? (
        <>
          <path d={ROBE_BACK} fill="#6c3fc7" />
          <path d={star(48, 118, 3.6)} fill="#ffd23f" strokeWidth={1} />
          <path d={star(71, 130, 3)} fill="#ffd23f" strokeWidth={1} />
          <path d={star(55, 136, 2.4)} fill="#ffd23f" strokeWidth={1} />
        </>
      ) : (
        <>
          <path d={ROBE} fill="#6c3fc7" />
          <path d="M60 107V145" fill="none" stroke="#ffd23f" strokeWidth={2.2} />
          <path d={star(47, 124, 3.6)} fill="#ffd23f" strokeWidth={1} />
          <path d={star(74, 134, 3)} fill="#ffd23f" strokeWidth={1} />
          <path d="M72 112a5 5 0 1 0 5 8a4 4 0 1 1 -5 -8Z" fill="#ffe08a" strokeWidth={1.2} />
        </>
      );
    case 'captain': {
      // A pirate captain's long coat, split at the back, with her first mate on her shoulder.
      const coat = 'M37 109C37 103 44 101 52 101Q60 108 68 101C76 101 83 103 83 109L86 141Q74 144 66 139L60 129L54 139Q46 144 34 141Z';
      return back ? (
        <>
          <path d="M37 109C37 103 44 101 52 101Q60 103 68 101C76 101 83 103 83 109L86 141Q74 144 66 139L60 129L54 139Q46 144 34 141Z" fill="#b91c1c" />
          <rect x={38} y={123} width={44} height={5} fill="#1d1d25" strokeWidth={2} />
          <path d="M60 128V139" fill="none" strokeWidth={1.6} />
        </>
      ) : (
        <>
          <path d={coat} fill="#b91c1c" />
          <path d="M53 103Q60 108 67 103L65 123L55 123Z" fill="#f5f0e6" strokeWidth={1.8} />
          <g fill="#fff" strokeWidth={1.2}>
            <circle cx={57.5} cy={107.5} r={2.4} />
            <circle cx={62.5} cy={107.5} r={2.4} />
            <circle cx={60} cy={111.5} r={2.4} />
          </g>
          <g fill="#ffd23f" strokeWidth={1}>
            {[110, 117].map((y) => (
              <g key={y}>
                <circle cx={50.5} cy={y} r={1.6} />
                <circle cx={69.5} cy={y} r={1.6} />
              </g>
            ))}
          </g>
          <rect x={38} y={123} width={44} height={5} fill="#1d1d25" strokeWidth={2} />
          <rect x={56} y={122} width={8} height={7} rx={1.5} fill="#ffd23f" strokeWidth={1.5} />
          <g className="cr-parrot" style={pivot(88, 104)}>
            <path d="M92 103L99 116L90 106Z" fill="#2563eb" strokeWidth={1.4} />
            <ellipse cx={88} cy={97} rx={6} ry={8} fill="#22c55e" strokeWidth={1.6} />
            <path d="M90 92Q97 99 91 105Q88 99 90 92Z" fill="#ef4444" strokeWidth={1.2} />
            <circle cx={86} cy={87.5} r={5} fill="#22c55e" strokeWidth={1.6} />
            <path d="M82 86.5Q77.5 88.5 81 92L84 89.5Z" fill="#f59e0b" strokeWidth={1.2} />
            <circle cx={86.2} cy={86.6} r={1.2} fill={INK} stroke="none" />
          </g>
        </>
      );
    }
    case 'hero':
      return back ? (
        <>
          <path d={TORSO_BACK} fill="#2a6fdb" />
          <path className="cr-cape" style={pivot(60, 104)} d="M38 103Q60 99 82 103L91 142Q60 149 29 142Z" fill="#e63946" />
        </>
      ) : (
        <>
          <path d={TORSO} fill="#2a6fdb" />
          <rect x={39} y={126} width={42} height={5} fill="#ffd23f" strokeWidth={2} />
          <rect x={56} y={125} width={8} height={7} rx={1.5} fill="#ffb703" strokeWidth={1.6} />
          {/* The emblem: a lightning bolt on a diamond. */}
          <path d="M60 107L67.5 114L60 121L52.5 114Z" fill="#ffd23f" strokeWidth={2} />
          <path d="M61.3 109L57.6 114.6H61.4L58.6 119.5" fill="none" stroke="#e63946" strokeWidth={1.8} />
          <circle cx={42} cy={105} r={2.2} fill="#ffd23f" strokeWidth={1.4} />
          <circle cx={78} cy={105} r={2.2} fill="#ffd23f" strokeWidth={1.4} />
        </>
      );
    case 'viking': {
      // A fur collar over the shoulders.
      const fur = 'M33 108Q36 100 44 102Q48 97 53 102Q60 98 67 102Q72 97 76 102Q84 100 87 108Q82 113 76 110Q70 114 64 110Q60 113 56 110Q50 114 44 110Q38 113 33 108Z';
      return back ? (
        <>
          <path d={TORSO_BACK} fill="#3a7d44" />
          <path className="cr-cape" style={pivot(60, 104)} d="M35 104Q60 99 85 104L89 141Q60 147 31 141Z" fill="#6b4423" />
          <path d={fur} fill="#a0703c" />
        </>
      ) : (
        <>
          <path d={TORSO} fill="#3a7d44" />
          <rect x={39} y={125} width={42} height={5.5} fill="#5a3a1e" strokeWidth={2} />
          <rect x={56.5} y={124.5} width={7} height={6.5} rx={1.5} fill="#ffd23f" strokeWidth={1.5} />
          <path d={fur} fill="#a0703c" />
        </>
      );
    }
  }
}

// Hats sit on top of the hair and never cover the face.
function Hat({ who }: { who: Person }) {
  switch (who) {
    case 'chef':
      return (
        <g className="cr-hat" style={pivot(60, 20)}>
          <path d="M37 13C27 11 25 -5 37 -7C39 -19 53 -21 59 -13C65 -23 81 -19 83 -8C96 -7 94 11 83 13Z" fill="#fff" />
          <path d="M48 12L46 -1M60 12V-3M72 12L74 -1" fill="none" stroke="#d5d8de" strokeWidth={1.6} />
          <rect x={36} y={11} width={48} height={11} rx={3} fill="#fff" />
        </g>
      );
    case 'wizard':
      return (
        <g className="cr-hat" style={pivot(60, 18)}>
          <ellipse cx={61} cy={19} rx={33} ry={5.5} fill="#5a32a8" />
          <path d="M41 19Q51 -4 62 -30Q66 -37 71 -31Q73 -4 81 19Z" fill="#6c3fc7" />
          <path d="M42 14Q61 10 80 14L81.5 18.5Q61 14.5 40.5 18.5Z" fill="#ffd23f" strokeWidth={1.6} />
          <path d={star(59, 2, 3.4)} fill="#ffd23f" strokeWidth={1} />
          <path d={star(66, -14, 2.6)} fill="#ffd23f" strokeWidth={1} />
        </g>
      );
    case 'captain':
      // A tricorn: wide enough to cover the top of the head, which her photo cuts off.
      return (
        <g className="cr-hat" style={pivot(60, 20)}>
          <path d="M10 16Q28 -6 60 -14Q92 -6 110 16Q86 9 60 25Q34 9 10 16Z" fill="#1d1d25" />
          <path d="M14 15.5Q36 11 60 23Q84 11 106 15.5" fill="none" stroke="#ffd23f" strokeWidth={2.2} />
          {/* A friendly skull and crossbones. */}
          <path d="M53 -2L67 8M67 -2L53 8" fill="none" stroke="#fff" strokeWidth={2} />
          <circle cx={60} cy={1} r={4.4} fill="#fff" strokeWidth={1.2} />
          <circle cx={58.3} cy={0.6} r={0.9} fill={INK} stroke="none" />
          <circle cx={61.7} cy={0.6} r={0.9} fill={INK} stroke="none" />
        </g>
      );
    case 'viking':
      return (
        <g className="cr-hat" style={pivot(60, 27)}>
          <path d="M33 22C22 21 13 12 13 -3C19 7 25 11 35 12Z" fill="#fff4dd" />
          <path d="M87 22C98 21 107 12 107 -3C101 7 95 11 85 12Z" fill="#fff4dd" />
          <path d="M30 27C30 1 90 1 90 27Z" fill="#b8c1cc" />
          <path d="M60 6V24" fill="none" stroke="#8a94a3" strokeWidth={3} />
          <rect x={28} y={23} width={64} height={8} rx={3} fill="#8a94a3" />
          <g fill="#e6ebf0" stroke="none">
            {[36, 48, 72, 84].map((x) => <circle key={x} cx={x} cy={27} r={1.3} />)}
          </g>
        </g>
      );
    default:
      return null;
  }
}

// A bobblehead in a 120 × 150 viewBox, seen from the front (or from behind). CSS animates the named parts.
export default function Caricature({ who, back = false, arms = true, className, children }: {
  who: Person;
  back?: boolean;
  arms?: boolean; // off when the children draw their own arms (holding an instrument)
  className?: string;
  children?: ReactNode;
}) {
  const look = LOOKS[who];
  return (
    <svg viewBox="0 0 120 150" className={`cr-${who} ${className ?? ''}`} aria-hidden>
      <g className="cr-all" stroke={INK} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        {!back && <Behind who={who} />}
        <Legs who={who} />
        {/* The head goes under the costume, so the collar hides the bottom of the neck however it bobbles. */}
        <g className="cr-head" style={pivot(60, 104)}>
          <image href={back ? look.back : look.front} x={HEAD.x} y={HEAD.y} width={HEAD.w} height={HEAD.h} />
          <Hat who={who} />
        </g>
        <Torso who={who} back={back} />
        {arms && (
          <>
            <Arm who={who} className="cr-arm-l" style={pivot(40, 108)} from={[40, 108]} to={[31, 126]} />
            <Arm who={who} className="cr-arm-r" style={pivot(80, 108)} from={[80, 108]} to={[89, 126]} />
          </>
        )}
        {children}
      </g>
    </svg>
  );
}
