import { formatHillTitle } from '../lib/hills';
import {
  appClimbDisplayMax,
  formatHillStepCampLine,
  formatStepLabel,
} from '../lib/hillProgress';
import { HILL_ICONS } from '../lib/gapRating';

export function HillProgressOverview({ hillProgress, focusHillId }) {
  if (!hillProgress?.length) return null;

  const climbMax = appClimbDisplayMax(hillProgress);

  return (
    <section className="mt-4 rounded-2xl border border-violet-100 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">
        Steps per hill
      </p>
      <p className="mt-1 text-xs text-violet-600/90">
        {climbMax <= 3
          ? 'Each hill: 3 missions per day during the 30-day challenge. Earn 21 Glow Seeds to complete it.'
          : 'You unlocked the 49-week climb. Each hill tracks 49 steps independently.'}
      </p>
      <ul className="mt-3 space-y-2">
        {hillProgress.map((entry) => {
          const icon = HILL_ICONS[entry.hill?.code] ?? '🏔️';
          const isFocus = entry.hill?.id === focusHillId;
          const cap = entry.stepsPerHill ?? climbMax;
          const workingStep = entry.isActive
            ? entry.workingStep
            : entry.completedSteps >= cap
              ? cap
              : entry.completedSteps + 1;

          return (
            <li
              key={entry.hill.id}
              className={[
                'rounded-xl px-3 py-2.5',
                isFocus ? 'bg-violet-50 ring-1 ring-violet-200' : 'bg-violet-50/40',
              ].join(' ')}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg" aria-hidden="true">
                  {icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-violet-900">
                    {formatHillTitle(entry.hill)}
                    {isFocus ? ' · Focus' : ''}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-violet-800">
                    {formatHillStepCampLine({
                      workingStep,
                      completedSteps: entry.completedSteps,
                    })}
                  </p>
                  <p className="mt-0.5 text-[11px] text-violet-600">
                    {formatStepLabel(entry.completedSteps, { climbMax })} completed
                    {entry.isActive
                      ? ` · ${entry.missionsCompleted}/${entry.missionsTotal} missions this step`
                      : ''}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
