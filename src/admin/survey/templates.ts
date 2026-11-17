import type { SurveyDraft, SurveyQuestion, SurveyType } from '../../../shared/survey';
import { DEFAULT_APP_NAME } from '../../../shared/constants';
import { defaultSurveyQuestion } from '../../../shared/survey';

const q = (type: SurveyType, patch: Partial<SurveyQuestion>): SurveyQuestion => ({ ...defaultSurveyQuestion(type), ...patch });

// Feedback for the eDAP Offsite sessions, leadership deep dives, icebreakers, and team activities.
export const EDAP_OFFSITE_REVIEW: SurveyDraft = {
  id: '',
  title: 'eDAP Offsite — The Review 🍿',
  intro: 'We connected, collaborated, and deep-dived together 🤿 Now it’s your turn to review the offsite! About 3 minutes — your honest answers shape the next eDAP Offsite 💛',
  thanks: 'Dhanyavaad! 🙏 Your review just hit the box office. Now go grab a chai ☕',
  questions: [
    // 🎬 The big picture
    q('poll', {
      text: 'If eDAP Offsite were a movie, what’s the box-office verdict? 🎬',
      options: ['All-time blockbuster 🏆', 'Superhit 🔥', 'Hit 👍', 'Average 😐', 'Flop 🍅'],
    }),
    q('scale', {
      text: 'How likely are you to recommend an eDAP Offsite like this to a colleague in another team?',
      hint: '0 = not a chance · 10 = absolutely',
      min: 0, max: 10, minLabel: 'Not a chance 🙅', maxLabel: 'Already forwarding it 📨', display: 'gauge',
    }),
    // 🎤 Sessions & icebreakers
    q('scale', { text: 'How well did the icebreaker game warm up the room? 🔥', minLabel: 'Still frozen 🧊', maxLabel: 'Room on fire 🔥' }),
    q('multi', {
      text: 'Your favourite icebreaker moments? ⭐',
      hint: 'Pick up to 3 · skip if you missed the session',
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
    // 🤿 Leadership & strategy deep dives
    q('poll', {
      text: 'The strategy & deep-dive sessions felt most like... 🏏',
      options: [
        'A Test match: thorough, thoughtful, worth every session',
        'A T20: fast, high-energy, over too soon ⚡',
        'A Super Over: intense and action-packed 🔥',
        'A DRS review: every detail under the microscope 🔍',
        'I missed them 🙈',
      ],
    }),
    q('scale', {
      text: 'How useful were the strategy & deep-dive conversations for your team? 🎯',
      hint: 'Skip if you missed them',
      required: false, minLabel: 'Just slides 😶', maxLabel: 'Game-changer 🚀',
    }),
    q('scale', {
      text: 'How heard and connected did your team feel? 👂',
      hint: 'Skip if you missed them',
      required: false, minLabel: 'Like a muted Teams call 🔇', maxLabel: 'Every word landed 🎯',
    }),
    q('wordcloud', { text: 'One word for the eDAP Offsite vibe ☁️', hint: 'First word that comes to mind', required: false }),
    // 🎨 Team bonding
    q('animal', {
      text: 'Which animal were you during the team activities? 🎨',
      hint: 'Skip if you missed the activities',
      required: false,
      options: ['ant', 'bee', 'owl', 'monkey', 'peacock', 'tortoise', 'elephant', 'badger'],
      display: 'bars',
    }),
    q('scale', {
      text: 'Did the offsite bring the team closer together? 🫶',
      required: false, minLabel: 'Still warming up 🌱', maxLabel: 'Basically family now 🫶',
    }),
    // 🍛 Logistics
    q('poll', {
      text: 'The offsite pace & length were... ⏱️',
      options: ['Too short, I wanted more 😩', 'Just right 👌', 'A bit long, my chai wore off ☕', 'Too long, I aged a year 👴'],
    }),
    q('scale', { text: 'Rate the food & refreshments 🍛', required: false, minLabel: 'Hunger games 😵', maxLabel: 'Shaadi-level feast 🤤' }),
    // 🚀 Next time
    q('multi', {
      text: 'What should the next eDAP Offsite include? 🚀',
      hint: 'Pick up to 3',
      required: false,
      maxPicks: 3,
      options: [
        '🏏 Box-cricket tournament',
        '💻 Mini hackathon',
        '🗺️ Treasure hunt',
        '🎤 Karaoke & open mic',
        '🍳 Cooking challenge',
        '🎨 Creative team workshop',
        '🏔️ Outdoor adventure',
        '🎲 Board games & chai',
      ],
    }),
    q('open', {
      text: 'One thing we must KEEP, and one thing to CHANGE next time ✍️',
      hint: 'Please don’t name colleagues — focus on the event',
    }),
    q('wordcloud', { text: 'Sum up the whole offsite as an HTTP status code 🌐', hint: 'e.g. 200 OK, 201 Created, 418 I’m a teapot', required: false }),
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

export const SURVEY_TEMPLATES = [EDAP_OFFSITE_REVIEW, QUICK_PULSE];

export function surveyTemplates(appName = DEFAULT_APP_NAME): SurveyDraft[] {
  const label = appName.trim() || DEFAULT_APP_NAME;
  if (label === DEFAULT_APP_NAME) return SURVEY_TEMPLATES;
  const sub = (s: string) => s.replaceAll('eDAP Offsite', label);
  return [
    {
      ...EDAP_OFFSITE_REVIEW,
      title: sub(EDAP_OFFSITE_REVIEW.title),
      intro: sub(EDAP_OFFSITE_REVIEW.intro),
      questions: EDAP_OFFSITE_REVIEW.questions.map((x) => ({ ...x, text: sub(x.text) })),
    },
    QUICK_PULSE,
  ];
}
