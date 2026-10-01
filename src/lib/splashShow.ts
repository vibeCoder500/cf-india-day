import confetti from 'canvas-confetti';

type Fire = confetti.CreateTypes;
interface Mode {
  every: number; // ms between bursts
  fire: (f: Fire) => void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const RAINBOW = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff66c4'];
const TRICOLOR = ['#FF9933', '#FFFFFF', '#138808'];
const NEON = ['#00F5D4', '#F15BB5', '#FEE440', '#9B5DE5', '#00BBF9'];
const GOLD = ['#FFD700', '#FFC300', '#FFB000', '#FFF1A8'];

let emoji: confetti.Shape[] | null = null;
function emojiShapes(): confetti.Shape[] {
  if (emoji) return emoji;
  try {
    emoji = ['🥳', '🤩', '🎉', '✨', '🪔'].map((text) => confetti.shapeFromText({ text, scalar: 2 }));
  } catch {
    emoji = []; // needs OffscreenCanvas (iOS 16.4+); regular confetti still plays
  }
  return emoji;
}

const MODES: Mode[] = [
  {
    every: 140, // side cannons
    fire: (f) => {
      f({ particleCount: 10, angle: 60, spread: 55, startVelocity: 58, origin: { x: 0, y: 0.9 }, colors: RAINBOW });
      f({ particleCount: 10, angle: 120, spread: 55, startVelocity: 58, origin: { x: 1, y: 0.9 }, colors: RAINBOW });
    },
  },
  {
    every: 300, // fireworks
    fire: (f) =>
      f({ particleCount: 60, spread: 360, startVelocity: 30, ticks: 70, gravity: 0.9, origin: { x: rand(0.15, 0.85), y: rand(0.15, 0.5) }, colors: NEON }),
  },
  {
    every: 260, // emoji rain
    fire: (f) => {
      const shapes = emojiShapes();
      if (shapes.length) f({ particleCount: 5, shapes, scalar: 2, spread: 90, startVelocity: 18, gravity: 0.6, ticks: 240, flat: true, angle: 270, origin: { x: rand(0.05, 0.95), y: -0.1 } });
    },
  },
  {
    every: 380, // star bursts
    fire: (f) =>
      f({ particleCount: 36, shapes: ['star'], colors: GOLD, spread: 360, startVelocity: 26, ticks: 80, gravity: 0, decay: 0.94, scalar: 1.3, origin: { x: rand(0.3, 0.7), y: rand(0.3, 0.6) } }),
  },
  {
    every: 120, // glitter snow
    fire: (f) =>
      f({ particleCount: 4, shapes: ['circle'], colors: ['#ffffff', '#fde68a', '#bae6fd'], ticks: 300, gravity: 0.35, drift: rand(-0.5, 0.5), scalar: rand(0.5, 0.9), startVelocity: 2, origin: { x: Math.random(), y: -0.05 } }),
  },
  {
    every: 170, // tricolour streams
    fire: (f) => {
      f({ particleCount: 8, angle: 55, spread: 40, startVelocity: 50, origin: { x: 0, y: 0.65 }, colors: TRICOLOR });
      f({ particleCount: 8, angle: 125, spread: 40, startVelocity: 50, origin: { x: 1, y: 0.65 }, colors: TRICOLOR });
    },
  },
];

const GENTLE: Mode = {
  every: 1600, // keeps the screen alive after the Enter button appears
  fire: (f) => f({ particleCount: 40, spread: 80, startVelocity: 35, origin: { x: rand(0.2, 0.8), y: 0.9 }, colors: RAINBOW }),
};

function finale(f: Fire) {
  [0, 250, 500].forEach((d) =>
    setTimeout(() => f({ particleCount: 160, spread: 120, startVelocity: 55, origin: { x: 0.5, y: 0.75 }, colors: [...RAINBOW, ...TRICOLOR] }), d),
  );
}

// Switches to a different random mode every ~2.6 s ("fast and frequently changing"); calls onDone once.
export function startSplashShow(f: Fire, durationMs: number, onDone: () => void): () => void {
  const start = performance.now();
  let mode = 0;
  let modeAt = start;
  let lastFire = 0;
  let done = false;
  const id = setInterval(() => {
    const now = performance.now();
    if (now - modeAt > 2600) {
      mode = (mode + 1 + Math.floor(Math.random() * (MODES.length - 1))) % MODES.length;
      modeAt = now;
    }
    const m = done ? GENTLE : MODES[mode];
    if (now - lastFire >= m.every) {
      m.fire(f);
      lastFire = now;
    }
    if (!done && now - start >= durationMs) {
      done = true;
      finale(f);
      onDone();
    }
  }, 50);
  return () => clearInterval(id);
}
