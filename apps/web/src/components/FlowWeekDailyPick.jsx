import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatHillTitle } from '../lib/hills';
import { formatMissionCoinLabel, normalizeMissionRewards } from '../lib/missionRewards';

const PICK_COUNT = 3;

function MissionPickLoader() {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span
          className="absolute inset-0 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600"
          aria-hidden="true"
        />
        <span className="text-2xl" aria-hidden="true">
          ✦
        </span>
      </div>
      <p className="mt-6 font-display text-lg font-semibold text-violet-900">
        Loading mission options…
      </p>
      <div className="mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-violet-100">
        <div className="h-full w-full animate-pulse rounded-full bg-violet-500" />
      </div>
    </div>
  );
}

function MissionSelectCard({ mission, selected, pickOrder, rewards, disabled, onToggle }) {
  const rewardConfig = normalizeMissionRewards(rewards);

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
        <p className="mt-2 text-[11px] font-semibold text-violet-600">
          {formatMissionCoinLabel(rewardConfig)}
          {mission.requiresReflection ? <span> · Reflection</span> : null}
          {mission.requiresEvidence ? <span> · Evidence</span> : null}
        </p>
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

export function FlowWeekDailyPick({ hill, onConfirmed }) {
  const [allMissions, setAllMissions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [rewards, setRewards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pickReady = selectedIds.length === PICK_COUNT;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.getFlowWeekTodayMissionOptions();
        if (!cancelled) {
          setAllMissions(result.allMissions ?? result.recommended ?? []);
          setRewards(result.rewards ?? null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load mission options');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleMission(missionId) {
    setSelectedIds((prev) => {
      if (prev.includes(missionId)) {
        return prev.filter((id) => id !== missionId);
      }
      if (prev.length >= PICK_COUNT) return prev;
      return [...prev, missionId];
    });
  }

  async function handleConfirm() {
    if (!pickReady) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api.confirmFlowWeekTodayMissions(selectedIds);
      onConfirmed(result.flowWeek);
    } catch (err) {
      setError(err.message || 'Could not save your picks');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-violet-950">
          {formatHillTitle(hill)} missions
        </h2>
        <MissionPickLoader />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-violet-950">
          Pick 3 · {formatHillTitle(hill)}
        </h2>
        <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">
          {selectedIds.length}/{PICK_COUNT}
        </span>
      </div>

      <div className="space-y-2.5">
        {allMissions.map((mission) => {
          const selectedIndex = selectedIds.indexOf(mission.id);
          const selected = selectedIndex >= 0;
          return (
            <MissionSelectCard
              key={mission.id}
              mission={mission}
              selected={selected}
              pickOrder={selectedIndex + 1}
              rewards={rewards}
              disabled={!selected && selectedIds.length >= PICK_COUNT}
              onToggle={() => toggleMission(mission.id)}
            />
          );
        })}
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <button
        type="button"
        disabled={!pickReady || submitting}
        onClick={handleConfirm}
        className="w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/30 transition enabled:hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
      >
        {submitting
          ? 'Saving…'
          : pickReady
            ? 'Confirm my 3 missions'
            : `Pick ${PICK_COUNT - selectedIds.length} more`}
      </button>
    </div>
  );
}
