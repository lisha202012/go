/** 1 = Never … 5 = Always — literal label meaning; reverse scoring is server-side only. */
export const GAP_ANSWER_OPTIONS = [
  { value: 1, label: 'Never' },
  { value: 2, label: 'Rarely' },
  { value: 3, label: 'Sometimes' },
  { value: 4, label: 'Often' },
  { value: 5, label: 'Always' },
];

export function getFlowStatusLabel(flowIndex) {
  const n = Number(flowIndex) || 0;
  if (n <= 40) return 'Needs Attention';
  if (n <= 55) return 'Emerging FLOW';
  if (n <= 70) return 'Growing FLOW';
  if (n <= 85) return 'Strong FLOW';
  return 'Superb FLOW';
}

export function getHillStrengthLabel(flowPercent) {
  const n = Number(flowPercent) || 0;
  if (n <= 40) return 'Needs Attention';
  if (n <= 60) return 'Developing';
  if (n <= 80) return 'Strong';
  return 'Superb';
}

export { HILL_ICONS } from './gapRating';
