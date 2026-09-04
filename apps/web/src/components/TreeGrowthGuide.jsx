import { Link } from 'react-router-dom';
import { BarChart3, Coins, Mountain, Sparkles } from 'lucide-react';
import {
  describeCampGrowth,
  describeCoinGrowth,
  describeTreeProgress,
  describeVirtueGrowth,
  formatStarReward,
} from '../lib/treeGrowth';

function GrowthTip({ icon: Icon, iconClass, title, points, detail, to }) {
  const body = (
    <div className="flex gap-3 rounded-xl border border-violet-100 bg-white p-3">
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-violet-950">{title}</p>
          {points ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
              +{points}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-violet-600">{detail}</p>
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block transition hover:opacity-90">
        {body}
      </Link>
    );
  }
  return body;
}

export function TreeGrowthGuide({ journey, focusHill, className = '' }) {
  if (!journey) return null;

  const progress = describeTreeProgress(journey);
  const lifetime = journey.lifetimeCoins ?? 0;
  const nextCoins = journey.nextCoinMilestone;
  const nextCoinStars = journey.nextCoinMilestoneStars ?? 0;
  const virtuesUsed = journey.virtueStarsThisMonth ?? 0;
  const virtuesCap = journey.virtueStarsMonthlyCap ?? 7;

  return (
    <section className={`space-y-3 ${className}`.trim()}>
      <div>
        <h2 className="font-display text-lg font-semibold text-violet-950">Grow your tree</h2>
        <p className="mt-0.5 text-xs text-violet-600">
          Earn points from missions, Camps, GAP, coins, and GLOW. More points = bigger tree.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-violet-50 p-4 shadow-sm">
        <p className="text-xs font-medium text-violet-600">
          Level {progress.level} · {progress.stage}
        </p>
        <p className="mt-1 font-display text-lg font-semibold text-violet-950">{progress.headline}</p>
        <p className="mt-1 text-sm text-violet-700">{progress.detail}</p>
        {!progress.isMax ? (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] font-semibold text-violet-500">
              <span>Progress to Level {progress.nextLevel}</span>
              <span>{progress.progressPct}%</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-violet-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all"
                style={{ width: `${progress.progressPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-violet-800">Ways to earn points</p>
        <div className="space-y-2">
          <GrowthTip
            icon={Mountain}
            iconClass="bg-sky-100 text-sky-600"
            title="Reach the next Camp"
            points="1 point"
            detail={describeCampGrowth(focusHill)}
            to="/"
          />
          <GrowthTip
            icon={BarChart3}
            iconClass="bg-violet-100 text-violet-600"
            title="Official GAP check-in"
            points="up to 7"
            detail="Your real GAP result (not practice) gives 1–7 points based on your FLOW score."
            to="/profile"
          />
          <GrowthTip
            icon={Coins}
            iconClass="bg-amber-100 text-amber-600"
            title="Coin milestones"
            points={nextCoinStars > 0 ? formatStarReward(nextCoinStars) : '100 points'}
            detail={describeCoinGrowth(lifetime, nextCoins, nextCoinStars)}
          />
          <GrowthTip
            icon={Sparkles}
            iconClass="bg-fuchsia-100 text-fuchsia-600"
            title="GLOW virtues"
            points="1 each"
            detail={describeVirtueGrowth(virtuesUsed, virtuesCap)}
            to="/glow"
          />
        </div>
      </div>
    </section>
  );
}
