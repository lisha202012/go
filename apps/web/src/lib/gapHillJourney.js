/** Fixed GAP question block order (matches seed — 15 questions per hill). */
export const GAP_HILL_JOURNEY_ORDER = ['HOPE', 'HONE', 'HOLD', 'HOOD', 'HOST', 'HORN', 'HOOK'];

export const GAP_QUESTIONS_PER_HILL = 5;
export const GAP_TOTAL_QUESTIONS = 35;

/** Slight vertical offset per icon for intro arc layout (index in journey order). */
export const GAP_HILL_ARC_OFFSETS = [0, 4, 8, 10, 8, 4, 0];

export function enrichQuestionsWithHills(questions, hills) {
  const hillById = new Map((hills ?? []).map((h) => [h.id, h]));
  return (questions ?? []).map((q) => ({
    ...q,
    hill: hillById.get(q.hillId) ?? null,
  }));
}

export function buildHillProgress(questions, gapResponses) {
  const answeredIds = new Set((gapResponses ?? []).map((r) => r.questionId));
  const progress = {};

  for (const code of GAP_HILL_JOURNEY_ORDER) {
    progress[code] = { answered: 0, total: 0, complete: false };
  }

  for (const q of questions ?? []) {
    const code = q.hill?.code;
    if (!code || !progress[code]) continue;
    progress[code].total += 1;
    if (answeredIds.has(q.id)) progress[code].answered += 1;
  }

  for (const code of GAP_HILL_JOURNEY_ORDER) {
    const entry = progress[code];
    entry.complete =
      entry.total > 0
        ? entry.answered >= Math.min(GAP_QUESTIONS_PER_HILL, entry.total)
        : entry.answered >= GAP_QUESTIONS_PER_HILL;
  }

  return progress;
}

export function hillColor(code, hill) {
  return hill?.colorTheme ?? null;
}

/** Placeholder hills for GAP intro Tree of Life (all locked until assessment). */
export function buildGapPreviewHills(hillsByCode = {}) {
  return GAP_HILL_JOURNEY_ORDER.map((code) => ({
    code,
    name: hillsByCode[code]?.name ?? code,
    score: null,
    status: '',
  }));
}
