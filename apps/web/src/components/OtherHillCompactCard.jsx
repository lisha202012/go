import { ChevronRight } from 'lucide-react';
import { HILL_LUCIDE } from '../lib/hillIcons';
import { formatHillCodeDomain, formatHillTitle, hillVirtueLabel } from '../lib/hills';
import { resolveCampProgress, STEPS_PER_HILL } from '../lib/hillProgress';

export function OtherHillCompactCard({ hill, missionsToday = 0, onViewHill }) {
  const accent = hill.colorTheme ?? '#7C3AED';
  const Icon = HILL_LUCIDE[hill.code] ?? ChevronRight;
  const steps = hill.completedSteps ?? 0;
  const camp = resolveCampProgress(steps);
  const status = hill.status ?? 'Emerging Hill';

  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ backgroundColor: accent }}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-slate-900">{formatHillCodeDomain(hill)}</p>
          <p className="text-xs font-medium text-slate-500">{hillVirtueLabel(hill)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-violet-600">{status}</p>
          <p className="mt-1 text-sm font-bold tabular-nums text-slate-800">
            Step {steps} / {STEPS_PER_HILL}
          </p>
          <p className="text-[11px] text-slate-500">
            {camp.currentCamp.name}
            {missionsToday > 0 ? ` · ${missionsToday}/3 today` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onViewHill(hill)}
          className="shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-violet-50"
          style={{ borderColor: `${accent}55`, color: accent }}
        >
          View Hill →
        </button>
      </div>
    </div>
  );
}
