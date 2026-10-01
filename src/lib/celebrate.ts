import confetti from 'canvas-confetti';

let fire: confetti.CreateTypes | null = null;

// Never call the default `confetti()` export: it also uses canvas-confetti's single shared worker
// and would steal the splash canvas (the worker keeps only the most recently transferred canvas).
function instance(): confetti.CreateTypes {
  if (fire) return fire;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60';
  document.body.appendChild(canvas);
  fire = confetti.create(canvas, { resize: true, useWorker: false });
  return fire;
}

const COLORS = ['#FF9933', '#FFFFFF', '#138808', '#ffca3a', '#ff66c4', '#1982c4'];

export function burst(scale = 1) {
  instance()({ particleCount: Math.round(120 * scale), spread: 100, startVelocity: 45, origin: { y: 0.7 }, colors: COLORS, disableForReducedMotion: true });
}

export function sideCannons(ms = 2500) {
  const f = instance();
  const id = setInterval(() => {
    f({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors: COLORS, disableForReducedMotion: true });
    f({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors: COLORS, disableForReducedMotion: true });
  }, 150);
  setTimeout(() => clearInterval(id), ms);
}
