/**
 * Shared GAP ↔ mission-group mapping audit.
 * Ensures active GAP questions (order 1–5) align with missions-945.json group themes.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

export const ALL_GAP_CATEGORIES = ['S1E', 'S1G', 'S1R', 'A2', 'B3', 'C4', 'D5', 'V6', 'N7'];

export const GROUP_THEMES = {
  HOPE: {
    1: 'connection',
    2: 'listening / appreciation',
    3: 'kindness / generosity',
    4: 'support / check-in',
    5: 'repair / reconnection (often reverse-scored)',
  },
  HONE: {
    1: 'sleep / rest / recovery',
    2: 'movement / physical activity',
    3: 'nutrition / hydration',
    4: 'stress reset / emotional regulation',
    5: 'prevention / long-term protection (often reverse-scored)',
  },
  HOLD: {
    1: 'awareness / knowing your numbers',
    2: 'pause / impulse control before spending',
    3: 'saving / protecting money',
    4: 'planning ahead / future goals',
    5: 'purposeful spending (often reverse-scored)',
  },
  HOOD: {
    1: 'self-awareness / noticing feelings',
    2: 'keeping promises / commitment',
    3: 'values / integrity',
    4: 'pause / emotional regulation',
    5: 'boundaries / saying no (often reverse-scored)',
  },
  HOST: {
    1: 'follow-through / completing agreed tasks',
    2: 'initiative / helping without being asked',
    3: 'maintenance / caring for belongings',
    4: 'organising / resetting spaces',
    5: 'leaving things better (often reverse-scored)',
  },
  HORN: {
    1: 'choosing targets / clarity of goals',
    2: 'first step / starting action',
    3: 'persistence / try again after setback',
    4: 'learning / feedback',
    5: 'courage / uncomfortable growth (often reverse-scored)',
  },
  HOOK: {
    1: 'planning / prioritisation',
    2: 'focused attention / deep work',
    3: 'finish what you start',
    4: 'presence / being fully there',
    5: 'patience / waiting (often reverse-scored)',
  },
};

/** Keyword signals for each theme (lowercase match in GAP question text). */
export const THEME_KEYWORDS = {
  connection: ['connected', 'connection', 'quality time', 'conversation', 'reunite', 'face-to-face'],
  'listening / appreciation': ['listened', 'listening', 'appreciat', 'responded', 'ask & listen', 'before responding'],
  'kindness / generosity': ['kind', 'kindness', 'without expecting', 'generous'],
  'support / check-in': ['checked in', 'encouragement', 'support', 'show up', 'lighten'],
  'repair / reconnection (often reverse-scored)': [
    'avoided spending quality time',
    'apolog',
    'reconnect',
    'own your part',
    'hurt someone',
    'dismissive',
  ],
  'sleep / rest / recovery': ['sleep', 'rest', 'recovery', 'nap', 'tired'],
  'movement / physical activity': ['moved my body', 'physical activity', 'movement', 'stretch', 'exercise'],
  'nutrition / hydration': ['hydrated', 'hydration', 'meals', 'ate', 'nutrition', 'water', 'nourish'],
  'stress reset / emotional regulation': ['stress', 'reset', 'recover from stress', 'pressure', 'overwhelm'],
  'prevention / long-term protection (often reverse-scored)': [
    'long-term health',
    'prevention',
    'avoided physical activity',
    'illness',
    'future you',
  ],
  'awareness / knowing your numbers': ['tracked', 'numbers', 'snapshot', 'where my money', 'where they went'],
  'pause / impulse control before spending': [
    'worth the cost',
    'before choosing',
    'impulse',
    'delayed a purchase',
    'without paying attention',
  ],
  'saving / protecting money': ['protected money', 'save', 'saving', 'put something aside'],
  'planning ahead / future goals': ['prepared ahead', 'future expenses', 'future impact', 'look ahead', 'goal'],
  'purposeful spending (often reverse-scored)': ['priorities', 'purpose', 'matched my priorities', 'use it well'],
  'self-awareness / noticing feelings': ['paused before acting', 'emotions', 'named my feelings', 'reflect'],
  'keeping promises / commitment': ['commitment', 'promise', 'kept a commitment', 'follow through on'],
  'values / integrity': ['values', 'matched the values', 'aligned with'],
  'pause / emotional regulation': ['healthy ways to recover', 'healthy outlet', 'overwhelmed', 'pause'],
  'boundaries / saying no (often reverse-scored)': ['boundary', 'boundaries', 'abandoned personal commitments', 'limits'],
  'follow-through / completing agreed tasks': ['followed through', 'agreed to take care', 'close the loop'],
  'initiative / helping without being asked': ['helped at home', 'without always waiting', 'without being asked'],
  'maintenance / caring for belongings': ['belongings', 'organised', 'organized', 'fix', 'maintenance'],
  'organising / resetting spaces': ['clean', 'comfortable', 'pleasant', 'living environment', 'reset'],
  'leaving things better (often reverse-scored)': ['neglected', 'household issues', 'leave it better', 'put things back'],
  'choosing targets / clarity of goals': ['working towards', 'challenge', 'grow', 'priority', 'clear sense'],
  'first step / starting action': ['acted on an important priority', 'started', 'first step', 'rather than only thinking'],
  'persistence / try again after setback': ['returned to an important goal', 'after a setback', 'try again', 'setback'],
  'learning / feedback': ['feedback', 'learn', 'lesson', 'improve'],
  'courage / uncomfortable growth (often reverse-scored)': ['avoided feedback', 'uncomfortable', 'risk', 'challenging'],
  'planning / prioritisation': ['planned my time', 'priorities', 'important things', 'room for important'],
  'focused attention / deep work': ['distractions', 'concentrate', 'focused', 'interruptions', 'multitasking'],
  'finish what you start': ['finish', 'close the loop', 'deadline', 'undone'],
  'presence / being fully there': ['attention to the person', 'in front of me', 'presence', 'fully there'],
  'patience / waiting (often reverse-scored)': ['impatient', 'wait', 'unnecessarily impatient'],
};

