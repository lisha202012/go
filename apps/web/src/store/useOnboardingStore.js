import { create } from 'zustand';
import { STEPS, PROFILE_STEP_INDEX, GAP_STEP_INDEX, REPORT_STEP_INDEX } from '../pages/onboarding/onboardingSteps';
import { stepApplies, deriveCategoryFromState } from '../pages/onboarding/onboardingFlow';

const STORAGE_KEY = 'gofam-onboarding';

const DEFAULT_STATE = {
  stepIndex: 0,
  avatarUrl: null,
  displayName: '',
  username: '',
  dateOfBirth: '',
  familyDetails: {
    familyName: '',
    myRole: '',
    pendingMembers: [],
  },
  seedId: null,
  gapResponses: [],
  assessmentResult: null,
  unlockedMission: null,
  journeyPlan: null,
  missionOptions: [],
  growthReportPhase: 0,
  bloomedVirtue: null,
  gofamWeekStartDay: null,
};

function normalizeGrowthReportPhase(phase) {
  if (typeof phase !== 'number') return 0;
  // Old 4-step report (0–3) → new 2-step (0=results, 1=missions).
  if (phase >= 1) return 1;
  return 0;
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Remap legacy saved indices (family removed from pre-GAP path).
    if (typeof parsed.stepIndex === 'number') {
      if (parsed.stepIndex === 4) parsed.stepIndex = GAP_STEP_INDEX;
      else if (parsed.stepIndex >= 7) parsed.stepIndex = REPORT_STEP_INDEX;
      else if (parsed.stepIndex === 6) parsed.stepIndex = REPORT_STEP_INDEX;
    }
    if (typeof parsed.growthReportPhase === 'number') {
      parsed.growthReportPhase = normalizeGrowthReportPhase(parsed.growthReportPhase);
    }
    return parsed;
  } catch {
    return null;
  }
}

function toPersistable(state) {
  return {
    stepIndex: state.stepIndex,
    avatarUrl: state.avatarUrl,
    displayName: state.displayName,
    username: state.username,
    dateOfBirth: state.dateOfBirth,
    familyDetails: state.familyDetails,
    seedId: state.seedId,
    gapResponses: state.gapResponses,
    assessmentResult: state.assessmentResult,
    unlockedMission: state.unlockedMission,
    journeyPlan: state.journeyPlan,
    missionOptions: state.missionOptions,
    growthReportPhase: state.growthReportPhase,
    bloomedVirtue: state.bloomedVirtue,
    gofamWeekStartDay: state.gofamWeekStartDay,
  };
}

function persistState(get) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersistable(get())));
  } catch {
    // fail silently (e.g. private browsing)
  }
}

const persisted = loadPersisted();
const initialState = {
  ...DEFAULT_STATE,
  ...persisted,
};

export const USERNAME_STEP_INDEX = PROFILE_STEP_INDEX;
/** @deprecated Family step removed from pre-GAP wizard. */
export const FAMILY_STEP_INDEX = 4;
export { PROFILE_STEP_INDEX, STEPS, GAP_STEP_INDEX, REPORT_STEP_INDEX };
/** @deprecated Glow seed step removed from onboarding. */
export const GLOW_STEP_INDEX = GAP_STEP_INDEX;

const TEMP_USERNAME = /^u_[a-f0-9]{12}$/;

export function hasCompletedProfileSteps(user) {
  return Boolean(
    user?.displayName?.trim() &&
      user?.username &&
      !TEMP_USERNAME.test(user.username) &&
      (user.dateOfBirth || user.ageGroup),
  );
}

function onboardingFlowState(user, dateOfBirth) {
  return {
    derivedCategory: deriveCategoryFromState({ dateOfBirth: dateOfBirth || user?.dateOfBirth, user }),
    user,
  };
}

