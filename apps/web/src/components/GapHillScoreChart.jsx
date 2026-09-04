import { HILL_RING_COLORS } from '../lib/hillRingColors';
import { HILL_LUCIDE } from '../lib/hillIcons';
import { formatHillTitle } from '../lib/hills';

export function GapHillScoreChart({ hillScores, strongestHillId, focusHillId }) {
  if (!hillScores?.length) return null;

  const sorted = [...hillScores].sort((a, b) => b.flowPercent - a.flowPercent);

  return (
    <div className="space-y-3">
      {sorted.map((entry) => {
        const code = entry.hill?.code;
        const color =
          entry.hill?.colorTheme ?? HILL_RING_COLORS[code] ?? '#7C3AED';
        const Icon = code ? HILL_LUCIDE[code] : null;
        const isStrongest = entry.hillId === strongestHillId;
        const isFocus = entry.hillId === focusHillId;

        return (
          <div key={entry.hillId ?? entry.id}>
            <div className="mb-1 flex items-center gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: color }}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold tracking-wide text-violet-800">
                  {code}
                </span>
                <span className="block truncate text-[11px] text-violet-600/80">
                  {formatHillTitle(entry.hill)}
                </span>
              </span>
              <div className="shrink-0 text-right">
                {isStrongest ? (
                  <span className="block text-[10px] font-bold text-amber-600">⭐ Strongest</span>
                ) : null}
                {isFocus ? (
                  <span className="block text-[10px] font-bold text-violet-700">🎯 Focus</span>
                ) : null}
                <span className="text-sm font-bold tabular-nums text-violet-900">
                  {entry.flowPercent}%
                </span>
              </div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-violet-100">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min(100, Math.max(0, entry.flowPercent))}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
