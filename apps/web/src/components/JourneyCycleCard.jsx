import { Check, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatHillStepCampLine, formatStepLabel } from '../lib/hillProgress';
import { formatHillTitle } from '../lib/hills';
import {
  cycleStatusLabel,
  getCycleDisplayStatus,
  getMissionDisplayStatus,
  missionStatusLabel,
} from '../lib/journeyCycle';

export function JourneyCycleCard({
  blockWeeks,
  hillProgress,
  isFocusBlock,
  hillIcon,
}) {
  const hill = blockWeeks[0]?.hill;
  const cycleStatus = getCycleDisplayStatus(blockWeeks);
  const accent = hill?.colorTheme ?? '#7C3AED';
  const withMissions = blockWeeks.filter((w) => w.mission);
  const completedCount = withMissions.filter((w) => w.status === 'completed').length;
  const isActive = cycleStatus === 'active';

  const completedSteps = hillProgress?.completedSteps ?? 0;
  const workingStep = isActive
    ? (hillProgress?.workingStep ?? completedSteps + 1)
    : completedSteps;
  const campLine = formatHillStepCampLine({
    workingStep,
    completedSteps,
  });

  return (
    <section
      className={[
        'rounded-2xl border p-4 transition',
        cycleStatus === 'completed'
          ? 'border-emerald-100 bg-emerald-50/30'
          : isActive
            ? 'border-violet-300 bg-violet-50/80 ring-2 ring-violet-300/50 shadow-md'
            : cycleStatus === 'pending_selection'
              ? 'border-amber-200 bg-amber-50/40'
              : 'border-violet-100 bg-white opacity-80',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">
          {hillIcon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">
            {formatHillTitle(hill)}
            {isFocusBlock ? ' · Focus hill' : ''}
          </p>
          <p className="font-semibold text-violet-900">{campLine}</p>
          {blockWeeks[0]?.hillStepNumber ? (
            <p className="text-[11px] text-violet-600">
              Hill step {blockWeeks[0].hillStepNumber} · 3 missions together
            </p>
          ) : null}
          <p
            className={[
              'mt-1 text-xs font-semibold',
              cycleStatus === 'completed'
                ? 'text-emerald-700'
                : isActive
                  ? 'text-violet-700'
                  : 'text-violet-500',
            ].join(' ')}
          >
            {cycleStatus === 'active'
              ? `Working on ${formatStepLabel(workingStep, { showMax: false })} · ${completedCount}/3 missions`
              : cycleStatusLabel(cycleStatus)}
          </p>
        </div>
      </div>

      {cycleStatus === 'pending_selection' ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          Pick 3 missions to begin{' '}
          {formatStepLabel((hillProgress?.completedSteps ?? 0) + 1, { showMax: false })} on{' '}
          {formatHillTitle(hill)}.
        </p>
      ) : cycleStatus === 'locked' ? (
        <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2.5 text-sm text-violet-600">
          Unlocks when you begin this hill&apos;s climb (30-day challenge, then up to 49 weeks).
        </p>
      ) : (
        <>
          {isActive ? (
            <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs leading-relaxed text-violet-700">
              All 3 missions for this step are active together — complete them in any order to
              advance.
            </p>
          ) : null}

          <ul className="mt-3 space-y-2">
            {withMissions.map((week) => {
              const missionStatus = getMissionDisplayStatus(week, cycleStatus);
              return (
                <li
                  key={week.mission.id}
                  className={[
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm',
                    missionStatus === 'completed'
                      ? 'bg-emerald-50 text-emerald-900'
                      : missionStatus === 'active'
                        ? 'bg-white text-violet-900 ring-1 ring-violet-200'
                        : 'bg-violet-50/60 text-violet-700',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                      missionStatus === 'completed'
                        ? 'bg-emerald-500 text-white'
                        : missionStatus === 'active'
                          ? 'text-white'
                          : 'bg-violet-100 text-violet-500',
                    ].join(' ')}
                    style={missionStatus === 'active' ? { backgroundColor: accent } : undefined}
                  >
                    {missionStatus === 'completed' ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : missionStatus === 'locked' ? (
                      <Lock className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      week.taskNumber
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{week.mission.title}</span>
                    <span className="mt-0.5 block text-[11px] opacity-75">
                      Mission {week.taskNumber} of 3
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide opacity-80">
                    {missionStatusLabel(missionStatus)}
                  </span>
                </li>
              );
            })}
          </ul>

          {isActive ? (
            <Link
              to={`/missions?hill=${hill?.code}`}
              className="mt-3 flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
            >
              Open missions for this step
            </Link>
          ) : null}
        </>
      )}
    </section>
  );
}
