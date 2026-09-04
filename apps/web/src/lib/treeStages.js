/** Tree of Life stages 1–10 — clean tree art (pictures/tree of stars/stage N New.png). */

export const TREE_STAGES = [
  { level: 1, stage: 'Seedling Tree', bg: '/images/tree-stages/stage-01.png' },
  { level: 2, stage: 'Sprouting Tree', bg: '/images/tree-stages/stage-02.png' },
  { level: 3, stage: 'Young Tree', bg: '/images/tree-stages/stage-03.png' },
  { level: 4, stage: 'Flourishing Tree', bg: '/images/tree-stages/stage-04.png' },
  { level: 5, stage: 'Blossoming Tree', bg: '/images/tree-stages/stage-05.png' },
  { level: 6, stage: 'Fruiting Tree', bg: '/images/tree-stages/stage-06.png' },
  { level: 7, stage: 'Ancient Tree', bg: '/images/tree-stages/stage-07.png' },
  { level: 8, stage: 'Radiant Tree', bg: '/images/tree-stages/stage-08.png' },
  { level: 9, stage: 'Sacred Tree', bg: '/images/tree-stages/stage-09.png' },
  { level: 10, stage: 'Tree of FLOW', bg: '/images/tree-stages/stage-10.png' },
];

const FALLBACK_BG = '/images/tree-of-life-bg.png';

/** Map TreeLevel enum (API) or numeric level → 1–10. */
export function normalizeTreeLevel(treeLevel) {
  if (typeof treeLevel === 'number' && Number.isFinite(treeLevel)) {
    return Math.min(10, Math.max(1, Math.round(treeLevel)));
  }
  const byEnum = {
    Seedling: 1,
    Sprouting: 2,
    YoungTree: 3,
    Flourishing: 4,
    Blossoming: 5,
    Fruiting: 6,
    Ancient: 7,
    Radiant: 8,
    Sacred: 9,
    TreeOfFlow: 10,
  };
  if (typeof treeLevel === 'string' && byEnum[treeLevel]) return byEnum[treeLevel];
  return 1;
}

export function getTreeStage(treeLevel) {
  const level = normalizeTreeLevel(treeLevel);
  return TREE_STAGES[level - 1] ?? TREE_STAGES[0];
}

export function getTreeStageBackground(treeLevel) {
  return getTreeStage(treeLevel)?.bg ?? FALLBACK_BG;
}