/** Resume wizard at the correct step after reload. */
export function resolveOnboardingResumeStep(user, savedStepIndex, { hasGapAssessment = false } = {}) {
  if (!user || user.onboardingCompleted) return null;
  if (!hasCompletedProfileSteps(user)) return null;

  const flow = onboardingFlowState(user, user.dateOfBirth);

  if (!user.dateOfBirth && !user.ageGroup) {
    return PROFILE_STEP_INDEX;
  }

  if (stepApplies('sproutGuardian', flow)) {
    return STEPS.indexOf('sproutGuardian');
  }

  if (stepApplies('journeyRole', flow)) {
    return STEPS.indexOf('journeyRole');
  }

  if (hasGapAssessment) {
    return REPORT_STEP_INDEX;
  }

  if (user.gofamWeekStartDay != null && savedStepIndex >= GAP_STEP_INDEX) {
    return REPORT_STEP_INDEX;
  }

  if (savedStepIndex >= GAP_STEP_INDEX) {
    return null;
  }

  if (savedStepIndex < GAP_STEP_INDEX) {
    return GAP_STEP_INDEX;
  }

  return null;
}

/**
 * Whether to apply a resolved resume step.
 * Profile gates (username/age, family) always snap — including going backward.
 * Later steps only advance forward.
 */
export function shouldApplyResumeStep(savedStep, resumeStep, user) {
  if (resumeStep == null || savedStep === resumeStep) return false;
  const flow = onboardingFlowState(user, user?.dateOfBirth);
  if (
    (!user?.dateOfBirth && !user?.ageGroup) ||
    stepApplies('sproutGuardian', flow) ||
    stepApplies('journeyRole', flow)
  ) {
    return true;
  }
  return savedStep < resumeStep;
}

export const useOnboardingStore = create((set, get) => ({
  ...initialState,

  setStepIndex: (stepIndex) => {
    set({ stepIndex });
    persistState(get);
  },

  goBack: () => {
    set((state) => ({
      stepIndex: Math.max(state.stepIndex - 1, 0),
    }));
    persistState(get);
  },

  goNext: (maxIndex) => {
    set((state) => ({
      stepIndex: Math.min(state.stepIndex + 1, maxIndex),
    }));
    persistState(get);
  },

  setAvatarUrl: (avatarUrl) => {
    set({ avatarUrl });
    persistState(get);
  },

  setDisplayName: (displayName) => {
    set({ displayName });
    persistState(get);
  },

  setUsername: (username) => {
    set({ username });
    persistState(get);
  },

  setDateOfBirth: (dateOfBirth) => {
    set({ dateOfBirth });
    persistState(get);
  },

  setFamilyDetails: (familyDetails) => {
    set({ familyDetails });
    persistState(get);
  },

  setSeedId: (seedId) => {
    set({ seedId });
    persistState(get);
  },

  setGapResponses: (gapResponses) => {
    set({ gapResponses });
    persistState(get);
  },

  upsertGapResponse: (questionId, rawAnswer) => {
    set((state) => {
      const rest = state.gapResponses.filter((r) => r.questionId !== questionId);
      return { gapResponses: [...rest, { questionId, rawAnswer }] };
    });
    persistState(get);
  },

  setAssessmentResult: (assessmentResult, unlockedMission, journeyPlan, missionOptions) => {
    set({
      assessmentResult,
      unlockedMission: unlockedMission ?? null,
      journeyPlan: journeyPlan ?? null,
      missionOptions: missionOptions ?? [],
    });
    persistState(get);
  },

  setBloomedVirtue: (bloomedVirtue) => {
    set({ bloomedVirtue });
    persistState(get);
  },

  setGrowthReportPhase: (growthReportPhase) => {
    set({ growthReportPhase });
    persistState(get);
  },

  setGofamWeekStartDay: (gofamWeekStartDay) => {
    set({ gofamWeekStartDay });
    persistState(get);
  },

  reset: () => {
    set({ ...DEFAULT_STATE });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // fail silently
    }
  },

  resumeToGrowthReport: () => {
    set((state) => ({
      ...state,
      stepIndex: Math.max(state.stepIndex, REPORT_STEP_INDEX),
      growthReportPhase: Math.max(normalizeGrowthReportPhase(state.growthReportPhase), 1),
    }));
    persistState(get);
  },

  resumeToStep: (stepIndex) => {
    set((state) => ({
      ...state,
      stepIndex,
    }));
    persistState(get);
  },
}));