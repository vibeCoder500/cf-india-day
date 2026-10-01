import type { SurveyDraft, SurveyQuestion, SurveyType } from '../../../shared/survey';
import { defaultSurveyQuestion } from '../../../shared/survey';

const q = (type: SurveyType, patch: Partial<SurveyQuestion>): SurveyQuestion => ({ ...defaultSurveyQuestion(type), ...patch });

// Feedback for the townhall + icebreaker, the deep dives with Mohit and the team painting. Wording and in-jokes match
// the questions people played on the day.
export const CORPFUN_REVIEW: SurveyDraft = {
  id: '',
  title: 'CorpFun Day — The Review 🍿',
  intro: 'Mohit came, saw and deep-dived 🤿 Now it’s your turn to review the show! About 3 minutes — your honest answers shape the next CorpFun Day 💛',
  thanks: 'Dhanyavaad! 🙏 Your review just hit the box office. Now go grab a chai ☕',
  questions: [
    // 🎬 The big picture
    q('poll', {
      text: 'If CorpFun Day were a movie, what’s the box-office verdict? 🎬',
      options: ['All-time blockbuster 🏆', 'Superhit 🔥', 'Hit 👍', 'Average 😐', 'Flop 🍅'],
    }),
    q('scale', {
      text: 'How likely are you to recommend a CorpFun Day to a friend in another team?',
      hint: '0 = not a chance · 10 = absolutely',
      min: 0, max: 10, minLabel: 'Not a chance 🙅', maxLabel: 'Already forwarding it 📨', display: 'gauge',
    }),
    // 🎤 Townhall & icebreakers
    q('scale', { text: 'How well did the icebreaker game warm up the townhall? 🔥', minLabel: 'Still frozen 🧊', maxLabel: 'Room on fire 🔥' }),
    q('multi', {
      text: 'Your favourite icebreaker moments? ⭐',
      hint: 'Pick up to 3 · skip if you missed the townhall',
      required: false,
      maxPicks: 3,
      options: [
        '☀️ Did you see the sun this morning?',
        '🚦 The traffic-junction showdown',
        '😈 Plot twist: your manager joins the trip',
        '🎬 Our codebase as an Indian movie title',
        '🌐 My AI-wave mood as an HTTP status code',
        '👻 3-word horror stories for SWEs & PMs',
        '🤖 What I’d do if an AI clone did my job',
        '🐾 The spirit-animal census',
      ],
    }),
    // 🤿 Deep dives with Mohit
    q('poll', {
      text: 'Your team’s deep dive with Mohit was most like... 🏏',
      options: [
        'A Test match: long, thorough, worth every session',
        'A T20: fast, high-energy, over too soon ⚡',
        'A Super Over: intense and nail-biting 😬',
        'A DRS review: every slide under the microscope 🔍',
        'I wasn’t in one 🙈',
      ],
    }),
    q('scale', {
      text: 'How useful was the deep-dive conversation for your team? 🎯',
      hint: 'Skip if you weren’t in one',
      required: false, minLabel: 'Just slides 😶', maxLabel: 'Game-changer 🚀',
    }),
    q('scale', {
      text: 'How heard did your team feel? 👂',
      hint: 'Skip if you weren’t in one',
      required: false, minLabel: 'Like a muted Teams call 🔇', maxLabel: 'Every word landed 🎯',
    }),
    q('poll', {
      text: 'Was the deep-dive prep worth it? 🌙',
      required: false,
      options: ['Totally worth the late nights 🚀', 'Worth it, but phew 😮‍💨', 'Too much prep for the time we got ⏳', 'Wasn’t part of the prep 🙋'],
    }),
    q('wordcloud', { text: 'One word for meeting Mohit ☁️', hint: 'First word that comes to mind', required: false }),
    // 🎨 Team painting
    q('animal', {
      text: 'Which animal were you during the team painting? 🎨',
      hint: 'Skip if you missed the painting',
      required: false,
      options: ['ant', 'bee', 'owl', 'monkey', 'peacock', 'tortoise', 'elephant', 'badger'],
      display: 'bars',
    }),
    q('scale', {
      text: 'Did the painting bring your team closer? 🫶',
      hint: 'Skip if you missed it',
      required: false, minLabel: 'Still fighting over colours 🎨', maxLabel: 'Basically family now 🫶',
    }),
    // 🍛 Logistics
    q('poll', {
      text: 'The day’s length was... ⏱️',
      options: ['Too short, I wanted more 😩', 'Just right 👌', 'A bit long, my chai wore off ☕', 'Too long, I aged a year 👴'],
    }),
    q('scale', { text: 'Rate the food 🍛', required: false, minLabel: 'Hunger games 😵', maxLabel: 'Shaadi-level feast 🤤' }),
    // 🚀 Next time
    q('multi', {
      text: 'What should the next CorpFun Day include? 🚀',
      hint: 'Pick up to 3',
      required: false,
      maxPicks: 3,
      options: [
        '🏏 Box-cricket tournament',
        '💻 Mini hackathon',
        '🗺️ Office treasure hunt',
        '🎤 Karaoke & open mic',
        '🍳 Cooking challenge',
        '🎨 Another painting session',
        '🏔️ Day trip / offsite',
        '🎲 Board games & chai',
      ],
    }),
    q('open', {
      text: 'One thing we must KEEP, and one thing to CHANGE next time ✍️',
      hint: 'Please don’t name colleagues — focus on the event',
    }),
    q('wordcloud', { text: 'Sum up the whole day as an HTTP status code 🌐', hint: 'e.g. 200 OK, 201 Created, 418 I’m a teapot', required: false }),
  ],
};

// A short generic pulse for any future event.
export const QUICK_PULSE: SurveyDraft = {
  id: '',
  title: 'Quick pulse ⚡',
  intro: 'Five quick taps — tell us how it went.',
  thanks: 'Thanks! 🙌',
  questions: [
    q('scale', { text: 'How was it, overall?', minLabel: 'Not great 😕', maxLabel: 'Loved it! 🤩' }),
    q('scale', { text: 'How likely are you to recommend it to a colleague?', min: 0, max: 10, minLabel: 'Not at all', maxLabel: 'Absolutely', display: 'gauge' }),
    q('poll', { text: 'The length was...', options: ['Too short', 'Just right', 'Too long'] }),
    q('open', { text: 'What should we keep, or change?' }),
    q('wordcloud', { text: 'One word for it', required: false }),
  ],
};

export const SURVEY_TEMPLATES = [CORPFUN_REVIEW, QUICK_PULSE];
