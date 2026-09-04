import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, ChevronRight, Coins } from 'lucide-react';
import { api } from '../lib/api';
import { formatHillTitle } from '../lib/hills';
import { isMissedDayBlockingError, redirectHomeForMissedDay } from '../lib/missedDayBlock';
import { MissionCelebrationModal } from './MissionCelebrationModal';
import { CampCelebrationModal } from './CampCelebrationModal';
import { TreeLevelUpModal } from './TreeLevelUpModal';
import { FlowWeekDayPreviewModal } from './FlowWeekDayPreviewModal';
import { FlowWeekOptionalMissions } from './FlowWeekOptionalMissions';
import { formatMissionCompletedAt } from './FlowWeekCoinRewardsNote';
import { useAuthStore } from '../store/useAuthStore';
import { useDashboard } from '../context/DashboardContext';
import { MissionWhyDisclosure } from './MissionWhyDisclosure';
import { MissionStatusSelect } from './MissionStatusSelect';
import { GrowChallengeCompleteModal } from './GrowChallengeCompleteModal';
import { didJustCompleteGrowChallenge } from '../lib/growChallenge';

const TABS = [
  { id: 'today', label: 'Home Hill' },
  { id: 'week', label: 'This Week' },
  { id: 'bonus', label: 'Other Hills' },
];

function formatWeekday(calendarDate) {
  return new Date(calendarDate).toLocaleDateString(undefined, { weekday: 'short' });
}

function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function triggerTreePulse({ hillCode, kind }) {
  if (!hillCode) return;
  const payload = { hillCode, kind, at: Date.now() };
  try {
    localStorage.setItem('gofam_tree_pulse', JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('gofam_tree_pulse'));
  } catch {
    // ignore (localStorage might be blocked)
  }
}

function getDayDisplayState(day, { todayComplete = false } = {}) {
  const completed = day.prescribedCompleted ?? day.homeBonusSlotsUsed ?? 0;
  const isDone = day.dailyFlowComplete || completed >= 3;

  const todayStart = startOfLocalDay(new Date());
  const dayStart = startOfLocalDay(day.calendarDate);
  const isFuture = dayStart > todayStart;
  const isTomorrow =
    isFuture && dayStart.getTime() - todayStart.getTime() === 24 * 60 * 60 * 1000;

  if (isDone) {
    return {
      label: 'Done',
      rowClass: 'border-emerald-200 bg-emerald-50/60',
      badgeClass: 'bg-emerald-600 text-white',
      accent: day.hill?.colorTheme ?? '#10B981',
    };
  }

  if (day.isToday) {
    if (completed > 0) {
      return {
        label: `${completed}/3`,
        rowClass: 'border-amber-300 bg-amber-50 ring-1 ring-amber-200',
        badgeClass: 'bg-amber-500 text-white',
        accent: day.hill?.colorTheme ?? '#F59E0B',
      };
    }
    return {
      label: 'Today',
      rowClass: 'border-violet-400 bg-violet-50 ring-1 ring-violet-200',
      badgeClass: 'bg-violet-600 text-white',
      accent: day.hill?.colorTheme ?? '#7C3AED',
    };
  }

  if (isFuture) {
    return {
      label: 'Upcoming',
      rowClass: isTomorrow && todayComplete
        ? 'border-sky-400 bg-sky-50 ring-1 ring-sky-200'
        : 'border-sky-100 bg-white',
      badgeClass: isTomorrow && todayComplete
        ? 'bg-sky-600 text-white'
        : 'bg-sky-100 text-sky-800',
      accent: day.hill?.colorTheme ?? '#0EA5E9',
    };
  }

  return {
    label: day.lateCatchUp ? '+10 only' : `${completed}/3`,
    rowClass: 'border-rose-200 bg-rose-50/60',
    badgeClass: 'bg-rose-100 text-rose-800',
    accent: day.hill?.colorTheme ?? '#F43F5E',
  };
}

