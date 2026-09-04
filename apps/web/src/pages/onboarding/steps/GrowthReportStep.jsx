import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlowIndexGauge } from '../../../components/FlowIndexGauge';
import { GapHillScoreChart } from '../../../components/GapHillScoreChart';
import { getFlowStatusLabel, HILL_ICONS } from '../../../lib/gapAnswers';
import {
  GAP_QUESTIONS_PER_HILL,
  GAP_TOTAL_QUESTIONS,
} from '../../../lib/gapHillJourney';
import {
  isGapAssessmentReady,
  normalizeGapAssessment,
} from '../../../lib/gapAssessmentView';
import { formatHillSubtitle, formatHillTitle } from '../../../lib/hills';
import { api } from '../../../lib/api';
import { FlowWeekDayPreviewModal, MissionSelectCard } from '../../../components/FlowWeekDayPreviewModal';
import { useAuthStore } from '../../../store/useAuthStore';
import { GAP_STEP_INDEX, useOnboardingStore } from '../../../store/useOnboardingStore';

const PHASES = ['report', 'mission'];
const PHASE_LABELS = ['Your FLOW results', 'Pick missions'];
const PICK_COUNT = 3;

function isAssessmentReady(assessment) {
  return isGapAssessmentReady(assessment);
}

function scoreForHill(scores, hillId) {
  const entry = scores.find((s) => s.hillId === hillId);
  return entry?.score ?? entry?.flowPercent ?? null;
}

