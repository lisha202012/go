import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { normalizeGapAssessment } from '../../lib/gapAssessmentView';
import { useAuthStore } from '../../store/useAuthStore';
import {
  GAP_STEP_INDEX,
  REPORT_STEP_INDEX,
  PROFILE_STEP_INDEX,
  resolveOnboardingResumeStep,
  shouldApplyResumeStep,
  useOnboardingStore,
} from '../../store/useOnboardingStore';
import { STEPS } from './onboardingSteps';
import {
  deriveCategoryFromState,
  nextApplicableStep,
  prevApplicableStep,
  visibleStepCount,
  visibleStepIndex,
} from './onboardingFlow';
import { ProgressDots } from './ProgressDots';
import { OnboardingBackButton } from './OnboardingBackButton';
import { WelcomeStep } from './steps/WelcomeStep';
import { PhilosophyStep } from './steps/PhilosophyStep';
import { AvatarStep } from './steps/AvatarStep';
import { UsernameStep } from './steps/UsernameStep';
import { SproutGuardianStep } from './steps/SproutGuardianStep';
import { JourneyRoleStep } from './steps/JourneyRoleStep';
import { GapAssessmentStep } from './steps/GapAssessmentStep';
import { GrowthReportStep } from './steps/GrowthReportStep';

