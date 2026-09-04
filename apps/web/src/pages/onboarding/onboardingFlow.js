import { STEPS } from './onboardingSteps';
import { deriveAgeCategoryFromDob, isAdultJourneyEligible, isSproutAgeCategory, parseDateOnly } from '../../lib/deriveAgeFromDob';

export function deriveCategoryFromState({ dateOfBirth, user }) {
  if (user?.ageGroup && !dateOfBirth) return user.ageGroup;
  if (!dateOfBirth) return null;
  const dob = parseDateOnly(dateOfBirth);
  if (!dob) return null;
  return deriveAgeCategoryFromDob(dob);
}

export function stepApplies(stepKey, { derivedCategory, user }) {
  if (stepKey === 'sproutGuardian') {
    return isSproutAgeCategory(derivedCategory) && user?.guardianSupported == null;
  }
  if (stepKey === 'journeyRole') {
    return isAdultJourneyEligible(derivedCategory) && !user?.journeyRole;
  }
  return true;
}

export function nextApplicableStep(fromIndex, state) {
  let i = fromIndex + 1;
  while (i < STEPS.length && !stepApplies(STEPS[i], state)) i += 1;
  return Math.min(i, STEPS.length - 1);
}

export function prevApplicableStep(fromIndex, state) {
  let i = fromIndex - 1;
  while (i >= 0 && !stepApplies(STEPS[i], state)) i -= 1;
  return Math.max(i, 0);
}

export function visibleStepCount(state) {
  return STEPS.filter((key) => stepApplies(key, state)).length;
}

export function visibleStepIndex(stepIndex, state) {
  const key = STEPS[stepIndex];
  if (!key) return 0;
  let count = 0;
  for (let i = 0; i <= stepIndex; i += 1) {
    if (stepApplies(STEPS[i], state)) count += 1;
  }
  return Math.max(0, count - 1);
}