function JourneyPlanPreview({ journeyPlan, compact = false }) {
  if (!journeyPlan?.weeks?.length) return null;

  const blocks = [];
  for (let i = 0; i < journeyPlan.weeks.length; i += 3) {
    blocks.push(journeyPlan.weeks.slice(i, i + 3));
  }

  const visibleBlocks = compact ? blocks.slice(0, 1) : blocks;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs font-semibold tracking-wide text-violet-600 uppercase">
        {compact ? 'Step 1 on your Focus Hill' : 'Hill climb · 30-day challenge · earn 21 Glow Seeds'}
      </p>
      {visibleBlocks.map((blockWeeks, blockIndex) => {
        const hillName = blockWeeks[0]?.hillName?.replace('Hill of ', '') ?? 'Hill';
        const icon = HILL_ICONS[blockWeeks[0]?.hillCode] ?? '🏔️';
        const isFocus = blockIndex === 0;
        const stepNumber = blockIndex + 1;

        return (
          <div
            key={blockWeeks[0]?.weekNumber ?? blockIndex}
            className={[
              'rounded-xl border px-3 py-3',
              isFocus ? 'border-violet-300 bg-violet-50' : 'border-violet-100 bg-white',
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <span aria-hidden="true">{icon}</span>
              <p className="text-sm font-semibold text-violet-900">
                Step {stepNumber}
                {' · '}
                {hillName}
                {isFocus ? ' (Focus)' : ''}
              </p>
            </div>
            <ul className="mt-2 space-y-1.5">
              {blockWeeks[0]?.pendingSelection ? (
                <li className="rounded-lg border border-dashed border-violet-300 bg-violet-50/50 px-2.5 py-2 text-xs text-violet-600">
                  3 missions unlock when you begin this hill&apos;s step {stepNumber}
                </li>
              ) : (
                blockWeeks.map((week) => (
                  <li
                    key={week.weekNumber}
                    className={[
                      'rounded-lg px-2.5 py-2 text-xs',
                      isFocus
                        ? 'bg-violet-100/70 text-violet-800'
                        : 'bg-violet-100/70 text-violet-800',
                    ].join(' ')}
                  >
                    Mission {week.taskNumber}: {week.missionTitle ?? 'Your pick'}
                  </li>
                ))
              )}
            </ul>
          </div>
        );
      })}
      {compact && blocks.length > 1 ? (
        <p className="text-xs text-violet-600/80">
          Then hill rotations through your GAP ranking — earn 21 Glow Seeds within 30 days.
        </p>
      ) : null}
    </div>
  );
}

export function GrowthReportStep({
  assessment: initialAssessment,
  unlockedMission: initialUnlockedMission,
  journeyPlan: initialJourneyPlan,
  missionOptions: initialMissionOptions,
  growthReportPhase: initialGrowthReportPhase,
  onGrowthReportPhaseChange,
  onFinish,
}) {
  const navigate = useNavigate();
  const storedPhase = useOnboardingStore((s) => s.growthReportPhase);
  const setGrowthReportPhase = useOnboardingStore((s) => s.setGrowthReportPhase);
  const phaseIndex = initialGrowthReportPhase ?? storedPhase ?? 0;
  const authUser = useAuthStore((s) => s.user);
  const isFlowWeekUser = (authUser?.journeyModelVersion ?? 0) >= 2;
  const reportPhaseCount = isFlowWeekUser ? 1 : PHASES.length;

  useEffect(() => {
    const maxPhase = isFlowWeekUser ? 0 : PHASES.length - 1;
    if (phaseIndex > maxPhase) setGrowthReportPhase(maxPhase);
  }, [isFlowWeekUser, phaseIndex, setGrowthReportPhase]);

  function setPhaseIndex(next) {
    const value = typeof next === 'function' ? next(phaseIndex) : next;
    const maxPhase = isFlowWeekUser ? 0 : PHASES.length - 1;
    const clamped = Math.max(0, Math.min(maxPhase, value));
    setGrowthReportPhase(clamped);
    onGrowthReportPhaseChange?.(clamped);
  }

  const [assessment, setAssessment] = useState(() => normalizeGapAssessment(initialAssessment));
  const [journeyPlan, setJourneyPlan] = useState(initialJourneyPlan);
  const [poolOptions, setPoolOptions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [missionRewards, setMissionRewards] = useState(null);
  const [unlockedMission, setUnlockedMission] = useState(initialUnlockedMission);
  const [planConfirmed, setPlanConfirmed] = useState(Boolean(initialJourneyPlan?.weeks?.length));
  const [submitting, setSubmitting] = useState(false);
  const [selectError, setSelectError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [flowWeek, setFlowWeek] = useState(null);
  const [flowWeekLoading, setFlowWeekLoading] = useState(false);
  const [previewDay, setPreviewDay] = useState(null);
  const hydrateAssessment = useOnboardingStore((s) => s.setAssessmentResult);

  function toggleMission(missionId) {
    setSelectedIds((prev) => {
      if (prev.includes(missionId)) return prev.filter((id) => id !== missionId);
      if (prev.length >= PICK_COUNT) return prev;
      return [...prev, missionId];
    });
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadError('');
      try {
        const [gapResult, journeyResult] = await Promise.all([
          api.getMyGapAssessment(),
          api.getMyJourney().catch(() => null),
        ]);
        if (cancelled) return;

        const loadedAssessment = normalizeGapAssessment(gapResult?.assessment);
        if (loadedAssessment && isGapAssessmentReady(loadedAssessment)) {
          setAssessment(loadedAssessment);
          hydrateAssessment(
            loadedAssessment,
            initialUnlockedMission ?? null,
            initialJourneyPlan ?? null,
            [],
          );
        } else if (isAssessmentReady(initialAssessment)) {
          setAssessment(normalizeGapAssessment(initialAssessment));
        } else {
          useOnboardingStore.getState().resumeToStep(GAP_STEP_INDEX);
          return;
        }

        if (journeyResult) {
          if (journeyResult.summary?.needsMissionSelection) {
            setPlanConfirmed(false);
          } else if (journeyResult.weeks?.length) {
            setJourneyPlan({
              totalWeeks: journeyResult.summary.totalWeeks,
              missionsPerHill: journeyResult.summary.missionsPerHill,
              focusHill: journeyResult.summary.focusHill,
              weeks: journeyResult.weeks.map((w) => ({
                weekNumber: w.weekNumber,
                missionTitle: w.mission.title,
                hillName: w.hill.name,
                hillCode: w.hill.code,
                taskNumber: w.taskNumber,
                isFocusHillBlock: w.isFocusHill,
              })),
            });
            const current = journeyResult.weeks.find((w) => w.status === 'current');
            if (current) setUnlockedMission(current.mission);
            setPlanConfirmed(true);
          }
        }
      } catch (err) {
        if (!cancelled) {
          if (isAssessmentReady(initialAssessment)) {
            setAssessment(normalizeGapAssessment(initialAssessment));
          } else if (err.status === 404) {
            useOnboardingStore.getState().resumeToStep(GAP_STEP_INDEX);
          } else {
            setLoadError(
              err.status === 503 || /database|reach.*server/i.test(err.message ?? '')
                ? 'Database is offline. In apps/api run: npx prisma dev'
                : err.message || 'Could not load your Growth Report',
            );
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialAssessment, initialJourneyPlan, initialUnlockedMission, hydrateAssessment]);

  const phase = PHASES[phaseIndex] ?? 'report';
  const normalized = normalizeGapAssessment(assessment);
  const flow = normalized?.flowIndexResult ?? 0;
  const flowStatus = normalized?.flowStatus ?? getFlowStatusLabel(flow);
  const strongest = normalized?.strongestHill;
  const focusHill = normalized?.growthHill;
  const hillScores = normalized?.scores ?? [];
  const strongestScore = strongest ? scoreForHill(hillScores, strongest.id) : null;
  const focusScore = focusHill ? scoreForHill(hillScores, focusHill.id) : null;

  useEffect(() => {
    if (phase !== 'mission' || !isFlowWeekUser) return;

    let cancelled = false;
    setFlowWeekLoading(true);
    (async () => {
      try {
        const data = await api.getFlowWeek();
        if (!cancelled) {
          setFlowWeek(data);
          setPlanConfirmed(true);
        }
      } catch {
        if (!cancelled) setFlowWeek(null);
      } finally {
        if (!cancelled) setFlowWeekLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, isFlowWeekUser]);

  useEffect(() => {
    if (isFlowWeekUser || planConfirmed) return;

    let cancelled = false;
    setOptionsLoading(true);
    setOptionsError('');
    (async () => {
      try {
        const result = await api.getFocusHillMissionOptions();
        if (cancelled) return;

        if (result.focusHill) {
          setAssessment((prev) => {
            const next = {
              ...(prev ?? { scores: [] }),
              growthHill: result.focusHill,
            };
            hydrateAssessment(
              next,
              initialUnlockedMission ?? null,
              initialJourneyPlan ?? null,
              result.options ?? [],
            );
            return next;
          });
        }

        setPoolOptions(result.options ?? []);
        setSelectedIds(result.recommendedIds ?? []);
        setMissionRewards(result.rewards ?? null);
      } catch (err) {
        if (!cancelled) {
          setOptionsError(
            err.status === 503 || /database|reach.*server/i.test(err.message ?? '')
              ? 'Database is offline. In apps/api run: npx prisma dev'
              : err.message?.includes('seed')
                ? 'Mission options are not in the database yet. Ask your dev to run: npx prisma db seed'
                : err.message || 'Could not load mission options',
          );
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [planConfirmed, isFlowWeekUser, hydrateAssessment, initialJourneyPlan, initialUnlockedMission]);

  async function confirmMissionSelection() {
    if (selectedIds.length !== PICK_COUNT) return;
    setSubmitting(true);
    setSelectError('');
    try {
      const result = await api.selectFocusHillMissions(selectedIds);
      setJourneyPlan(result.journeyPlan);
      setUnlockedMission(result.unlockedMission);
      setMissionRewards(result.rewards ?? null);
      setPlanConfirmed(true);
      await startMission();
    } catch (err) {
      if (err.status === 409) {
        try {
          const journeyResult = await api.getMyJourney();
          if (journeyResult?.weeks?.length && !journeyResult.summary?.needsMissionSelection) {
            setJourneyPlan({
              totalWeeks: journeyResult.summary.totalWeeks,
              missionsPerHill: journeyResult.summary.missionsPerHill,
              focusHill: journeyResult.summary.focusHill,
              weeks: journeyResult.weeks.map((w) => ({
                weekNumber: w.weekNumber,
                missionTitle: w.mission.title,
                hillName: w.hill.name,
                hillCode: w.hill.code,
                taskNumber: w.taskNumber,
                isFocusHillBlock: w.isFocusHill,
              })),
            });
            const current = journeyResult.weeks.find((w) => w.status === 'current');
            if (current) setUnlockedMission(current.mission);
            setPlanConfirmed(true);
            return;
          }
        } catch {
          // fall through to error message
        }
      }
      setSelectError(err.message || 'Could not save your missions');
    } finally {
      setSubmitting(false);
    }
  }

  async function startMission() {
    try {
      const result = await api.completeOnboarding();
      if (result?.user) {
        useAuthStore.getState().updateUser(result.user);
      }
    } catch {
      // Still allow navigation if missions are already saved
    }
    onFinish?.();
    navigate('/home');
  }

  function goNextPhase() {
    if (phase === 'report') {
      if (isFlowWeekUser) {
        startMission();
        return;
      }
      if (phaseIndex < PHASES.length - 1) {
        setPhaseIndex(phaseIndex + 1);
        return;
      }
    }
    if (isFlowWeekUser || planConfirmed) {
      startMission();
      return;
    }
    confirmMissionSelection();
  }

  function goToPhase(index) {
    if (index >= 0 && index <= phaseIndex) {
      setPhaseIndex(index);
    }
  }

  if (loading) {
    return (
      <section className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-6">
        <p className="text-sm font-medium text-violet-700">Building your Growth Report…</p>
      </section>
    );
  }

  if (loadError && !isAssessmentReady(assessment)) {
    return (
      <section className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 pb-10 text-center">
        <p className="text-sm text-rose-600">{loadError}</p>
      </section>
    );
  }

  const pickReady = selectedIds.length === PICK_COUNT;

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-2">
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs font-semibold text-violet-600">
          <span>Growth Report · {phaseIndex + 1} of {reportPhaseCount}</span>
          <span className="text-emerald-700">GAP complete ✓</span>
        </div>
        <div className="mt-2 flex gap-1.5" role="tablist" aria-label="Growth Report steps">
          {(isFlowWeekUser ? ['report'] : PHASES).map((key, i) => {
            const visited = i <= phaseIndex;
            const current = i === phaseIndex;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={current}
                aria-label={PHASE_LABELS[i]}
                disabled={!visited || current}
                onClick={() => goToPhase(i)}
                className={[
                  'h-1.5 flex-1 rounded-full transition-all duration-300',
                  current ? 'bg-violet-600 ring-2 ring-violet-300 ring-offset-1' : '',
                  !current && visited ? 'cursor-pointer bg-violet-600 hover:bg-violet-500' : '',
                  !visited ? 'cursor-default bg-violet-200' : '',
                ].join(' ')}
              />
            );
          })}
        </div>
      </div>

      {phase === 'report' ? (
        <>
          <h2 className="font-display text-2xl font-semibold text-violet-900">Discover Your FLOW</h2>
          <p className="mt-2 text-sm leading-relaxed text-violet-800/70">
            Based on {GAP_TOTAL_QUESTIONS} behaviour questions ({GAP_QUESTIONS_PER_HILL} per hill)
            — here is your starting map across all 7 hills.
          </p>

          <div className="mt-8 flex justify-center">
            <FlowIndexGauge value={flow} label="" />
          </div>
          <p className="mt-3 text-center text-sm font-semibold text-emerald-700">🌿 {flowStatus}</p>

          {strongest && focusHill ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Strongest hill
                </p>
                <p className="mt-1 text-sm font-semibold text-violet-900">
                  {formatHillTitle(strongest)}
                </p>
                <p className="text-xs font-semibold text-amber-800">
                  {strongestScore != null ? `${strongestScore}% FLOW` : '—'}
                </p>
              </div>
              <div className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">
                  Focus hill
                </p>
                <p className="mt-1 text-sm font-semibold text-violet-900">
                  {formatHillTitle(focusHill)}
                </p>
                <p className="text-xs font-semibold text-violet-800">
                  {focusScore != null ? `${focusScore}% FLOW` : '—'}
                </p>
              </div>
            </div>
          ) : null}

          {hillScores.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold tracking-wide text-violet-500 uppercase">
                Your 7 hills · ranked by FLOW
              </p>
              <div className="mt-3">
                <GapHillScoreChart
                  hillScores={hillScores}
                  strongestHillId={normalized?.strongestHillId ?? strongest?.id}
                  focusHillId={normalized?.focusHillId ?? focusHill?.id}
                />
              </div>
            </div>
          ) : null}

          {strongest && focusHill ? (
            <p className="mt-4 rounded-xl bg-violet-50 px-4 py-3 text-sm leading-relaxed text-violet-800/85">
              Grow first on <span className="font-semibold">{formatHillTitle(focusHill)}</span>{' '}
              — your focus hill. Lean on{' '}
              <span className="font-semibold">{formatHillTitle(strongest)}</span> as your strength.
            </p>
          ) : null}
        </>
      ) : null}

      {phase === 'mission' ? (
        <>
          {isFlowWeekUser ? (
            <>
              <h2 className="font-display text-2xl font-semibold text-violet-900">Your FLOW Week</h2>
              <p className="mt-2 text-sm leading-relaxed text-violet-800/70">
                Your week starts every{' '}
                <span className="font-semibold">{flowWeek?.gofamWeekStartLabel ?? '…'}</span>.
                Each day focuses on one Hill from your GAP ranking (lowest → highest).
              </p>
              {flowWeekLoading ? (
                <p className="mt-6 text-sm text-violet-600">Loading your personal week…</p>
              ) : null}
              {flowWeek?.dayRankings?.length ? (
                <div className="mt-6 space-y-2">
                  <p className="text-xs text-violet-600/80">
                    Tap a day to preview 5 missions — 3 recommended for you.
                  </p>
                  {flowWeek.dayRankings.map((row) => (
                    <button
                      key={row.dayIndex}
                      type="button"
                      onClick={() => setPreviewDay(row)}
                      className="flex w-full items-center gap-3 rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-left transition hover:border-violet-300 hover:bg-violet-50/60 active:scale-[0.99]"
                    >
                      <span className="text-xs font-bold text-violet-500">Day {row.dayIndex}</span>
                      <span className="flex-1 text-sm font-semibold text-violet-900">{row.hill.name}</span>
                      <span className="text-xs font-semibold text-violet-500">Preview →</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : !planConfirmed ? (
            <>
              <h2 className="font-display text-2xl font-semibold text-violet-900">
                Pick your 3 {formatHillTitle(focusHill)} missions
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-violet-800/70">
                Choose 3 from {poolOptions.length || 15} missions for your focus hill (
                {formatHillSubtitle(focusHill)}). Three are marked{' '}
                <span className="font-semibold">Recommended</span> and pre-selected — tap to change
                your picks.
              </p>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-violet-100 px-4 py-2.5">
                <p className="text-sm font-semibold text-violet-800">
                  Selected: {selectedIds.length} / {PICK_COUNT}
                </p>
              </div>

              <div className="mt-4 max-h-[min(52vh,420px)] space-y-2.5 overflow-y-auto pr-1">
                {optionsLoading && poolOptions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-violet-600">Loading mission options…</p>
                ) : null}
                {poolOptions.map((mission) => {
                  const selected = selectedIds.includes(mission.id);
                  const pickOrder = selected ? selectedIds.indexOf(mission.id) + 1 : null;
                  return (
                    <MissionSelectCard
                      key={mission.id}
                      mission={mission}
                      selected={selected}
                      pickOrder={pickOrder}
                      rewards={missionRewards}
                      disabled={!selected && selectedIds.length >= PICK_COUNT}
                      onToggle={() => toggleMission(mission.id)}
                    />
                  );
                })}
              </div>

              {optionsError ? (
                <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{optionsError}</p>
              ) : null}

              {selectError ? <p className="mt-3 text-sm text-rose-600">{selectError}</p> : null}
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-semibold text-violet-900">Your hill climb plan</h2>
              <p className="mt-2 text-sm leading-relaxed text-violet-800/70">
                Your {PICK_COUNT} focus-hill missions are active now. For each later step on another
                hill, you will pick 3 missions when that step begins.
              </p>

              <div className="mt-6">
                <JourneyPlanPreview journeyPlan={journeyPlan} />
              </div>

              <div className="mt-6 rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-500 p-5 text-white shadow-xl shadow-violet-600/30">
                <p className="text-xs font-semibold tracking-wide text-violet-100 uppercase">
                  Ready to start
                </p>
                <p className="mt-2 font-display text-xl font-semibold leading-snug">
                  {PICK_COUNT} missions active on {formatHillTitle(focusHill)}
                </p>
                <p className="mt-1 text-sm text-violet-100/90">
                  Work on any mission in any order — all {PICK_COUNT} are available this step.
                </p>
              </div>
            </>
          )}
        </>
      ) : null}

      <button
        type="button"
        disabled={
          (phase === 'mission' && !isFlowWeekUser && !planConfirmed && (!pickReady || submitting)) ||
          (phase === 'mission' && submitting)
        }
        onClick={goNextPhase}
        className="mt-auto w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/30 transition enabled:hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
      >
        {phase === 'mission'
          ? isFlowWeekUser || planConfirmed
            ? 'Continue to Home'
            : submitting
              ? 'Saving…'
              : pickReady
                ? 'Continue to Home'
                : `Pick ${PICK_COUNT - selectedIds.length} more`
          : isFlowWeekUser
            ? 'Continue to Home'
            : 'Pick my 3 missions'}
      </button>

      <FlowWeekDayPreviewModal
        open={Boolean(previewDay)}
        dayIndex={previewDay?.dayIndex ?? null}
        hill={previewDay?.hill ?? null}
        onClose={() => setPreviewDay(null)}
      />
    </section>
  );
}