export function OnboardingWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, accessToken, refreshToken, updateUser } = useAuthStore();

  const stepIndex = useOnboardingStore((s) => s.stepIndex);
  const avatarUrl = useOnboardingStore((s) => s.avatarUrl);
  const displayName = useOnboardingStore((s) => s.displayName);
  const username = useOnboardingStore((s) => s.username);
  const dateOfBirth = useOnboardingStore((s) => s.dateOfBirth);
  const assessmentResult = useOnboardingStore((s) => s.assessmentResult);
  const unlockedMission = useOnboardingStore((s) => s.unlockedMission);
  const journeyPlan = useOnboardingStore((s) => s.journeyPlan);
  const missionOptions = useOnboardingStore((s) => s.missionOptions);
  const growthReportPhase = useOnboardingStore((s) => s.growthReportPhase);
  const setGrowthReportPhase = useOnboardingStore((s) => s.setGrowthReportPhase);

  const goBack = useOnboardingStore((s) => s.goBack);
  const setStepIndex = useOnboardingStore((s) => s.setStepIndex);
  const setAvatarUrl = useOnboardingStore((s) => s.setAvatarUrl);
  const setDisplayName = useOnboardingStore((s) => s.setDisplayName);
  const setUsername = useOnboardingStore((s) => s.setUsername);
  const setDateOfBirth = useOnboardingStore((s) => s.setDateOfBirth);
  const setAssessmentResult = useOnboardingStore((s) => s.setAssessmentResult);
  const reset = useOnboardingStore((s) => s.reset);

  const [blockBack, setBlockBack] = useState(false);
  const gapBackRef = useRef(null);

  const flowState = {
    derivedCategory: deriveCategoryFromState({ dateOfBirth, user }),
    user,
  };

  const profileHydratedRef = useRef(false);

  useEffect(() => {
    if (profileHydratedRef.current || !user) return;

    const store = useOnboardingStore.getState();
    if (!store.displayName && user.displayName) {
      setDisplayName(user.displayName);
    }
    if (!store.username && user.username && !/^u_[a-f0-9]{12}$/.test(user.username)) {
      setUsername(user.username);
    }
    if (!store.dateOfBirth && user.dateOfBirth) {
      setDateOfBirth(user.dateOfBirth);
    }
    profileHydratedRef.current = true;
  }, [user, setDisplayName, setUsername, setDateOfBirth]);

  useEffect(() => {
    if (STEPS[stepIndex] !== 'gap') {
      setBlockBack(false);
    }
  }, [stepIndex]);

  useEffect(() => {
    if (!user || user.onboardingCompleted) return;

    const { stepIndex: savedStep, resumeToStep, assessmentResult } = useOnboardingStore.getState();
    const resumeStep = resolveOnboardingResumeStep(user, savedStep, {
      hasGapAssessment: Boolean(assessmentResult),
    });
    if (shouldApplyResumeStep(savedStep, resumeStep, user)) {
      resumeToStep(resumeStep);
    }
  }, [user]);

  useEffect(() => {
    const glow =
      params.get('glow') ||
      (() => {
        try {
          return sessionStorage.getItem('gofam_glow_token');
        } catch {
          return null;
        }
      })();
    if (!glow || !accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const claimed = await api.claimGlowInvite(glow);
        if (cancelled) return;
        if (claimed?.seed?.id) {
          useOnboardingStore.getState().setSeedId(claimed.seed.id);
        }
        try {
          sessionStorage.removeItem('gofam_glow_token');
        } catch {
          /* ignore */
        }
      } catch {
        /* already claimed or invalid */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, params]);

  const growthReportResumeChecked = useRef(false);
  useEffect(() => {
    if (growthReportResumeChecked.current) return;
    growthReportResumeChecked.current = true;

    if (!user?.onboardingCompleted || !user.needsMissionSelection) return;

    const { stepIndex: savedStep, resumeToGrowthReport } = useOnboardingStore.getState();
    if (savedStep >= GAP_STEP_INDEX && savedStep < REPORT_STEP_INDEX) {
      resumeToGrowthReport();
    }
  }, [user?.onboardingCompleted, user?.needsMissionSelection]);

  if (
    user?.onboardingCompleted &&
    !user.needsMissionSelection &&
    STEPS[stepIndex] !== 'report'
  ) {
    return <Navigate to="/home" replace />;
  }

  if (!accessToken && !refreshToken) {
    const seedQuery = params.get('seedId');
    const glowQuery = params.get('glow');
    const schoolLinkQuery = params.get('schoolLink');
    const loginPath = seedQuery
      ? `/login?seedId=${encodeURIComponent(seedQuery)}`
      : glowQuery
        ? `/login?glow=${encodeURIComponent(glowQuery)}`
        : schoolLinkQuery
          ? `/login?schoolLink=${encodeURIComponent(schoolLinkQuery)}`
          : '/login';
    return <Navigate to={loginPath} replace />;
  }

  const currentKey = STEPS[stepIndex] ?? 'welcome';
  const dotTotal = visibleStepCount(flowState);
  const dotIndex = visibleStepIndex(stepIndex, flowState);
  const maxStepIndex = STEPS.length - 1;

  function next() {
    const nextIndex = nextApplicableStep(stepIndex, flowState);
    setStepIndex(nextIndex);
  }

  function handleBack() {
    if (blockBack) return;
    if (currentKey === 'gap' && gapBackRef.current?.tryBack?.()) return;
    if (currentKey === 'report' && growthReportPhase > 0) {
      setGrowthReportPhase(growthReportPhase - 1);
      return;
    }
    if (currentKey === 'report') return;
    const prevIndex = prevApplicableStep(stepIndex, flowState);
    setStepIndex(prevIndex);
  }

  const canGoBack = stepIndex > 0 && (currentKey !== 'report' || growthReportPhase > 0);

  async function handleAvatarNext() {
    if (avatarUrl) {
      try {
        const result = await api.patchAvatar(avatarUrl);
        updateUser(result.user);
      } catch {
        // Avatar save is best-effort
      }
    }
    next();
  }

  return (
    <div className="gofam-app min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-violet-500/20 bg-[#0c0c14]/95 backdrop-blur-md">
        {currentKey === 'welcome' ? (
          <div className="h-3" />
        ) : currentKey === 'gap' ? (
          <div className="py-3 text-center text-xs font-semibold tracking-wide text-violet-500 uppercase">
            GAP Assessment
          </div>
        ) : currentKey === 'report' ? (
          <div className="py-3 text-center text-xs font-semibold tracking-wide text-emerald-600 uppercase">
            Growth Report
          </div>
        ) : (
          <ProgressDots total={Math.max(dotTotal, 1)} current={dotIndex} />
        )}

        {canGoBack ? (
          <OnboardingBackButton onClick={handleBack} disabled={blockBack} />
        ) : (
          <div className="h-8" />
        )}
      </header>

      {currentKey === 'welcome' && <WelcomeStep onNext={next} />}
      {currentKey === 'philosophy' && <PhilosophyStep onNext={next} />}
      {currentKey === 'avatar' && (
        <AvatarStep avatarUrl={avatarUrl} onSelect={setAvatarUrl} onNext={handleAvatarNext} />
      )}
      {currentKey === 'profile' && (
        <UsernameStep
          displayName={displayName}
          username={username}
          dateOfBirth={dateOfBirth}
          avatarUrl={avatarUrl}
          onDisplayNameChange={setDisplayName}
          onChange={setUsername}
          onDateOfBirthChange={setDateOfBirth}
          onAvatarChange={async (url) => {
            setAvatarUrl(url);
            try {
              const result = await api.patchAvatar(url);
              updateUser(result.user);
            } catch {
              /* ignore */
            }
          }}
          onSaved={(updatedUser) => {
            updateUser(updatedUser);
            next();
          }}
        />
      )}
      {currentKey === 'sproutGuardian' && (
        <SproutGuardianStep
          onNeedProfile={() => setStepIndex(PROFILE_STEP_INDEX)}
          onSaved={(updatedUser) => {
            updateUser(updatedUser);
            next();
          }}
        />
      )}
      {currentKey === 'journeyRole' && (
        <JourneyRoleStep
          onSaved={(updatedUser) => {
            updateUser(updatedUser);
            next();
          }}
        />
      )}
      {currentKey === 'gap' && (
        <GapAssessmentStep
          ref={gapBackRef}
          onComplete={(result) => {
            setAssessmentResult(
              normalizeGapAssessment(result.assessment),
              result.unlockedMission,
              result.journeyPlan,
              result.missionOptions,
            );
            if (result.user) updateUser(result.user);
            next();
          }}
        />
      )}
      {currentKey === 'report' && (
        <GrowthReportStep
          assessment={assessmentResult}
          unlockedMission={unlockedMission}
          journeyPlan={journeyPlan}
          missionOptions={missionOptions}
          growthReportPhase={growthReportPhase}
          onGrowthReportPhaseChange={setGrowthReportPhase}
          onFinish={() => {
            reset();
            navigate('/home', { replace: true });
          }}
        />
      )}
    </div>
  );
}
