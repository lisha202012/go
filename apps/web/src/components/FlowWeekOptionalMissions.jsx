import { useEffect, useState } from 'react';
import { ChevronRight, Coins } from 'lucide-react';
import { api } from '../lib/api';
import { formatHillTitle } from '../lib/hills';
import { formatMissionCompletedAt } from './FlowWeekCoinRewardsNote';
import { MissionWhyDisclosure } from './MissionWhyDisclosure';
import { MissionStatusSelect } from './MissionStatusSelect';

function OtherHillMissionRow({
  hill,
  mission,
  expanded,
  busy,
  onToggle,
  onStart,
  onComplete,
  showRecommended = false,
}) {
  const completedToday = Boolean(mission.completedToday);
  const recommended = showRecommended || Boolean(mission.isRecommended);
  const label = completedToday ? 'Done today' : 'Not completed today';
  const lastDone = completedToday ? formatMissionCompletedAt(mission.lastCompletedAt) : null;

  return (
    <div
      className={[
        'rounded-xl border px-4 py-3',
        recommended && !completedToday
          ? 'border-violet-300 bg-violet-50/60'
          : completedToday
            ? 'border-emerald-100 bg-emerald-50/40'
            : 'border-violet-100 bg-white',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => onToggle(mission.id)}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-violet-950">
            <span>{mission.title}</span>
            {recommended ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                Recommended
              </span>
            ) : null}
          </p>
          <p className={['text-[11px] font-semibold', completedToday ? 'text-emerald-700' : 'text-violet-500'].join(' ')}>
            {label}
            {lastDone ? ` · ${lastDone}` : ''}
          </p>
        </div>
        {!expanded ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-xs font-bold text-violet-700">
            +{mission.coinReward}
          </span>
        ) : null}
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-violet-400 transition ${expanded ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
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
          {completedToday ? (
            <p className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-800">
              Done today — pick a different mission
            </p>
          ) : !mission.started && !completedToday ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onStart(mission.id)}
              className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? 'Starting…' : 'Start'}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onComplete(mission.id, hill.code)}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white disabled:opacity-60"
            >
              {busy ? 'Completing…' : 'Complete mission'}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function OtherHillGroup({ group, expandedId, busyId, onToggle, onStart, onComplete }) {
  const { hill, missions } = group;
  const list = missions?.length ? missions : group.mission ? [group.mission] : [];
  const [open, setOpen] = useState(false);
  const [pickedMissionId, setPickedMissionId] = useState('');
  const completedToday = list.filter((m) => m.completedToday).length;
  const summary =
    completedToday > 0
      ? `${completedToday} done today`
      : 'none done today';
  const pickedMission = list.find((m) => m.id === pickedMissionId) ?? null;

  return (
    <div
      className="rounded-2xl border border-violet-100 bg-white shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: hill.colorTheme ?? '#7C3AED' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-violet-950">{formatHillTitle(hill)}</p>
          <p className="text-[11px] text-violet-500">
            {list.length} missions · {summary}
          </p>
        </div>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-violet-400 transition ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="space-y-2 border-t border-violet-50 px-3 pb-3 pt-2">
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-2.5">
            <MissionStatusSelect
              label="Choose a mission"
              missions={list}
              value={pickedMissionId}
              onChange={(nextId) => {
                setPickedMissionId(nextId);
                if (nextId) onToggle(nextId);
              }}
              getOptionMeta={(mission) => ({
                done: Boolean(mission.completedToday),
                title: mission.title,
                coinReward: mission.coinReward,
              })}
            />

            {pickedMission ? (
              <div className="mt-2">
                <OtherHillMissionRow
                  hill={hill}
                  mission={pickedMission}
                  expanded
                  busy={busyId === pickedMission.id}
                  onToggle={onToggle}
                  onStart={onStart}
                  onComplete={onComplete}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Compact list kept for day-preview optional history */
export function FlowWeekOptionalCompletedList({
  completed = [],
  extraCoinsEarnedToday = 0,
  compact = false,
  className = '',
}) {
  if (!completed.length) return null;

  return (
    <div className={['space-y-2', className].join(' ')}>
      <p className="text-xs font-semibold text-emerald-700">
        Other-hill completions today · +{extraCoinsEarnedToday} coins
      </p>
      {completed.map((group) => (
        <div
          key={`${group.hill.id}-${group.mission.id}-${group.mission.lastCompletedAt ?? ''}`}
          className={[
            'rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2',
            compact ? '' : 'px-4 py-3',
          ].join(' ')}
        >
          <p className="truncate text-sm font-medium text-violet-950">{group.mission.title}</p>
          <p className="text-[10px] text-violet-500">
            {formatHillTitle(group.hill)} · +{group.mission.coinReward}
            {group.mission.completionLabel ? ` · ${group.mission.completionLabel}` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

export function FlowWeekOptionalMissions({
  reloadKey = 0,
  expandedId,
  busyId,
  onToggle,
  onStart,
  onComplete,
  embedded = false,
  /** Parent can patch local progress after start/complete without a full blank reload. */
  localPatch = null,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Keep the list on screen while refreshing — blanking hid Complete / celebration.
      if (!data) setLoading(true);
      try {
        const result = await api.getFlowWeekTodayOptionalMissions();
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled && !data) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh on reloadKey only
  }, [reloadKey]);

  useEffect(() => {
    if (!localPatch?.missionId) return;
    setData((prev) => {
      if (!prev?.groups) return prev;
      return {
        ...prev,
        extraCoinsEarnedToday:
          localPatch.extraCoinsEarnedToday != null
            ? localPatch.extraCoinsEarnedToday
            : prev.extraCoinsEarnedToday,
        groups: prev.groups.map((group) => ({
          ...group,
          missions: (group.missions ?? []).map((mission) => {
            if (mission.id !== localPatch.missionId) return mission;
            return {
              ...mission,
              started: true,
              ...(localPatch.completed
                ? {
                    completedToday: true,
                    completionLabel: 'Done today',
                  }
                : {}),
            };
          }),
        })),
      };
    });
  }, [localPatch]);

  if (loading && !data) {
    return <p className="text-xs text-violet-500">Loading other hill missions…</p>;
  }

  const available = data?.groups ?? [];
  const extraCoins = data?.extraCoinsEarnedToday ?? 0;

  if (!available.length) {
    return (
      <p className="rounded-xl bg-violet-50 px-4 py-6 text-center text-sm text-violet-600">
        No other-hill missions available right now.
      </p>
    );
  }

  const wrapperClass = embedded ? 'space-y-3' : 'space-y-3 border-t border-violet-100 pt-4';

  return (
    <div className={wrapperClass}>
      {extraCoins > 0 ? (
        <p className="text-xs font-semibold text-sky-800">
          +{extraCoins} coins from other hills today
        </p>
      ) : null}
      {available.map((group) => (
        <OtherHillGroup
          key={group.hill.id}
          group={group}
          expandedId={expandedId}
          busyId={busyId}
          onToggle={onToggle}
          onStart={onStart}
          onComplete={onComplete}
        />
      ))}
    </div>
  );
}
