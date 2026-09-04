import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { formatHillTitle } from '../lib/hills';
import { triggerTreePulse } from '../lib/missionsTreePulse';
import { isMissionCompleted, isMissionCompletedToday } from '../lib/missionCompletion';
import { isMissedDayBlockingError, redirectHomeForMissedDay } from '../lib/missedDayBlock';
import { useAuthStore } from '../store/useAuthStore';
import { useUserSummary } from '../context/DashboardContext';
import { HillMountainVisual } from './HillMountainVisual';
import { PulseGlowMissionCard, ExtraMissionCard } from './PulseGlowMissionCard';
import { PulseMissionDetailModal } from './PulseMissionDetailModal';
import { OtherHillCompactCard } from './OtherHillCompactCard';
import { MissionWhySheet } from './MissionWhySheet';
import { MissionCelebrationModal } from './MissionCelebrationModal';
import { CampCelebrationModal } from './CampCelebrationModal';
import { TreeLevelUpModal } from './TreeLevelUpModal';
import { FlowWeekDayPreviewModal } from './FlowWeekDayPreviewModal';
import { FlowWeekOptionalMissions } from './FlowWeekOptionalMissions';
import { GrowChallengeCompleteModal } from './GrowChallengeCompleteModal';
import { didJustCompleteGrowChallenge } from '../lib/growChallenge';

const HILL_ORDER = ['HOOK', 'HOPE', 'HONE', 'HOLD', 'HOOD', 'HOST', 'HORN'];

function resolvePrescribedMissions(today, flowWeek) {
  let base;
  if (today.prescribedMissions?.length >= 3) base = today.prescribedMissions.slice(0, 3);
  else {
    const pool = today.hillMissions ?? [];
    const recommended = pool.filter((m) => m.isRecommended).slice(0, 3);
    base = recommended.length >= 3 ? recommended : pool.slice(0, 3);
  }
  const byId = new Map((today.hillMissions ?? []).map((m) => [m.id, m]));
  return base.map((mission) => {
    const rich = byId.get(mission.id);
    if (!rich) return mission;
    return {
      ...rich,
      ...mission,
      completed: Boolean(mission.completed || rich.completedToday || (rich.completionCount ?? 0) > 0),
      completedToday: rich.completedToday ?? mission.completed,
      whyText: rich.whyText ?? mission.whyText,
    };
  });
}

function WeeklyResetNote() {
  return (
    <div className="flex gap-3 rounded-2xl border border-fuchsia-300/30 bg-[#2a1845]/60 p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/20 text-fuchsia-200">
        <Calendar className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-fuchsia-200">Every Sunday midnight</p>
        <p className="mt-0.5 text-sm text-violet-100/90">
          All daily glows reset. New week, new opportunity to grow higher!
        </p>
      </div>
    </div>
  );
}

