import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '../lib/api';
import { isMissedDayBlockingError, redirectHomeForMissedDay } from '../lib/missedDayBlock';
import { formatHillSubtitle, formatHillTitle } from '../lib/hills';
import { formatMissionCompletedAt } from './FlowWeekCoinRewardsNote';
import { FlowWeekOptionalCompletedList } from './FlowWeekOptionalMissions';
import { MissionStatusSelect } from './MissionStatusSelect';

const PICK_COUNT = 3;

function dayRewardAmounts(rewards) {
  return {
    perMission: rewards?.prescribedMission > 0 ? rewards.prescribedMission : 100,
    dailyBonus: 200,
    extra: rewards?.optionalOffHillMission > 0 ? rewards.optionalOffHillMission : 10,
  };
}

function DayRewardsSummary({ rewards, lateCatchUp, dailyFlowComplete, extraCoinsEarnedToday }) {
  const { perMission, dailyBonus, extra } = dayRewardAmounts(rewards);
  const threeTotal = perMission * 3;

  if (lateCatchUp) {
    return (
      <div className="mt-3 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-xs leading-snug text-amber-900">
        <p className="font-semibold">Missed day · +{extra} per mission</p>
        <p className="mt-0.5 text-amber-800/80">No daily bonus</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl bg-violet-50 px-3.5 py-2.5 text-xs leading-snug text-violet-800">
      <p className="font-semibold text-violet-900">
        3 missions = {threeTotal} + {dailyBonus} bonus
      </p>
      {dailyFlowComplete ? (
        <p className="mt-1 font-semibold text-emerald-700">Daily bonus claimed</p>
      ) : extraCoinsEarnedToday > 0 ? (
        <p className="mt-1 font-semibold text-emerald-700">+{extraCoinsEarnedToday} extra today</p>
      ) : null}
    </div>
  );
}

function splitRecommendedMissions(missions = []) {
  const list = missions ?? [];
  const recommended = list.filter((m) => m.isRecommended);
  if (recommended.length > 0) {
    return {
      primary: recommended,
      extras: list.filter((m) => !m.isRecommended),
    };
  }
  return {
    primary: list.slice(0, PICK_COUNT),
    extras: list.slice(PICK_COUNT),
  };
}

function DayMissionListWithDropdown({
  missions,
  canPick,
  selectedIds,
  onTogglePick,
  lateCatchUp,
  busyId,
  onStart,
  onComplete,
  isPreviewOnly,
}) {
  const { primary, extras } = splitRecommendedMissions(missions);
  const [pickedExtraId, setPickedExtraId] = useState('');
  const pickedExtra = extras.find((m) => m.id === pickedExtraId) ?? null;

  function renderMission(mission, index, { isPrimary = false } = {}) {
    if (canPick) {
      const selectedIndex = selectedIds.indexOf(mission.id);
      const selected = selectedIndex >= 0;
      return (
        <MissionSelectCard
          key={mission.id}
          mission={{
            ...mission,
            isRecommended: isPrimary || Boolean(mission.isRecommended),
          }}
          selected={selected}
          pickOrder={selectedIndex + 1}
          disabled={!canPick || (!selected && selectedIds.length >= PICK_COUNT)}
          onToggle={() => onTogglePick(mission.id)}
        />
      );
    }
    return (
      <PrescribedMissionViewCard
        key={mission.id}
        mission={{
          ...mission,
          completed: (mission.completionCount ?? 0) > 0 || mission.completed,
          completedAt: mission.lastCompletedAt ?? mission.completedAt,
          coinReward: mission.coinReward,
          isRecommended: isPrimary || Boolean(mission.isRecommended),
        }}
        index={index}
        lateCatchUp={lateCatchUp}
        busy={busyId === mission.id}
        onStart={isPreviewOnly ? undefined : onStart}
        onComplete={isPreviewOnly ? undefined : onComplete}
        showRecommended={isPrimary || Boolean(mission.isRecommended)}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {primary.map((mission, index) => renderMission(mission, index, { isPrimary: true }))}

      {extras.length > 0 ? (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-3">
          <MissionStatusSelect
            label="More missions on this hill"
            missions={extras}
            value={pickedExtraId}
            onChange={setPickedExtraId}
            primaryOffset={primary.length}
            getOptionMeta={(mission) => ({
              done: (mission.completionCount ?? (mission.completed ? 1 : 0)) > 0,
              title: mission.title,
              coinReward: mission.coinReward,
            })}
          />

          {pickedExtra ? (
            <div className="mt-3">
              {renderMission(
                pickedExtra,
                extras.findIndex((m) => m.id === pickedExtra.id) + primary.length,
                { isPrimary: false },
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MissionSelectCard({ mission, selected, pickOrder, disabled, onToggle }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={[
        'flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition',
        selected
          ? 'border-violet-500 bg-violet-50 shadow-md shadow-violet-200/50 ring-2 ring-violet-300/60'
          : 'border-violet-100 bg-white hover:border-violet-200 hover:bg-violet-50/40',
        disabled ? 'cursor-not-allowed opacity-60' : '',
      ].join(' ')}
    >
      <span
        className={[
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
          selected ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-700',
        ].join(' ')}
      >
        {selected ? pickOrder : mission.missionGroup}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-violet-900">{mission.title}</span>
          {mission.isRecommended ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
              Recommended
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-violet-700/75">
          {mission.description}
        </span>
        {mission.requiresReflection || mission.requiresEvidence ? (
          <p className="mt-2 text-[11px] font-semibold text-violet-500">
            {mission.requiresReflection ? <span>Reflection</span> : null}
            {mission.requiresReflection && mission.requiresEvidence ? <span> · </span> : null}
            {mission.requiresEvidence ? <span>Evidence</span> : null}
          </p>
        ) : null}
      </span>
      <span
        className={[
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold',
          selected
            ? 'border-violet-600 bg-violet-600 text-white'
            : 'border-violet-200 bg-white text-transparent',
        ].join(' ')}
        aria-hidden="true"
      >
        ✓
      </span>
    </button>
  );
}

function PrescribedMissionViewCard({
  mission,
  index,
  lateCatchUp,
  busy,
  onStart,
  onComplete,
  showRecommended = false,
}) {
  const count = mission.completionCount ?? (mission.completed ? 1 : 0);
  const completedToday = Boolean(mission.completedToday);
  const recommended = showRecommended || Boolean(mission.isRecommended);
  const label =
    mission.completionLabel ??
    (count > 0 ? `Completed ${count} time${count === 1 ? '' : 's'}` : 'Not completed');
  const completedLabel = formatMissionCompletedAt(mission.completedAt ?? mission.lastCompletedAt);
  const canAct = Boolean(onComplete);

  return (
    <div
      className={[
        'rounded-2xl border px-4 py-3.5',
        recommended && count === 0
          ? 'border-violet-300 bg-violet-50/60'
          : count > 0
            ? 'border-emerald-200 bg-emerald-50/80'
            : lateCatchUp
              ? 'border-amber-200 bg-amber-50/50'
              : 'border-violet-100 bg-white',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span
          className={[
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            count > 0 ? 'bg-emerald-600 text-white' : 'bg-violet-100 text-violet-700',
          ].join(' ')}
        >
          {count > 0 ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-violet-900">{mission.title}</p>
            {recommended ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                Recommended
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-violet-700/75">{mission.description}</p>
          <p className={['mt-2 text-[11px] font-semibold', count > 0 ? 'text-emerald-700' : 'text-violet-500'].join(' ')}>
            {label}
            {count > 0 && completedLabel ? ` · Last ${completedLabel}` : ''}
          </p>
          {canAct ? (
            completedToday ? (
              <p className="mt-3 text-xs font-semibold text-emerald-800">
                Done today — pick a different mission
              </p>
            ) : (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onStart?.(mission.id)}
                  className="rounded-full border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-800"
                >
                  Start
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onComplete?.(mission.id)}
                  className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {count > 0 ? 'Complete again' : 'Complete'}
                </button>
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MissionPickLoader() {
  return (
    <div className="flex flex-col items-center py-10" role="status" aria-busy="true">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
        <span className="text-xl">✦</span>
      </div>
      <p className="mt-4 text-sm font-medium text-violet-700">Loading missions…</p>
    </div>
  );
}

export function FlowWeekDayPreviewModal({
  dayIndex,
  hill,
  focusHillId,
  open,
  onClose,
  onConfirmed,
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [options, setOptions] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    if (!open || !dayIndex) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    setOptions(null);
    setSelectedIds([]);

    (async () => {
      try {
        const result = await api.getFlowWeekDayMissionOptions(dayIndex);
        if (cancelled) return;
        setOptions(result);
        setSelectedIds(result.selectedMissionIds ?? []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load missions for this day');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, dayIndex]);

  if (!open) return null;

  const displayHill = options?.hill ?? hill;
  const canPick = options?.canPick ?? false;
  const pickReady = selectedIds.length === PICK_COUNT;
  const rewards = options?.rewards ?? null;
  const missions = options?.allMissions ?? [];
  const prescribedMissions = options?.prescribedMissions ?? [];
  const showPrescribedView = !canPick && prescribedMissions.length > 0;
  const dailyFlowComplete = options?.dailyFlowComplete ?? false;
  const optionalCompletedToday = options?.optionalCompletedToday ?? [];
  const extraCoinsEarnedToday = options?.extraCoinsEarnedToday ?? 0;
  const lateCatchUp = options?.lateCatchUp ?? false;
  const isToday = options?.isToday ?? false;
  const isPreviewOnly = options?.isPreviewOnly ?? false;
  const hillSubtitle = formatHillSubtitle(displayHill);

  function toggleMission(missionId) {
    if (!canPick) return;
    setSelectedIds((prev) => {
      if (prev.includes(missionId)) return prev.filter((id) => id !== missionId);
      if (prev.length >= PICK_COUNT) return prev;
      return [...prev, missionId];
    });
  }

  async function handleLateComplete(missionId) {
    setBusyId(missionId);
    setError('');
    try {
      const dayAssignmentId = options?.dayAssignmentId ?? null;
      await api.startFlowWeekMission(missionId, { dayAssignmentId });
      const result = await api.completeFlowWeekMission(missionId, { dayAssignmentId });
      onConfirmed?.(result.flowWeek, result);
      const next = await api.getFlowWeekDayMissionOptions(dayIndex);
      setOptions(next);
    } catch (err) {
      if (isMissedDayBlockingError(err)) {
        redirectHomeForMissedDay();
        return;
      }
      setError(err.message || 'Could not complete this late mission');
    } finally {
      setBusyId(null);
    }
  }

  async function handleLateStart(missionId) {
    setBusyId(missionId);
    setError('');
    try {
      await api.startFlowWeekMission(missionId, {
        dayAssignmentId: options?.dayAssignmentId ?? null,
      });
      const next = await api.getFlowWeekDayMissionOptions(dayIndex);
      setOptions(next);
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

  async function handleConfirm() {
    if (!pickReady || !canPick) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api.confirmFlowWeekDayMissions(dayIndex, selectedIds);
      onConfirmed?.(result.flowWeek);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save your picks');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        className="flex max-h-[min(85vh,640px)] w-full max-w-md flex-col rounded-3xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="flow-week-day-preview-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-violet-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-500">
              Day {dayIndex}
            </p>
            <p id="flow-week-day-preview-title" className="mt-0.5 font-display text-lg font-semibold leading-tight text-violet-900">
              {formatHillTitle(displayHill)}
              {hillSubtitle ? (
                <span className="ml-2 font-sans text-sm font-medium text-violet-500">
                  {hillSubtitle}
                </span>
              ) : null}
            </p>
            <DayRewardsSummary
              rewards={rewards}
              lateCatchUp={Boolean(lateCatchUp && !isPreviewOnly && !isToday)}
              dailyFlowComplete={dailyFlowComplete}
              extraCoinsEarnedToday={extraCoinsEarnedToday}
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-violet-500 hover:bg-violet-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {canPick ? (
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs text-violet-700/80">Pick any 3 missions for this day.</p>
              <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800">
                {selectedIds.length}/{PICK_COUNT}
              </span>
            </div>
          ) : null}

          {loading ? <MissionPickLoader /> : null}

          {error ? (
            <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          ) : null}

          {!loading && (options?.hillMissions?.length || showPrescribedView || missions.length > 0) ? (
            <DayMissionListWithDropdown
              missions={
                options?.hillMissions?.length
                  ? options.hillMissions
                  : showPrescribedView
                    ? prescribedMissions
                    : missions
              }
              canPick={canPick}
              selectedIds={selectedIds}
              onTogglePick={toggleMission}
              lateCatchUp={!isToday || lateCatchUp}
              busyId={busyId}
              onStart={handleLateStart}
              onComplete={handleLateComplete}
              isPreviewOnly={isPreviewOnly}
            />
          ) : null}

          {!loading && isToday && optionalCompletedToday.length > 0 ? (
            <FlowWeekOptionalCompletedList
              completed={optionalCompletedToday}
              extraCoinsEarnedToday={extraCoinsEarnedToday}
              className="mt-4"
            />
          ) : null}
        </div>

        <div className="border-t border-violet-100 px-5 py-4">
          {canPick ? (
            <button
              type="button"
              disabled={!pickReady || submitting || loading}
              onClick={handleConfirm}
              className="w-full rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 transition enabled:hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
            >
              {submitting
                ? 'Saving…'
                : pickReady
                  ? 'Confirm my 3 missions'
                  : `Pick ${PICK_COUNT - selectedIds.length} more`}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-700"
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
