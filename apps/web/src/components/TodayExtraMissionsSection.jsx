import { useState } from 'react';
import { Coins, X } from 'lucide-react';
import { formatHillTitle } from '../lib/hills';
import { HILL_RING_COLORS } from '../lib/hillRingColors';
import { HILL_LUCIDE } from '../lib/hillIcons';

function formatDoneAt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function ExtraHillModal({ group, onClose }) {
  const missions = group?.missions ?? [];
  const [pickedIndex, setPickedIndex] = useState(0);
  const picked = missions[pickedIndex] ?? null;
  const code = group.hill.code;
  const accent = group.hill.colorTheme ?? HILL_RING_COLORS[code] ?? '#7C3AED';
  const Icon = HILL_LUCIDE[code];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        className="w-full max-w-md rounded-3xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extra-hill-modal-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-violet-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: accent }}
              aria-hidden="true"
            >
              {Icon ? <Icon className="h-5 w-5" /> : null}
            </span>
            <div className="min-w-0">
              <p
                id="extra-hill-modal-title"
                className="font-display text-lg font-semibold text-violet-950"
              >
                {formatHillTitle(group.hill)}
              </p>
              <p className="text-xs text-violet-600">
                {missions.length} extra mission{missions.length === 1 ? '' : 's'} today
              </p>
            </div>
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

        <div className="space-y-3 px-5 py-4">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-violet-500">
            Completed extras
            <select
              value={String(pickedIndex)}
              onChange={(e) => setPickedIndex(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm font-semibold text-violet-950 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
            >
              {missions.map((mission, index) => (
                <option key={`${mission.id}-${mission.completedAt}-${index}`} value={String(index)}>
                  {index + 1}. {mission.title} · +{mission.coinsAwarded}
                </option>
              ))}
            </select>
          </label>

          {picked ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
              <p className="text-sm font-semibold text-violet-950">{picked.title}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs font-semibold text-emerald-800">
                <span className="inline-flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                  +{picked.coinsAwarded} coins
                </span>
                {picked.completedAt ? (
                  <span className="font-medium text-violet-500">
                    {formatDoneAt(picked.completedAt)}
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>

        <div className="border-t border-violet-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact hill icons for extras completed today — details open in a modal.
 */
export function TodayExtraMissionsSection({ extraMissionsToday }) {
  const byHill = extraMissionsToday?.byHill ?? [];
  const count = extraMissionsToday?.count ?? 0;
  const coins = extraMissionsToday?.coins ?? 0;
  const [activeGroup, setActiveGroup] = useState(null);

  if (!count || byHill.length === 0) return null;

  return (
    <div className="mt-4 border-t border-violet-100 pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">
          Extra missions today
        </p>
        <p className="text-xs font-semibold text-emerald-700">
          {count} done · +{coins} coins
        </p>
      </div>
      <p className="mt-1 text-[11px] text-violet-600/80">Tap a hill icon for details.</p>

      <div className="mt-2.5 flex flex-wrap gap-2.5">
        {byHill.map((group) => {
          const code = group.hill.code;
          const accent = group.hill.colorTheme ?? HILL_RING_COLORS[code] ?? '#7C3AED';
          const Icon = HILL_LUCIDE[code];
          const missionCount = group.missions?.length ?? 0;

          return (
            <button
              key={group.hill.id}
              type="button"
              onClick={() => setActiveGroup(group)}
              title={`${formatHillTitle(group.hill)} · ${missionCount} extra`}
              className="relative flex h-11 w-11 items-center justify-center rounded-full text-white shadow-sm transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-violet-300"
              style={{ backgroundColor: accent }}
              aria-label={`${formatHillTitle(group.hill)}, ${missionCount} extra missions`}
            >
              {Icon ? <Icon className="h-5 w-5" /> : null}
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-950 px-1 text-[9px] font-bold text-white">
                {missionCount}
              </span>
            </button>
          );
        })}
      </div>

      {activeGroup ? (
        <ExtraHillModal group={activeGroup} onClose={() => setActiveGroup(null)} />
      ) : null}
    </div>
  );
}
