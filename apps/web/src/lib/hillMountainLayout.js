import { CAMP_CHECKPOINTS, STEPS_PER_HILL } from './hillProgress';

/**
 * Trail positions tuned to public/images/hill-mountain.jpg
 * (percent coords, origin top-left).
 */
export const HILL_TRAIL_ANCHORS = [
  { step: 0, x: 48, y: 94.5, label: 'BASE', campNum: 0 },
  { step: 1, x: 52, y: 86, label: 'CAMP 1', campNum: 1 },
  { step: 3, x: 45, y: 78.5, label: 'CAMP 2', campNum: 2 },
  { step: 7, x: 54, y: 70.5, label: 'CAMP 3', campNum: 3 },
  { step: 14, x: 46, y: 61.5, label: 'CAMP 4', campNum: 4 },
  { step: 21, x: 53, y: 52.5, label: 'CAMP 5', campNum: 5 },
  { step: 35, x: 47, y: 39.5, label: 'CAMP 6', campNum: 6 },
  { step: 49, x: 50, y: 10.5, label: 'SUMMIT', campNum: 7 },
];

export function trailPointForStep(step) {
  const safe = Math.max(0, Math.min(STEPS_PER_HILL, Number(step) || 0));
  const anchors = HILL_TRAIL_ANCHORS;
  if (safe <= anchors[0].step) return { ...anchors[0], step: safe };
  if (safe >= anchors[anchors.length - 1].step) return { ...anchors[anchors.length - 1], step: safe };

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (safe >= a.step && safe <= b.step) {
      const t = b.step === a.step ? 0 : (safe - a.step) / (b.step - a.step);
      return {
        step: safe,
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        label: '',
        campNum: 0,
      };
    }
  }
  return { ...anchors[0], step: safe };
}

export function glowLevelForMissionIndex(index, dailyFlowComplete) {
  if (dailyFlowComplete) return { level: '7–8', label: 'Chakra activated', activated: true };
  if (index >= 2) return { level: '7–8', label: 'Hill activated', activated: true };
  if (index >= 1) return { level: '4', label: `Pulse ${index + 1}`, activated: false };
  return { level: '4', label: 'Pulse 1', activated: false };
}

export { CAMP_CHECKPOINTS, STEPS_PER_HILL };
