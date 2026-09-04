import { useEffect, useState } from 'react';
import { bootstrapSession, api } from '../lib/api';
import { normalizeGapAssessment } from '../lib/gapAssessmentView';
import { useAuthStore } from '../store/useAuthStore';
import { resolveOnboardingResumeStep, shouldApplyResumeStep, useOnboardingStore } from '../store/useOnboardingStore';

export function AuthBootstrap({ children }) {
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [ready, setReady] = useState(() => {
    const { user, accessToken, refreshToken } = useAuthStore.getState();
    return Boolean(
      window.location.pathname.startsWith('/admin') &&
        user?.role === 'admin' &&
        (accessToken || refreshToken),
    );
  });

  useEffect(() => {
    let cancelled = false;
    const startupTimeout = window.setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 10_000);

    (async () => {
      const { accessToken, refreshToken } = useAuthStore.getState();
      if (!accessToken && !refreshToken) {
        if (!cancelled) setReady(true);
        return;
      }

      const result = await bootstrapSession();
      if (cancelled) return;

      if (!result.ok) {
        if (result.reason === 'expired') {
          clearAuth();
        }
        setReady(true);
        return;
      }

      if (result.user) {
        updateUser(result.user);
      }

      if (result.user?.role === 'admin') {
        setReady(true);
        return;
      }

      if (result.user?.onboardingCompleted) {
        if (result.user.needsMissionSelection) {
          try {
            const gapResult = await api.getMyGapAssessment();
            if (gapResult?.assessment) {
              const store = useOnboardingStore.getState();
              store.setAssessmentResult(
                normalizeGapAssessment(gapResult.assessment),
                store.unlockedMission,
                store.journeyPlan,
                [],
              );
            }
          } catch {
            // GrowthReportStep will retry loading assessment
          }
          useOnboardingStore.getState().resumeToGrowthReport();
        } else {
          useOnboardingStore.getState().reset();
        }
        setReady(true);
        return;
      }

      let hasGapAssessment = false;
      try {
        const gapResult = await api.getMyGapAssessment();
        if (gapResult?.assessment) {
          hasGapAssessment = true;
          const store = useOnboardingStore.getState();
          store.setAssessmentResult(
            normalizeGapAssessment(gapResult.assessment),
            store.unlockedMission,
            store.journeyPlan,
            [],
          );
        }
      } catch {
        // No saved GAP yet — resume from profile steps.
      }

      const { stepIndex: savedStep, resumeToStep } = useOnboardingStore.getState();
      const resumeStep = resolveOnboardingResumeStep(result.user, savedStep, { hasGapAssessment });
      if (shouldApplyResumeStep(savedStep, resumeStep, result.user)) {
        resumeToStep(resumeStep);
      }

      setReady(true);
    })().catch(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(startupTimeout);
    };
  }, [updateUser, clearAuth]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-violet-50">
        <p className="text-sm font-medium text-violet-700">Loading your session…</p>
      </div>
    );
  }

  return children;
}
