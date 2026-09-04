export type WeeklyChakraHill = {
  hillCode: string;
  hillName: string;
  /** Day 1–7 in this FLOW week (GAP ranking order). */
  dayIndex: number;
  /** True when this hill is today's Home Hill. */
  isToday: boolean;
  /** True when this hill's calendar day is earlier in the current FLOW week. */
  isPast: boolean;
  /** True when that hill's 3 prescribed missions are complete this week. */
  activated: boolean;
  prescribedCompleted: number;
  /** Extra (+10) bonus missions done today — glow as +N on today's Home Hill only. */
  extraCompleted: number;
  /** 0 inactive · 1–2 pulses · 3 activated (3/3). */
  pulses: number;
};

export type WeeklyChakraStats = {
  activated: number;
  total: number;
  perfectWeek: boolean;
  todayHillCode: string | null;
  hills: WeeklyChakraHill[];
};

export const EMPTY_WEEKLY_CHAKRAS: WeeklyChakraStats = {
  activated: 0,
  total: 7,
  perfectWeek: false,
  todayHillCode: null,
  hills: [],
};

/** FLOW chakras: one per hill; extra mission dots stay with the actual hill they were completed on. */
export function summarizeWeeklyChakras(
  days: Array<{
    dayIndex?: number;
    hillCode: string;
    hillName: string;
    dailyFlowComplete: boolean;
    prescribedCompleted: number;
    extraCompleted?: number;
    isToday?: boolean;
    isPast?: boolean;
  }>,
  extraCompletedByHillCode: Record<string, number> = {},
): WeeklyChakraStats {
  const hills = days.map((d, i) => {
    const completed = Math.min(3, Math.max(0, d.prescribedCompleted));
    const pulses = d.dailyFlowComplete ? 3 : completed;
    const isToday = Boolean(d.isToday);
    const extraCompleted = Math.max(0, extraCompletedByHillCode[d.hillCode] ?? d.extraCompleted ?? 0);
    return {
      hillCode: d.hillCode,
      hillName: d.hillName,
      dayIndex: d.dayIndex ?? i + 1,
      isToday,
      isPast: Boolean(d.isPast),
      activated: d.dailyFlowComplete,
      prescribedCompleted: completed,
      extraCompleted,
      pulses,
    };
  });
  const activated = hills.filter((h) => h.activated).length;
  return {
    activated,
    total: hills.length || 7,
    perfectWeek: hills.length > 0 && hills.every((h) => h.activated),
    todayHillCode: hills.find((h) => h.isToday)?.hillCode ?? null,
    hills,
  };
}