function keywordMatches(lower, kw) {
  const k = kw.toLowerCase();
  if (k.length <= 3) {
    return new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower);
  }
  return lower.includes(k);
}

export function themeForText(text) {
  const lower = text.toLowerCase();
  const scores = [];
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (keywordMatches(lower, kw)) score += 1;
    }
    if (score > 0) scores.push({ theme, score });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.theme ?? 'unclassified';
}

export function classifyQuestion(hillCode, order, text) {
  const expectedTheme = GROUP_THEMES[hillCode][order];
  const detectedTheme = themeForText(text);
  const expectedNorm = expectedTheme.toLowerCase();
  const detectedNorm = detectedTheme.toLowerCase();

  let status = 'mismatch';
  if (detectedTheme === 'unclassified') {
    status = 'unclassified';
  } else if (detectedNorm === expectedNorm || detectedTheme === expectedTheme) {
    status = 'match';
  } else if (
    detectedNorm.includes(expectedNorm.split('/')[0].trim()) ||
    expectedNorm.includes(detectedNorm.split('/')[0].trim())
  ) {
    status = 'partial';
  }

  return { expectedTheme, detectedTheme, status };
}

function loadGapActiveQuestions() {
  const gapAll = JSON.parse(readFileSync(join(DATA_DIR, 'gap-945.json'), 'utf8')).questions.filter(
    (q) => q.order <= 5,
  );
  return gapAll;
}

function loadMissions() {
  return JSON.parse(readFileSync(join(DATA_DIR, 'missions-945.json'), 'utf8')).missions;
}

/**
 * @param {object} [options]
 * @param {string[] | 'all'} [options.categories]
 * @param {boolean} [options.requireDistinctCategories] - fail if all categories share identical text per slot
 */
export function auditGapMissionMapping(options = {}) {
  let categories =
    options.categories === 'all' || options.categories == null
      ? ALL_GAP_CATEGORIES
      : options.categories;

  if (typeof categories === 'string') {
    categories = [categories];
  }

  const missions = loadMissions();
  const gapAll = loadGapActiveQuestions();
  const hills = Object.keys(GROUP_THEMES);

  const results = [];
  const structuralIssues = [];

  for (const categoryCode of categories) {
    for (const hillCode of hills) {
      const groupTitles = {};
      for (let g = 1; g <= 5; g++) {
        groupTitles[g] = missions
          .filter((m) => m.categoryCode === categoryCode && m.hillCode === hillCode && m.missionGroup === g)
          .map((m) => m.title);
      }

      const questions = gapAll
        .filter((q) => q.categoryCode === categoryCode && q.hillCode === hillCode)
        .sort((a, b) => a.order - b.order);

      for (const q of questions) {
        const missionGroup = q.missionGroup ?? q.order;
        if (missionGroup !== q.order) {
          structuralIssues.push({
            categoryCode,
            hillCode,
            order: q.order,
            missionGroup,
            issue: 'order !== missionGroup',
          });
        }

        const { expectedTheme, detectedTheme, status } = classifyQuestion(hillCode, q.order, q.text);
        results.push({
          categoryCode,
          hillCode,
          order: q.order,
          missionGroup: q.order,
          text: q.text,
          isReverseScored: q.isReverseScored,
          expectedTheme,
          detectedTheme,
          missionTitles: groupTitles[q.order] ?? [],
          status,
        });
      }
    }
  }

  const counts = { match: 0, partial: 0, mismatch: 0, unclassified: 0 };
  for (const r of results) counts[r.status]++;

  const passCount = counts.match + counts.partial;
  const total = results.length;
  const passRate = total === 0 ? 0 : passCount / total;

  let distinctCategoriesOk = true;
  const distinctViolations = [];
  if (options.requireDistinctCategories && categories.length >= 2) {
    const slots = new Map();
    for (const q of gapAll.filter((q) => categories.includes(q.categoryCode))) {
      const key = `${q.hillCode}|${q.order}`;
      if (!slots.has(key)) slots.set(key, new Map());
      slots.get(key).set(q.categoryCode, q.text);
    }
    for (const [slot, byCat] of slots) {
      const texts = [...byCat.values()];
      if (new Set(texts).size === 1 && byCat.size === categories.length) {
        distinctCategoriesOk = false;
        distinctViolations.push(slot);
      }
    }
  }

  const ok =
    structuralIssues.length === 0 &&
    counts.mismatch === 0 &&
    counts.unclassified === 0 &&
    distinctCategoriesOk;

  return {
    ok,
    categories,
    total,
    counts,
    passCount,
    passRate,
    structuralIssues,
    distinctCategoriesOk,
    distinctViolations,
    results,
  };
}