function MissionTabs({ activeTab, onChange, todayComplete }) {
  return (
    <div className="flex gap-1 rounded-xl bg-violet-100/80 p-1">
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        const highlight = tab.id === 'week' && todayComplete;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              'relative flex-1 rounded-lg px-2 py-2.5 text-xs font-semibold transition',
              active
                ? 'bg-white text-violet-900 shadow-sm'
                : 'text-violet-600 hover:text-violet-800',
            ].join(' ')}
          >
            {tab.label}
            {highlight && !active ? (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function FlowWeekHero({ flowWeek, today, extraCoinsToday = 0 }) {
  const slotsUsed = today.homeBonusSlotsUsed ?? today.prescribedCompleted ?? 0;
  const prescribedTotal =
    flowWeek.coinRewards.prescribedMission * 3 + flowWeek.coinRewards.dailyFlowBonus;
  const todayCoins = today.dailyFlowComplete
    ? prescribedTotal + extraCoinsToday
    : slotsUsed * flowWeek.coinRewards.prescribedMission + extraCoinsToday;
  const isFocusToday = Boolean(flowWeek?.focusHill && today?.hill?.id === flowWeek.focusHill.id);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm"
      style={{ borderTopWidth: 4, borderTopColor: today.hill.colorTheme ?? '#7C3AED' }}
    >
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-500">
              {isFocusToday ? 'Home Hill · Focus Day' : "Today's Home Hill"}
            </p>
            <p className="font-display text-xl font-semibold text-violet-950">
              {formatHillTitle(today.hill)}
            </p>
            <p className="mt-1 text-xs text-violet-600">
              Complete any 3 missions for +{prescribedTotal} coins. Extras & other hills: +
              {flowWeek.coinRewards.optionalOffHillMission} each.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">
              Earned today
            </p>
            <p className="inline-flex items-center gap-1 font-display text-lg font-bold text-amber-700">
              <Coins className="h-4 w-4" aria-hidden="true" />
              {todayCoins}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={[
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold',
              today.dailyFlowComplete
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-violet-100 text-violet-800',
            ].join(' ')}
          >
            {today.dailyFlowComplete ? (
              <>
                <Check className="h-3 w-3" /> Home Hill bonus claimed
              </>
            ) : (
              <>
                {slotsUsed}/3 toward +{flowWeek.coinRewards.dailyFlowBonus} bonus
              </>
            )}
          </span>
          {extraCoinsToday > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-800">
              +{extraCoinsToday} other hills
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function buildHomeHillPrimary(missions, today, prescribedCoin) {
  const byId = new Map(missions.map((m) => [m.id, m]));
  const dailyComplete = Boolean(today?.dailyFlowComplete);
  const prescribed = today?.prescribedMissions ?? [];
  const primaryIds = new Set();
  const primary = [];

  for (const pm of prescribed) {
    const rich = byId.get(pm.id);
    if (!rich) continue;
    primaryIds.add(pm.id);
    const completed = rich.completedToday || pm.completed;
    primary.push({
      ...rich,
      coinReward: prescribedCoin,
      isDailyMission: true,
      completedToday: completed,
      completionCount: Math.max(rich.completionCount ?? 0, completed ? 1 : 0),
      completionLabel:
        (rich.completionCount ?? 0) > 0 || completed
          ? rich.completionLabel ?? 'Completed 1 time'
          : 'Not completed',
    });
  }

  if (primary.length < 3 && !dailyComplete) {
    const recommended = missions.filter((m) => m.isRecommended && !primaryIds.has(m.id));
    for (const m of recommended) {
      if (primary.length >= 3) break;
      primaryIds.add(m.id);
      primary.push({
        ...m,
        coinReward: prescribedCoin,
        isDailyMission: true,
      });
    }
  }

  if (primary.length < 3 && !dailyComplete) {
    for (const m of missions) {
      if (primary.length >= 3) break;
      if (primaryIds.has(m.id)) continue;
      primaryIds.add(m.id);
      primary.push({
        ...m,
        coinReward: prescribedCoin,
        isDailyMission: true,
      });
    }
  }

  const extras = missions.filter((m) => !primaryIds.has(m.id));
  return { primary, extras };
}

function HillMissionRow({
  mission,
  index,
  expanded,
  busy,
  onToggle,
  onStart,
  onComplete,
}) {
  const count = mission.completionCount ?? 0;
  const completedToday = Boolean(mission.completedToday);
  const dailyMission = Boolean(mission.isDailyMission);
  const label = mission.completionLabel ?? (count > 0 ? `Completed ${count} time${count === 1 ? '' : 's'}` : 'Not completed');
  const completedLabel = formatMissionCompletedAt(mission.lastCompletedAt ?? mission.completedAt);

  return (
    <div
      className={[
        'rounded-xl border px-4 py-3',
        dailyMission && count === 0
          ? 'border-violet-400 bg-violet-50/70 ring-1 ring-violet-200'
          : count > 0
            ? 'border-emerald-200 bg-emerald-50/40'
            : 'border-violet-200 bg-white',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => onToggle(mission.id)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-violet-500">
            <span>
              Mission {index + 1}
              <span className={['ml-2', count > 0 ? 'text-emerald-700' : 'text-violet-400'].join(' ')}>
                · {label}
              </span>
            </span>
            {dailyMission ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                {count > 0 ? 'Daily · done' : 'Daily mission'}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 font-semibold text-violet-950">{mission.title}</p>
          {!expanded ? (
            <p className="mt-1 text-xs text-violet-700/80 line-clamp-2">{mission.description}</p>
          ) : null}
          {count > 0 && completedLabel && !expanded ? (
            <p className="mt-1 text-[11px] font-medium text-emerald-700">Last: {completedLabel}</p>
          ) : null}
        </div>
        {!expanded ? (
          <>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
              +{mission.coinReward}
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-violet-400 transition"
              aria-hidden="true"
            />
          </>
        ) : (
          <ChevronRight
            className="h-4 w-4 shrink-0 rotate-90 text-violet-400 transition"
            aria-hidden="true"
          />
        )}
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-violet-100 pt-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-500">Mission</p>
            <p className="mt-1 text-sm leading-relaxed text-violet-900">{mission.description}</p>
          </div>
          <MissionWhyDisclosure whyText={mission.whyText} />
          <div className="flex items-center justify-between rounded-xl border border-violet-100 bg-white px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-500">Reward</p>
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-800">
              <Coins className="h-4 w-4" aria-hidden="true" />
              +{mission.coinReward} coins
            </p>
          </div>
          {!mission.started && count === 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onStart(mission.id)}
              className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Start
            </button>
          ) : completedToday ? (
            <p className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-800">
              Done today — pick a different mission
            </p>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onComplete(mission.id)}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white disabled:opacity-60"
            >
              {busy ? 'Completing…' : count > 0 ? 'Complete again' : 'Complete mission'}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function HomeHillMissionList({
  missions,
  today,
  prescribedCoin,
  expandedId,
  busyId,
  onToggle,
  onStart,
  onComplete,
}) {
  const { primary, extras } = buildHomeHillPrimary(missions, today, prescribedCoin);

  const [pickedExtraId, setPickedExtraId] = useState('');
  const pickedExtra = extras.find((m) => m.id === pickedExtraId) ?? null;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {primary.map((mission, index) => (
          <HillMissionRow
            key={mission.id}
            mission={mission}
            index={index}
            expanded={expandedId === mission.id}
            busy={busyId === mission.id}
            onToggle={onToggle}
            onStart={onStart}
            onComplete={onComplete}
          />
        ))}
      </div>

      {extras.length > 0 ? (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-3">
          <MissionStatusSelect
            label="More missions on this hill"
            missions={extras}
            value={pickedExtraId}
            onChange={setPickedExtraId}
            primaryOffset={primary.length}
            getOptionMeta={(mission) => ({
              done: (mission.completionCount ?? 0) > 0,
              title: mission.title,
              coinReward: mission.coinReward,
            })}
          />

          {pickedExtra ? (
            <div className="mt-3">
              <HillMissionRow
                mission={pickedExtra}
                index={extras.findIndex((m) => m.id === pickedExtra.id) + primary.length}
                expanded
                busy={busyId === pickedExtra.id}
                onToggle={onToggle}
                onStart={onStart}
                onComplete={onComplete}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function WeekDayList({ weekDays, today, onSelectDay, focusHillId, previewOnly = false }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-violet-950">Your FLOW Week</p>
        <p className="text-xs text-violet-600/80">
          {previewOnly
            ? 'Preview your hills for this 7-day slice. Missions start on your signup date (Day 1).'
            : 'Day 1 is your signup date. One Home Hill per day — earn Glow Seeds toward your 30-day challenge.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-[10px] font-medium text-violet-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Done
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> In progress
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-500" /> Upcoming
        </span>
      </div>
      <div className="space-y-2">
        {weekDays.map((day) => {
          const display = getDayDisplayState(day, {
            todayComplete: today?.dailyFlowComplete ?? false,
          });
          const isFocusDay = Boolean(focusHillId) && day?.hill?.id === focusHillId;
          return (
            <button
              key={day.dayIndex}
              type="button"
              onClick={() => onSelectDay({ dayIndex: day.dayIndex, hill: day.hill })}
              className={[
                'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:brightness-[0.98]',
                display.rowClass,
              ].join(' ')}
              style={{ borderLeftWidth: 4, borderLeftColor: display.accent }}
            >
              <span className="w-14 shrink-0">
                <span className="block text-[10px] font-bold uppercase text-violet-500">
                  Day {day.journeyDayIndex ?? day.dayIndex}
                </span>
                <span className="text-[11px] text-violet-500">{formatWeekday(day.calendarDate)}</span>
              </span>
              <span className="min-w-0 flex-1 font-semibold text-violet-950">
                {formatHillTitle(day.hill)}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {day.isFlowIndexDay ? (
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold uppercase text-sky-800">
                    FLOW Index
                  </span>
                ) : null}
                {day.isToday && isFocusDay ? (
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase text-violet-800">
                    Focus
                  </span>
                ) : null}
                <span
                  className={[
                    'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase',
                    display.badgeClass,
                  ].join(' ')}
                >
                  {display.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FlowWeekMissionsPanel() {
  const [searchParams] = useSearchParams();
  const [flowWeek, setFlowWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [campReached, setCampReached] = useState(null);
  const [treeLevelUp, setTreeLevelUp] = useState(null);
  const [previewDay, setPreviewDay] = useState(null);
  const [optionalReload, setOptionalReload] = useState(0);
  const [optionalPatch, setOptionalPatch] = useState(null);
  const [activeTab, setActiveTab] = useState('today');
  const [localChallenge, setLocalChallenge] = useState(null);
  const [pendingChallengeComplete, setPendingChallengeComplete] = useState(null);
  const [challengeComplete, setChallengeComplete] = useState(null);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { data: dashboardData, refresh: refreshDashboard } = useDashboard();
  const growChallenge = dashboardData?.growChallenge ?? null;

  useEffect(() => {
    setLocalChallenge(growChallenge);
  }, [growChallenge]);

  function trackGrowChallengeFromResult(result) {
    const challengeBefore = localChallenge ?? growChallenge;
    if (!result?.growChallenge) return;
    setLocalChallenge(result.growChallenge);
    if (didJustCompleteGrowChallenge(challengeBefore, result.growChallenge)) {
      setPendingChallengeComplete(result.growChallenge);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getFlowWeek();
        if (!cancelled) {
          setFlowWeek(data);
          if (data?.weekNotStartedYet) setActiveTab('week');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load FLOW Week');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!flowWeek) return;
    const missedDayIndex = Number(searchParams.get('missedDay'));
    if (!Number.isFinite(missedDayIndex) || missedDayIndex < 1) return;
    const day = (flowWeek.weekDays ?? []).find((d) => d.dayIndex === missedDayIndex);
    setActiveTab('week');
    setPreviewDay({
      dayIndex: missedDayIndex,
      hill: day?.hill ?? flowWeek.today?.hill ?? null,
    });
  }, [flowWeek, searchParams]);

  async function handleStart(missionId) {
    setBusyId(missionId);
    setError('');
    try {
      await api.startFlowWeekMission(missionId);
      setFlowWeek((prev) => {
        if (!prev?.today) return prev;
        const markStarted = (list) =>
          (list ?? []).map((m) => (m.id === missionId ? { ...m, started: true } : m));
        return {
          ...prev,
          today: {
            ...prev.today,
            hillMissions: markStarted(prev.today.hillMissions),
            prescribedMissions: markStarted(prev.today.prescribedMissions),
          },
        };
      });
      setOptionalPatch({ missionId, completed: false, at: Date.now() });
    } catch (err) {
      if (isMissedDayBlockingError(err)) {
        redirectHomeForMissedDay();
        return;
      }
      setError(err.message || 'Could not start mission');
    } finally {
      setBusyId(null);
    }
  }

  async function handleComplete(missionId, hillCodeForPulse = null) {
    setBusyId(missionId);
    setError('');
    try {
      const prescribedHillCode = flowWeek?.today?.hill?.code ?? null;
      const result = await api.completeFlowWeekMission(missionId);
      if (result.flowWeek) {
        setFlowWeek(result.flowWeek);
      } else {
        const awarded = result.coinsAwarded ?? result.coinReward ?? 10;
        setFlowWeek((prev) =>
          prev
            ? {
                ...prev,
                extraCoinsEarnedToday: (prev.extraCoinsEarnedToday ?? 0) + awarded,
              }
            : prev,
        );
      }
      setOptionalPatch({
        missionId,
        completed: true,
        extraCoinsEarnedToday:
          result.flowWeek?.extraCoinsEarnedToday ??
          (flowWeek?.extraCoinsEarnedToday ?? 0) + (result.coinsAwarded ?? result.coinReward ?? 10),
        at: Date.now(),
      });
      setExpandedId(null);
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
      trackGrowChallengeFromResult(result);

      const isDailyFlowJustCompleted = (result.dailyBonusAwarded ?? 0) > 0;
      const pulseHillCode = result.isTodayHomeHill || result.isPrescribed
        ? prescribedHillCode
        : hillCodeForPulse;
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
        stepAwarded: result.stepAwarded,
        dailyBonusAwarded: result.dailyBonusAwarded ?? 0,
        dailySeedsAwarded: result.dailySeedsAwarded ?? 0,
        perfectWeekBonusAwarded: result.perfectWeekBonusAwarded ?? 0,
        perfectWeekSeedsAwarded: result.perfectWeekSeedsAwarded ?? 0,
        starterWeekJustCompleted: result.starterWeekJustCompleted ?? false,
        lateCatchUp: result.lateCatchUp ?? false,
        isPrescribed: result.isPrescribed ?? true,
        coinsAwarded: result.coinsAwarded ?? result.coinReward,
        showChakra,
        chakraHillCode: showChakra ? (todayAfter?.hill?.code ?? prescribedHillCode) : null,
        chakraHillName: showChakra ? (todayAfter?.hill?.name ?? null) : null,
        chakraSlotsFilled: showChakra ? Math.max(0, chakraSlotsFilled) : 0,
        chakraActivated: Boolean(todayAfter?.dailyFlowComplete || isDailyFlowJustCompleted),
        extraCompleted: result.extraCompleted ?? 0,
        rewardKind: result.rewardKind ?? null,
      });
      if (result.campReached) {
        setCampReached({
          camp: result.campReached,
          hillTitle: result.flowWeek?.today?.hill?.name ?? result.missionTitle,
        });
      }
      if (result.treeLevelUp) {
        setTreeLevelUp(result.treeLevelUp);
      }
      // Soft background refresh — do not blank the Other Hills list.
      setOptionalReload((n) => n + 1);
    } catch (err) {
      if (isMissedDayBlockingError(err)) {
        redirectHomeForMissedDay();
        return;
      }
      setError(err.message || 'Could not complete mission');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-violet-600">Loading your FLOW Week…</p>;
  }

  if (error && !flowWeek) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }

  if (!flowWeek?.today && !flowWeek?.weekNotStartedYet) {
    const startsAt = flowWeek?.personalWeekStart
      ? new Date(flowWeek.personalWeekStart).toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })
      : flowWeek?.gofamWeekStartLabel;
    return (
      <div className="rounded-2xl border border-violet-100 bg-white p-5 text-sm text-violet-700">
        <p className="font-semibold text-violet-950">No mission day scheduled for today</p>
        <p className="mt-2">
          Your personal week starts on <span className="font-semibold">{startsAt}</span>.
        </p>
      </div>
    );
  }

  const weekNotStartedYet = Boolean(flowWeek?.weekNotStartedYet && !flowWeek?.today);
  const today = flowWeek?.today ?? null;
  const weekDays = flowWeek?.weekDays ?? [];
  const startsAtLabel = flowWeek?.personalWeekStart
    ? new Date(flowWeek.personalWeekStart).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : flowWeek?.gofamWeekStartLabel;

  const tomorrow = weekDays.find((day) => {
    if (day.isToday || day.dailyFlowComplete) return false;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dayStart = new Date(day.calendarDate);
    dayStart.setHours(0, 0, 0, 0);
    return dayStart > todayStart;
  });

  if (weekNotStartedYet) {
    return (
      <>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
            <div className="border-b border-violet-100 bg-violet-50/80 px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-violet-500">
                Before your week starts
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-violet-950">
                Missions unlock {startsAtLabel}
              </p>
            </div>
          </div>

          <MissionTabs activeTab={activeTab} onChange={setActiveTab} todayComplete={false} />

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          {activeTab === 'today' ? (
            <div className="rounded-2xl border border-violet-100 bg-white p-5 text-sm text-violet-700">
              <p className="font-semibold text-violet-950">Today — waiting for week start</p>
              <p className="mt-2">
                Day 1 will be{' '}
                <span className="font-semibold">
                  {weekDays[0] ? formatHillTitle(weekDays[0].hill) : 'your focus hill'}
                </span>{' '}
                on {startsAtLabel}. No missions can be completed until then.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('week')}
                className="mt-3 text-xs font-semibold text-violet-700 underline underline-offset-2"
              >
                Preview your full week →
              </button>
            </div>
          ) : null}

          {activeTab === 'week' ? (
            <WeekDayList
              weekDays={weekDays}
              today={today}
              onSelectDay={setPreviewDay}
              focusHillId={flowWeek?.focusHill?.id ?? null}
              previewOnly
            />
          ) : null}

          {activeTab === 'bonus' ? (
            <div className="rounded-2xl border border-violet-100 bg-white p-5 text-sm text-violet-700">
              Bonus missions unlock when your FLOW week starts on {startsAtLabel}.
            </div>
          ) : null}
        </div>

        <FlowWeekDayPreviewModal
          open={Boolean(previewDay)}
          dayIndex={previewDay?.dayIndex ?? null}
          hill={previewDay?.hill ?? null}
          focusHillId={flowWeek?.focusHill?.id ?? null}
          onClose={() => setPreviewDay(null)}
          onConfirmed={(data) => setFlowWeek(data)}
        />
      </>
    );
  }

  if (!today) {
    return null;
  }

  return (
    <>
      <div className="space-y-4">
        <FlowWeekHero
          flowWeek={flowWeek}
          today={today}
          extraCoinsToday={flowWeek.extraCoinsEarnedToday ?? 0}
        />

        <MissionTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          todayComplete={today.dailyFlowComplete}
        />

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        {activeTab === 'today' ? (
          <div className="space-y-3">
            <HomeHillMissionList
              missions={today.hillMissions?.length ? today.hillMissions : today.prescribedMissions}
              today={today}
              prescribedCoin={flowWeek.coinRewards.prescribedMission}
              expandedId={expandedId}
              busyId={busyId}
              onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
              onStart={handleStart}
              onComplete={(id) => handleComplete(id, today.hill?.code)}
            />
            {tomorrow && today.dailyFlowComplete ? (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('week');
                  setPreviewDay({ dayIndex: tomorrow.dayIndex, hill: tomorrow.hill });
                }}
                className="w-full rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-left text-sm text-violet-900 transition hover:bg-violet-100"
              >
                <span className="font-semibold">Next up:</span> Day {tomorrow.dayIndex} ·{' '}
                {formatHillTitle(tomorrow.hill)} — tomorrow&apos;s Home Hill
              </button>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'week' ? (
          <WeekDayList
            weekDays={weekDays}
            today={today}
            onSelectDay={setPreviewDay}
            focusHillId={flowWeek?.focusHill?.id ?? null}
          />
        ) : null}

        {activeTab === 'bonus' ? (
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
        ) : null}

        {celebration?.starterWeekJustCompleted ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Starter FLOW Week achieved! Next week starts the full 7-hill cycle from Day 1.
          </p>
        ) : null}

        {celebration?.stepAwarded ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Daily FLOW complete — +1 Step on today&apos;s assigned hill
            {(celebration.dailySeedsAwarded ?? 0) > 0 ? ' and +1 Glow Seed' : ''}!
          </p>
        ) : null}
      </div>

      <FlowWeekDayPreviewModal
        open={Boolean(previewDay)}
        dayIndex={previewDay?.dayIndex ?? null}
        hill={previewDay?.hill ?? null}
        focusHillId={flowWeek?.focusHill?.id ?? null}
        onClose={() => setPreviewDay(null)}
        onConfirmed={(data, result) => {
          if (data) setFlowWeek(data);
            if (result?.lateCatchUp || result?.coinReward != null) {
              trackGrowChallengeFromResult(result);
              void refreshDashboard();
              const todayAfter = data?.today ?? flowWeek?.today;
            const chakraSlotsFilled = Math.min(
              3,
              todayAfter?.homeBonusSlotsUsed ?? todayAfter?.prescribedCompleted ?? 0,
            );
            const showChakra = Boolean(result.isTodayHomeHill);
            setCelebration({
              missionTitle: result.missionTitle,
              coinReward: result.coinReward,
              stepAwarded: result.stepAwarded,
              dailyBonusAwarded: result.dailyBonusAwarded ?? 0,
              dailySeedsAwarded: result.dailySeedsAwarded ?? 0,
              perfectWeekBonusAwarded: result.perfectWeekBonusAwarded ?? 0,
              perfectWeekSeedsAwarded: result.perfectWeekSeedsAwarded ?? 0,
              starterWeekJustCompleted: result.starterWeekJustCompleted ?? false,
              lateCatchUp: result.lateCatchUp ?? false,
              isPrescribed: result.isPrescribed ?? true,
              coinsAwarded: result.coinsAwarded ?? result.coinReward,
              showChakra,
              chakraHillCode: showChakra ? (todayAfter?.hill?.code ?? null) : null,
              chakraHillName: showChakra ? (todayAfter?.hill?.name ?? null) : null,
              chakraSlotsFilled: showChakra ? Math.max(0, chakraSlotsFilled) : 0,
              chakraActivated: Boolean(
                todayAfter?.dailyFlowComplete || (result.dailyBonusAwarded ?? 0) > 0,
              ),
              extraCompleted: result.extraCompleted ?? 0,
              rewardKind: result.rewardKind ?? null,
            });
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
          }
        }}
      />

      <MissionCelebrationModal
        open={Boolean(celebration)}
        missionTitle={celebration?.missionTitle}
        coinReward={celebration?.coinReward}
        dailyBonusAwarded={celebration?.dailyBonusAwarded ?? 0}
        dailySeedsAwarded={celebration?.dailySeedsAwarded ?? 0}
        perfectWeekBonusAwarded={celebration?.perfectWeekBonusAwarded ?? 0}
        perfectWeekSeedsAwarded={celebration?.perfectWeekSeedsAwarded ?? 0}
        starterWeekJustCompleted={celebration?.starterWeekJustCompleted ?? false}
        lateCatchUp={celebration?.lateCatchUp ?? false}
        isPrescribed={celebration?.isPrescribed ?? true}
        showChakra={celebration?.showChakra ?? false}
        chakraHillCode={celebration?.chakraHillCode ?? null}
        chakraHillName={celebration?.chakraHillName ?? null}
        chakraSlotsFilled={celebration?.chakraSlotsFilled ?? 0}
        extraCompleted={celebration?.extraCompleted ?? 0}
        chakraActivated={celebration?.chakraActivated ?? false}
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
