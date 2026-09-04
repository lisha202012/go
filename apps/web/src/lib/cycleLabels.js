import { formatHillStepCampLine, describeFocusHillClimb } from './hillProgress';
import { formatHillSubtitle, formatHillTitle } from './hills';

export function formatStepProgressLine(activeStep) {
  if (!activeStep) return null;
  const hill = formatHillTitle(activeStep.hill);
  const campLine = formatHillStepCampLine({
    workingStep: activeStep.workingStep ?? activeStep.completedSteps + 1,
    completedSteps: activeStep.completedSteps ?? 0,
  });
  const progress = `${activeStep.missionsCompleted}/${activeStep.missionsTotal} missions this step`;
  return `${hill} · ${campLine} · ${progress}`;
}

export function formatFocusStepCampLine(focusHill, campProgress) {
  if (!focusHill) return null;
  return formatHillStepCampLine({
    workingStep: focusHill.workingStep ?? focusHill.completedSteps + 1,
    completedSteps: focusHill.completedSteps ?? campProgress?.currentStep ?? 0,
    hillLabel: formatHillTitle(focusHill),
  });
}

/** Structured Focus Hill copy for Home (clearer than a single · chain). */
export function getFocusHillClimbCopy(focusHill, campProgress) {
  const base = describeFocusHillClimb(focusHill, campProgress);
  return {
    ...base,
    hillName: focusHill ? formatHillTitle(focusHill) : base.hillName,
  };
}

export function formatCompletedStepHeadline(cycle) {
  if (!cycle) return 'Step complete';
  const step = cycle.stepNumber ?? cycle.completedSteps;
  return `Step ${step} complete · ${formatHillTitle(cycle.hill)}`;
}

export function formatNextStepIntro(pending) {
  if (!pending) return '';
  const step = pending.stepNumber ?? pending.cycleNumber;
  return `Step ${step} on ${formatHillTitle(pending.hill)} · ${formatHillSubtitle(pending.hill)}`;
}

export function formatCompletionDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

/** @deprecated Internal legacy fields only */
export function formatJourneyWeekRange(start, end) {
  if (start == null || end == null) return '';
  return `Block ${start}–${end}`;
}

/** @deprecated */
export function formatCycleLabel(cycleNumber, totalCycles = 7) {
  return `Hill rotation ${cycleNumber} of ${totalCycles}`;
}

export function formatCycleProgressLine(activeCycle) {
  if (!activeCycle?.hill) return null;
  return formatStepProgressLine({
    hill: activeCycle.hill,
    workingStep: activeCycle.cycleNumber,
    completedSteps: (activeCycle.cycleNumber ?? 1) - 1,
    missionsCompleted: activeCycle.missionsCompleted,
    missionsTotal: activeCycle.missionsTotal,
    currentCamp: null,
  });
}

export function formatCompletedCycleHeadline(cycle) {
  return formatCompletedStepHeadline(cycle);
}

export function formatNextCycleIntro(pending) {
  return formatNextStepIntro(pending);
}
