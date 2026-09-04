import { Sprout } from 'lucide-react';
import { GrowChallengeProgress } from './GrowChallengeProgress';

function ProgressBar({ value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-emerald-950/60">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function GrowChallengeCard({ challenge }) {
  if (!challenge) return null;

  const {
    glowSeedsEarned,
    glowSeedsTarget,
    daysRemaining,
    isComplete,
    challengeDaysTotal,
    challengeDayIndex,
    periodExpired,
  } = challenge;

  if (isComplete) {
    return (
      <section className="gofam-game-card border-emerald-400/40 bg-gradient-to-br from-[#0a2218] to-[#102818] px-4 py-4 shadow-[0_0_24px_rgba(16,185,129,0.2)]">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg">
            🎉
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">
              30-Day GOFAM GROW Challenge
            </p>
            <p className="mt-2 font-display text-base font-bold leading-snug text-emerald-100">
              30-DAY GOFAM GROW CHALLENGE COMPLETED! 🎉
            </p>
            <div className="mt-3">
              <GrowChallengeProgress challenge={challenge} />
            </div>
            <p className="mt-3 text-sm text-emerald-200/80">
              3 Missions → 1 Glow Seed → 21 Glow Seeds → Challenge Complete.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (periodExpired) {
    return (
      <section className="gofam-game-card border-amber-500/30 bg-gradient-to-br from-[#1a1408] to-[#14141f] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-400">
              30-Day GOFAM GROW Challenge
            </p>
            <p className="mt-2 text-sm font-semibold text-amber-100">Challenge period ended</p>
            <div className="mt-3">
              <GrowChallengeProgress challenge={challenge} />
            </div>
            <p className="mt-3 text-sm text-violet-300/85">
              You earned {glowSeedsEarned} of {glowSeedsTarget} Glow Seeds. Missing days never reset
              your progress — keep completing missions and growing your tree.
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20 ring-1 ring-amber-400/40">
            <Sprout className="h-4 w-4 text-amber-400" aria-hidden="true" />
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="gofam-game-card border-emerald-500/30 bg-gradient-to-br from-[#0f1f1a] to-[#14141f] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">
            30-Day GOFAM GROW Challenge
          </p>
          <p className="mt-0.5 text-sm text-violet-300/80">
            Earn {glowSeedsTarget} Glow Seeds in {challengeDaysTotal} days
          </p>
          <div className="mt-3">
            <GrowChallengeProgress challenge={challenge} />
          </div>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/40">
          <Sprout className="h-4 w-4 text-emerald-400" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-xs leading-relaxed text-violet-400/90">
          Missing a day does not reset or punish you. Consistency helps you reach 21 faster.
        </p>
        <p className="shrink-0 text-right text-xs text-violet-400">
          Day {challengeDayIndex} of {challengeDaysTotal}
          <br />
          <span className="font-medium text-violet-300">{daysRemaining} days left</span>
        </p>
      </div>

      <ProgressBar value={glowSeedsEarned} max={glowSeedsTarget} />
    </section>
  );
}
