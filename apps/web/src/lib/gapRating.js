/** Maps 1–5 self-ratings to 0–100 GAP scores. */
export const RATING_TO_SCORE = {
  1: 20,
  2: 40,
  3: 60,
  4: 80,
  5: 100,
};

export function ratingToScore(rating) {
  return RATING_TO_SCORE[rating] ?? null;
}

/** Human-friendly growth levels — still map to 1–5 for scoring. */
export const GROWTH_LEVELS = [
  {
    value: 1,
    label: 'Just planted',
    hint: 'Still early — I want to grow here',
    emoji: '🌱',
  },
  {
    value: 2,
    label: 'Sprouting',
    hint: 'Small wins, still building the habit',
    emoji: '🌿',
  },
  {
    value: 3,
    label: 'Growing steady',
    hint: 'Shows up sometimes — room to climb',
    emoji: '🌳',
  },
  {
    value: 4,
    label: 'Strong',
    hint: 'A reliable part of who I am',
    emoji: '⭐',
  },
  {
    value: 5,
    label: 'Flourishing',
    hint: 'One of my brightest strengths',
    emoji: '🏔️',
  },
];

export const HILL_ICONS = {
  HOPE: '👨‍👩‍👧',
  HONE: '💪',
  HOLD: '💰',
  HOOD: '💆',
  HOST: '🏠',
  HORN: '🎯',
  HOOK: '⏰',
};
