import { useEffect, useState } from 'react';
import { burst } from './celebrate';

// Small surprise animations. All purely decorative: skipped for reduced motion and never block input.
export const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

const PUFFS = ['✨', '💥', '🎉', '😂', '🤪', '🙌', '💃', '🕺', '🪅', '⭐', '🌶️', '🦄', '🥳', '😎', '🍿', '🪩', '🫶', '🔥'];

export const CHEERS = ['Nailed it! 🎯', 'Genius alert 🚨', 'Big brain energy 🧠', 'Einstein who? 🤓', 'Too easy 😎', 'Absolute legend 🏆'];
export const OOPS = ['Even Sachin gets out sometimes 🏏', 'Close… ish? 🙈', 'The next one is yours! 💪', 'Plot twist! 🌀', 'Brain.exe has stopped 🤖'];
export const PICKED = ['Bold choice! 😎', 'Ooh, interesting 🤔', 'Locked & loaded 🚀', 'Spicy pick 🌶️', 'Respect 🫡', 'The crowd goes wild 🙌'];
export const WAITING = ['Waiting for the slowpokes 🐢', 'Others are still thinking… 🤔', 'Sip some chai meanwhile ☕', 'Drumroll please… 🥁', 'Suspense level: 💯'];
export const POKES = ['Hehe, that tickles! 😆', 'Stop poking me 😤', "I'm ready! 💪", 'Is it chai time yet? ☕', 'Boop! 👉', 'Again! Again! 🤩', "I'm not a button! 🙃"];
export const GUESSED = ['Big brain energy 🧠', 'Calculated. 🤓', 'Bold guess! 🎯', 'Trust your gut 🥟'];

// An emoji that pops out at (x, y), spins and floats away.
export function puff(x: number, y: number, emoji = pick(PUFFS), scale = 1) {
  if (calm()) return;
  const el = document.createElement('span');
  el.textContent = emoji;
  el.style.cssText = `position:fixed;left:${x}px;top:${y}px;font-size:${1.6 * scale}rem;pointer-events:none;z-index:80;user-select:none`;
  document.body.appendChild(el);
  const dx = Math.round((Math.random() - 0.5) * 140);
  const spin = Math.round((Math.random() - 0.5) * 540);
  el.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx / 2}px), calc(-50% - 50px)) scale(1.2) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.4 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% - 120px)) scale(0.8) rotate(${spin}deg)`, opacity: 0 },
    ],
    { duration: 850, easing: 'cubic-bezier(.2,.8,.2,1)' },
  ).onfinish = () => el.remove();
}

export function puffFrom(el: Element, emoji?: string, scale = 1.4) {
  const r = el.getBoundingClientRect();
  puff(r.left + r.width / 2, r.top + r.height / 2, emoji, scale);
}

const TRICKS: Keyframe[][] = [
  [{ transform: 'rotate(0)' }, { transform: 'rotate(-25deg) scale(1.1)', offset: 0.2 }, { transform: 'rotate(360deg)' }], // spin
  [{ transform: 'perspective(400px) rotateY(0)' }, { transform: 'perspective(400px) rotateY(360deg)' }], // flip
  [
    { transform: 'translateY(0) scale(1, 1)' },
    { transform: 'translateY(0) scale(1.25, 0.75)', offset: 0.15 },
    { transform: 'translateY(-70px) scale(0.9, 1.1)', offset: 0.5 },
    { transform: 'translateY(0) scale(1.2, 0.8)', offset: 0.85 },
    { transform: 'translateY(0) scale(1, 1)' },
  ], // jump
  [{ transform: 'scale(1)' }, { transform: 'scale(1.8) rotate(8deg)', offset: 0.4 }, { transform: 'scale(0.85)', offset: 0.7 }, { transform: 'scale(1)' }], // grow
  [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-16px) rotate(-12deg)', offset: 0.2 },
    { transform: 'translateX(16px) rotate(12deg)', offset: 0.4 },
    { transform: 'translateX(-10px) rotate(-6deg)', offset: 0.6 },
    { transform: 'translateX(8px) rotate(4deg)', offset: 0.8 },
    { transform: 'translateX(0)' },
  ], // shake
];

export function trick(el: Element) {
  if (!calm()) el.animate(pick(TRICKS), { duration: 800, easing: 'ease-in-out' });
}

// Easter egg: the whole page cycles through the rainbow, with confetti.
export function partyMode() {
  burst(1.2);
  if (!calm()) document.documentElement.animate([{ filter: 'hue-rotate(0deg)' }, { filter: 'hue-rotate(360deg)' }], { duration: 1200, iterations: 2 });
}

// A random line from `list` that changes every few seconds.
export function useQuip(list: readonly string[], everyMs = 3500): string {
  const [i, setI] = useState(() => Math.floor(Math.random() * list.length));
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % list.length), everyMs);
    return () => clearInterval(id);
  }, [list, everyMs]);
  return list[i];
}

// Every button jiggles when clicked, and some taps throw out a random emoji.
export function installFun() {
  document.addEventListener('pointerdown', (e) => {
    if (e.isPrimary && Math.random() < 0.35) puff(e.clientX, e.clientY, undefined, 0.8);
  });
  document.addEventListener('click', (e) => {
    const button = e.target instanceof Element ? e.target.closest('button') : null;
    if (!button || calm()) return;
    button.classList.remove('jelly');
    void button.offsetWidth; // restart the animation on quick repeat clicks
    button.classList.add('jelly');
  });
  document.addEventListener('animationend', (e) => {
    if (e.animationName === 'jelly' && e.target instanceof Element) e.target.classList.remove('jelly');
  });
}
