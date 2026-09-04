import { Check, Coins, Mountain } from 'lucide-react';
import {
  formatCompletedCycleHeadline,
  formatCompletionDate,
} from '../lib/cycleLabels';
import { formatCampLabel } from '../lib/hillProgress';

export function CycleCompleteSummary({ cycle, rewards, onContinue }) {
  if (!cycle) return null;

  const accent = cycle.hill?.colorTheme ?? '#7C3AED';
  const missions = cycle.missions ?? [];
  const perMission = rewards?.perMission ?? Math.round((cycle.missionCoinsEarned ?? 0) / 3);
  const stepNumber = cycle.stepNumber ?? cycle.completedSteps;
  const campName = cycle.currentCamp ? formatCampLabel(cycle.currentCamp) : null;

  return (
    <section className="flex min-h-[50vh] flex-col">
      <div
        className="rounded-2xl px-5 py-6 text-center"
        style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}08)` }}
      >
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md"
          style={{ backgroundColor: accent }}
        >
          <Check className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold text-violet-950">
          {formatCompletedCycleHeadline(cycle)}
        </h2>
        {campName ? (
          <p className="mt-1 text-sm font-semibold text-violet-800">
            {campName} reached · Step {stepNumber}
          </p>
        ) : stepNumber ? (
          <p className="mt-1 text-sm font-semibold text-violet-800">Step {stepNumber}</p>
        ) : null}
        <p className="mt-1 text-xs text-violet-600">
          Finished {formatCompletionDate(cycle.completedAt)}
        </p>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">
          Missions completed
        </p>
        <ul className="mt-2 space-y-2">
          {missions.map((mission, index) => (
            <li
              key={mission.id}
              className="flex items-start gap-3 rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-xs font-bold text-white">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-violet-950">{mission.title}</span>
                <span className="mt-0.5 block text-[11px] text-violet-600">
                  {formatCompletionDate(mission.completedAt)}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-amber-700">+{mission.coinReward}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 rounded-2xl border border-violet-100 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">Rewards earned</p>
        <ul className="mt-3 space-y-2 text-sm text-violet-800">
          <li className="flex items-center justify-between">
            <span>
              3 missions × +{perMission} coins
            </span>
            <span className="font-semibold text-amber-700">+{cycle.missionCoinsEarned}</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Step completion bonus</span>
            <span className="font-semibold text-amber-700">+{cycle.cycleBonusCoins}</span>
          </li>
          <li className="flex items-center justify-between border-t border-violet-100 pt-2 font-semibold">
            <span className="flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-amber-500" aria-hidden="true" />
              Total coins
            </span>
            <span className="text-amber-800">+{cycle.totalCoinsEarned}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Mountain className="h-4 w-4 text-violet-500" aria-hidden="true" />
              Hill Steps
            </span>
            <span className="font-semibold text-violet-800">+{cycle.hillStepsEarned}</span>
          </li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="mt-auto w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/30"
      >
        Choose your next step
      </button>
    </section>
  );
}