export function MissionsGrowExperience({
  dashboardHills = [],
  growChallenge = null,
  embeddedInJourney = false,
  journeyView = null,
  sheetHillCode = null,
  onAfterMissionComplete,
}) {
  const [searchParams] = useSearchParams();
  const [flowWeek, setFlowWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [whyMission, setWhyMission] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [campReached, setCampReached] = useState(null);
  const [treeLevelUp, setTreeLevelUp] = useState(null);
  const [previewDay, setPreviewDay] = useState(null);
  const [optionalReload, setOptionalReload] = useState(0);
  const [optionalPatch, setOptionalPatch] = useState(null);
  const [expandedOptionalHill, setExpandedOptionalHill] = useState(null);
  const [localChallenge, setLocalChallenge] = useState(growChallenge);
  const [pendingChallengeComplete, setPendingChallengeComplete] = useState(null);
  const [challengeComplete, setChallengeComplete] = useState(null);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { refresh: refreshDashboard } = useUserSummary();

  useEffect(() => {
    setLocalChallenge(growChallenge);
  }, [growChallenge]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getFlowWeek();
        if (!cancelled) setFlowWeek(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load missions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const hillCode = searchParams.get('hill');
    if (hillCode && dashboardHills.length) {
      const hill = dashboardHills.find((h) => h.code === hillCode);
      if (hill) setExpandedOptionalHill(hill);
    }
  }, [searchParams, dashboardHills]);

  const today = flowWeek?.today ?? null;
  const prescribed = useMemo(
    () => (today ? resolvePrescribedMissions(today, flowWeek) : []),
    [today, flowWeek],
  );

  const todayHillDashboard = useMemo(() => {
    if (!today?.hill?.code) return null;
    return dashboardHills.find((h) => h.code === today.hill.code) ?? today.hill;
  }, [dashboardHills, today]);

  const completedSteps = todayHillDashboard?.completedSteps ?? 0;
  const accent = today?.hill?.colorTheme ?? '#7C3AED';

  const otherHills = useMemo(() => {
    const todayCode = today?.hill?.code;
    const byCode = new Map(dashboardHills.map((h) => [h.code, h]));
    return HILL_ORDER.filter((code) => code !== todayCode)
      .map((code) => byCode.get(code))
      .filter(Boolean);
  }, [dashboardHills, today]);

  async function handleStart(missionId) {
    setBusyId(missionId);
    setError('');
    try {
      await api.startFlowWeekMission(missionId);
      setFlowWeek((prev) => {
        if (!prev?.today) return prev;
        const mark = (list) =>
          (list ?? []).map((m) => (m.id === missionId ? { ...m, started: true } : m));
        return {
          ...prev,
          today: {
            ...prev.today,
            prescribedMissions: mark(prev.today.prescribedMissions),
            hillMissions: mark(prev.today.hillMissions),
          },
        };
      });
    } catch (err) {
      if (isMissedDayBlockingError(err)) redirectHomeForMissedDay();
      else setError(err.message || 'Could not start mission');
    } finally {
      setBusyId(null);
    }
  }

  async function handleComplete(missionId, hillCodeForPulse) {
    setBusyId(missionId);
    setError('');
    const prescribedHillCode = today?.hill?.code;
    try {
      const result = await api.completeFlowWeekMission(missionId);
      if (result.flowWeek) setFlowWeek(result.flowWeek);

      if (result.walletCoins != null || result.seedInventoryCount != null) {
        const current = useAuthStore.getState().user;
        if (current) {
          updateUser({
            ...current,
            ...(result.walletCoins != null ? { walletCoins: result.walletCoins } : {}),
            ...(result.seedInventoryCount != null
              ? { seedInventoryCount: result.seedInventoryCount }
              : {}),
          });
        }
      }
      void refreshDashboard();

      const challengeBefore = localChallenge ?? growChallenge;
      if (result.growChallenge) {
        setLocalChallenge(result.growChallenge);
        if (didJustCompleteGrowChallenge(challengeBefore, result.growChallenge)) {
          setPendingChallengeComplete(result.growChallenge);
        }
      }

      const pulseHillCode =
        result.isTodayHomeHill || result.isPrescribed ? prescribedHillCode : hillCodeForPulse;
      const isDailyFlowJustCompleted = (result.dailyBonusAwarded ?? 0) > 0;
      triggerTreePulse({
        hillCode: pulseHillCode,
        kind: isDailyFlowJustCompleted ? 'daily' : 'mission',
      });

      const todayAfter = result.flowWeek?.today ?? flowWeek?.today;
      const chakraSlotsFilled = Math.min(
        3,
        todayAfter?.homeBonusSlotsUsed ?? todayAfter?.prescribedCompleted ?? 0,
      );
      const showChakra = Boolean(result.isTodayHomeHill);

      setCelebration({
        missionTitle: result.missionTitle,
        coinReward: result.coinReward,
        dailyBonusAwarded: result.dailyBonusAwarded ?? 0,
        dailySeedsAwarded: result.dailySeedsAwarded ?? 0,
        perfectWeekBonusAwarded: result.perfectWeekBonusAwarded ?? 0,
        perfectWeekSeedsAwarded: result.perfectWeekSeedsAwarded ?? 0,
        showChakra,
        chakraHillCode: showChakra ? todayAfter?.hill?.code ?? prescribedHillCode : null,
        chakraHillName: showChakra ? todayAfter?.hill?.name ?? null : null,
        chakraSlotsFilled: showChakra ? Math.max(0, chakraSlotsFilled) : 0,
        chakraActivated: Boolean(todayAfter?.dailyFlowComplete || isDailyFlowJustCompleted),
        extraCompleted: result.extraCompleted ?? 0,
        isPrescribed: result.isPrescribed ?? true,
      });
      if (result.campReached) {
        setCampReached({
          camp: result.campReached,
          hillTitle: todayAfter?.hill?.name ?? result.missionTitle,
        });
      }
      if (result.treeLevelUp) setTreeLevelUp(result.treeLevelUp);

      setExpandedId(null);
      setSelectedMission(null);
      setOptionalReload((n) => n + 1);
      onAfterMissionComplete?.();
    } catch (err) {
      if (isMissedDayBlockingError(err)) redirectHomeForMissedDay();
      else setError(err.message || 'Could not complete mission');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-violet-600">Loading your missions…</p>;
  }

  if (error && !flowWeek) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }

  if (flowWeek?.weekNotStartedYet && !today) {
    const startsAt = flowWeek.personalWeekStart
      ? new Date(flowWeek.personalWeekStart).toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })
      : flowWeek.gofamWeekStartLabel;
    return (
      <div className="rounded-2xl border border-violet-100 bg-white p-5 text-sm text-violet-700">
        <p className="font-semibold text-violet-950">Missions unlock {startsAt}</p>
        <p className="mt-2">Your first Home Hill missions appear when your FLOW week begins.</p>
      </div>
    );
  }

  if (!today) {
    return (
      <div className="rounded-2xl border border-violet-100 bg-white p-5 text-sm text-violet-700">
        <p className="font-semibold text-violet-950">No mission day scheduled for today</p>
      </div>
    );
  }

  const prescribedCompleted = today.prescribedCompleted ?? 0;
  const dailyFlowComplete = today.dailyFlowComplete;

  const modalMission = selectedMission?.mission?.id
    ? prescribed.find((m) => m.id === selectedMission.mission.id) ?? selectedMission.mission
    : null;

  async function handleModalComplete(missionId) {
    const mission = prescribed.find((m) => m.id === missionId);
    if (!mission || isMissionCompletedToday(mission)) return;
    if (!mission.started) await handleStart(missionId);
    await handleComplete(missionId, today.hill.code);
  }

  const sheetHill =
    journeyView === 'sheet' && sheetHillCode
      ? dashboardHills.find((h) => h.code === sheetHillCode) ?? null
      : null;
  const sheetIsToday = Boolean(sheetHill && today?.hill?.code === sheetHill.code);
  const climbHill =
    journeyView === 'sheet' && sheetHill
      ? sheetHill
      : today?.hill ?? null;
  const climbSteps =
    journeyView === 'sheet' && sheetHill
      ? sheetHill.completedSteps ?? 0
      : completedSteps;
  const showPulse =
    (!journeyView || journeyView === 'pulse' || (journeyView === 'sheet' && sheetIsToday)) &&
    Boolean(today);

  function renderMountain() {
    if (!climbHill) return null;
    return (
      <HillMountainVisual
        hill={climbHill}
        completedSteps={climbSteps}
        variant={sheetIsToday || journeyView !== 'sheet' ? 'assigned' : 'optional'}
      />
    );
  }

  function renderPulseBlock() {
    if (!today || !showPulse) return null;

    if (today.needsDailyMissionPick) {
      return (
        <button
          type="button"
          onClick={() => setPreviewDay({ dayIndex: today.dayIndex, hill: today.hill })}
          className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white"
        >
          Pick your 3 missions for today
        </button>
      );
    }

    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-[#111] p-3 shadow-inner">
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-rose-400">
            Pulse &amp; Glow (Today&apos;s Hill)
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scroll-smooth">
            {prescribed.map((mission, index) => {
              const done = isMissionCompleted(mission);
              const locked = !done && index > prescribedCompleted;
              return (
                <PulseGlowMissionCard
                  key={mission.id}
                  index={index}
                  mission={mission}
                  accent={accent}
                  coinReward={flowWeek.coinRewards?.prescribedMission ?? 100}
                  completed={done}
                  completedToday={isMissionCompletedToday(mission)}
                  busy={busyId === mission.id}
                  locked={locked}
                  useModal={embeddedInJourney || journeyView === 'sheet'}
                  onOpen={(m) => {
                    if (!m.started && !isMissionCompletedToday(m)) void handleStart(m.id);
                    setSelectedMission({ mission: m, index });
                  }}
                  expanded={expandedId === mission.id}
                  onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                  onWhy={setWhyMission}
                  onStart={handleStart}
                  onComplete={(id) => handleComplete(id, today.hill.code)}
                />
              );
            })}
            {!embeddedInJourney && !journeyView && dailyFlowComplete ? (
              <ExtraMissionCard
                coinReward={flowWeek.coinRewards?.optionalOffHillMission ?? 10}
                onExplore={() => {
                  document.getElementById('other-hills')?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            ) : null}
          </div>
        </div>

        {dailyFlowComplete ? (
          <div className="rounded-2xl border border-emerald-300/50 bg-gradient-to-r from-emerald-900/40 to-violet-900/40 p-4 text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-200">
              <Sparkles className="h-4 w-4" /> Flow complete
            </p>
            <p className="mt-1 text-xs text-violet-100">
              +200 bonus · +1 hill step · +1 glow seed · Chakra activated
            </p>
          </div>
        ) : journeyView !== 'sheet' && !embeddedInJourney ? (
          <p className="text-center text-xs text-violet-500">
            {prescribedCompleted}/3 missions · Complete all 3 for +200 bonus, +1 step &amp; +1 glow seed
          </p>
        ) : journeyView === 'sheet' || embeddedInJourney ? (
          <p className="text-center text-xs text-violet-400">
            {prescribedCompleted}/3 missions toward today&apos;s flow bonus
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        {!embeddedInJourney ? (
          <header>
            <h1 className="font-display text-2xl font-semibold text-violet-950">Missions</h1>
            <p className="mt-0.5 text-sm text-violet-600">
              Climb today&apos;s hill · Complete 3 missions · Earn your Glow Seed
            </p>
          </header>
        ) : null}

        {journeyView === 'climb' ? (
          <section className="space-y-4">{renderMountain()}</section>
        ) : null}

        {journeyView === 'pulse' ? (
          <section className="space-y-4">{renderPulseBlock()}</section>
        ) : null}

        {journeyView === 'sheet' ? (
          <section className="space-y-4">
            {renderMountain()}
            {sheetIsToday ? (
              renderPulseBlock()
            ) : (
              <p className="rounded-2xl border border-violet-500/20 bg-violet-950/40 px-4 py-3 text-sm text-violet-200/90">
                Missions for this hill unlock on its assigned day in your FLOW week. Today&apos;s
                active hill is{' '}
                <span className="font-semibold text-violet-50">
                  {today?.hill ? formatHillTitle(today.hill) : 'shown on Pulse'}
                </span>
                .
              </p>
            )}
          </section>
        ) : null}

        {!journeyView ? (
        <>
        {/* Section A — Today's Assigned Hill */}
        <section className="space-y-4">
          {renderMountain()}
          {renderPulseBlock()}
          {!embeddedInJourney ? <WeeklyResetNote /> : null}
        </section>
        </>
        ) : null}

        {!journeyView && !embeddedInJourney ? (
          <section id="other-hills" className="space-y-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-500">
                Your other hills
              </p>
              <p className="text-sm text-violet-700">Want to GROW more? Choose any hill.</p>
            </div>

            {otherHills.map((hill) => (
              <OtherHillCompactCard
                key={hill.code}
                hill={hill}
                missionsToday={hill.missionsCompletedThisStep ?? 0}
                onViewHill={(h) => {
                  setExpandedOptionalHill((prev) => (prev?.code === h.code ? null : h));
                }}
              />
            ))}

            {expandedOptionalHill ? (
              <div className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">
                    Optional hill today
                  </p>
                  <p className="font-display text-lg font-semibold text-violet-950">
                    {formatHillTitle(expandedOptionalHill)}
                  </p>
                  <p className="text-sm text-violet-600">
                    Explore this hill if you want to GROW more · +10 coins per mission
                  </p>
                </div>
                <HillMountainVisual
                  hill={expandedOptionalHill}
                  completedSteps={expandedOptionalHill.completedSteps ?? 0}
                  variant="optional"
                />
              </div>
            ) : null}

            <FlowWeekOptionalMissions
              reloadKey={optionalReload}
              localPatch={optionalPatch}
              expandedId={expandedId}
              busyId={busyId}
              onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
              onStart={handleStart}
              onComplete={handleComplete}
              embedded
            />
          </section>
        ) : null}

        {!embeddedInJourney ? (
          <div className="rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-4 text-center">
            <p className="text-sm font-semibold text-violet-900">
              7 Hills · 49 Steps Each · 1 Beautiful Life
            </p>
            <Link
              to="/journey"
              className="mt-3 inline-flex items-center gap-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              View My Tree of Life →
            </Link>
          </div>
        ) : null}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>

      <PulseMissionDetailModal
        open={Boolean(selectedMission)}
        mission={modalMission}
        missionIndex={selectedMission?.index ?? 0}
        coinReward={flowWeek?.coinRewards?.prescribedMission ?? 100}
        busy={Boolean(selectedMission && busyId === selectedMission.mission?.id)}
        accent={accent}
        isRecommended={modalMission?.isRecommended !== false}
        onClose={() => setSelectedMission(null)}
        onComplete={handleModalComplete}
      />

      <MissionWhySheet
        open={Boolean(whyMission)}
        title={whyMission?.title}
        whyText={whyMission?.whyText}
        onClose={() => setWhyMission(null)}
      />

      <FlowWeekDayPreviewModal
        open={Boolean(previewDay)}
        dayIndex={previewDay?.dayIndex ?? null}
        hill={previewDay?.hill ?? null}
        focusHillId={flowWeek?.focusHill?.id ?? null}
        onClose={() => setPreviewDay(null)}
        onConfirmed={(data) => setFlowWeek(data)}
      />

      <MissionCelebrationModal
        open={Boolean(celebration)}
        missionTitle={celebration?.missionTitle}
        coinReward={celebration?.coinReward}
        dailyBonusAwarded={celebration?.dailyBonusAwarded ?? 0}
        dailySeedsAwarded={celebration?.dailySeedsAwarded ?? 0}
        perfectWeekBonusAwarded={celebration?.perfectWeekBonusAwarded ?? 0}
        perfectWeekSeedsAwarded={celebration?.perfectWeekSeedsAwarded ?? 0}
        showChakra={celebration?.showChakra ?? false}
        chakraHillCode={celebration?.chakraHillCode ?? null}
        chakraHillName={celebration?.chakraHillName ?? null}
        chakraSlotsFilled={celebration?.chakraSlotsFilled ?? 0}
        chakraActivated={celebration?.chakraActivated ?? false}
        extraCompleted={celebration?.extraCompleted ?? 0}
        isPrescribed={celebration?.isPrescribed ?? true}
        onConfirm={() => {
          setCelebration(null);
          if (pendingChallengeComplete) {
            setChallengeComplete(pendingChallengeComplete);
            setPendingChallengeComplete(null);
          }
        }}
      />

      <GrowChallengeCompleteModal
        open={Boolean(challengeComplete)}
        challenge={challengeComplete}
        onConfirm={() => setChallengeComplete(null)}
      />

      <CampCelebrationModal
        open={Boolean(campReached)}
        camp={campReached?.camp}
        hillTitle={campReached?.hillTitle}
        onConfirm={() => setCampReached(null)}
      />

      <TreeLevelUpModal
        open={Boolean(treeLevelUp)}
        stage={treeLevelUp?.newStage}
        level={treeLevelUp?.newLevel}
        onConfirm={() => setTreeLevelUp(null)}
      />
    </>
  );
}
