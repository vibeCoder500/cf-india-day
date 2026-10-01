import type { Question } from '../../shared/protocol';
import { ANIMAL_KEYS, defaultQuestion } from '../../shared/constants';

const q = (type: Question['type'], patch: Partial<Question>): Question => ({ ...defaultQuestion(type), ...patch });

export const STARTER_PACK: Question[] = [
  q('wordcloud', { text: 'Describe CorpFun in one word ✨', maxEntries: 2 }),
  q('poll', { text: 'Chai or coffee?', options: ['Chai 🫖', 'Coffee ☕'], display: 'versus' }),
  q('scale', { text: 'How excited are you for today’s townhall?', minLabel: 'Still waking up 😴', maxLabel: 'Super pumped 🤩', display: 'gauge' }),
  q('quiz', { text: 'Which festival is known as the Festival of Lights?', options: ['Holi', 'Diwali', 'Onam', 'Pongal'], correct: 1 }),
  q('poll', { text: 'Your ideal weekend?', options: ['Netflix & chill 🛋️', 'Travel 🏔️', 'Food hunt 🍲', 'Sports 🏏', 'Sleep 😴'], display: 'bubbles' }),
  q('quiz', { text: 'How many states does India have?', options: ['27', '28', '29', '30'], correct: 1 }),
  q('open', { text: 'A fun fact about you that most colleagues don’t know 🤫', moderate: true }),
  q('quiz', { text: 'Which city is called the “Silicon Valley of India”?', options: ['Hyderabad', 'Pune', 'Bengaluru', 'Gurugram'], correct: 2, points: 2 }),
  q('number', { text: 'Guess India’s north–south length, Kashmir to Kanyakumari', min: 0, max: 10000, unit: 'km', correct: 3214 }),
  q('poll', { text: 'Best street food?', options: ['Pani puri', 'Vada pav', 'Momos', 'Chole bhature', 'Dosa'], display: 'donut' }),
  q('quiz', { text: 'What is India’s national animal?', options: ['Lion', 'Elephant', 'Bengal tiger', 'Peacock'], correct: 2, timer: 15 }),
  q('wordcloud', { text: 'One word for what you want from this townhall', maxEntries: 1 }),
];

const animal = (text: string, keys: string[] = ANIMAL_KEYS): Question => q('animal', { text, options: [...keys] });

export const ANIMAL_PACK: Question[] = [
  animal('Which traits describe how you typically contribute—not just who you aspire to be?'),
  animal('A deadline is 2 hours away ⏰ — which animal shows up?'),
  animal('Which animal are you in a brainstorming session? 💡'),
  animal('A project hits a roadblock 🚧 — which animal are you?'),
  animal('How do you like to learn something new? 📚'),
  animal('Which animal are you on a Monday morning? ☕'),
  animal('How do you show up for your teammates? 🤝'),
  animal('Which animal are you when you lead a project? 🧭'),
  animal('Working from home 🏠 — which animal are you?', ['cat', 'dog', 'owl', 'tortoise', 'monkey', 'bee']),
  animal('Which animal would your teammates say you are? 😄'),
];
