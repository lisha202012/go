import { useEffect } from 'react';
import { Coins, X } from 'lucide-react';
import { isMissionCompletedToday } from '../lib/missionCompletion';
import { MissionWhyDisclosure } from './MissionWhyDisclosure';

export function PulseMissionDetailBody({
  mission,
  missionIndex = 0,
  coinReward = 100,
  busy = false,
  accent = '#7C3AED',
  isRecommended = true,
  onComplete,
}) {
  if (!mission) return null;

  const doneToday = isMissionCompletedToday(mission);

  function handleComplete() {
    if (busy || doneToday) return;
    onComplete?.(mission.id);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-violet-500">
          Mission {missionIndex + 1}
          {isRecommended ? (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
              Recommended
            </span>
          ) : (
            <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
              Optional
            </span>
          )}
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold text-violet-950">{mission.title}</h3>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-violet-500">Mission</p>
        <p className="mt-1 text-sm leading-relaxed text-violet-900">{mission.description}</p>
      </div>

      <MissionWhyDisclosure whyText={mission.whyText} />

      <div className="flex items-center justify-between rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-violet-500">Reward</p>
        <p className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-800">
          <Coins className="h-4 w-4" aria-hidden="true" />
          +{coinReward} coins
        </p>
      </div>

      {doneToday ? (
        <p className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-800">
          {isRecommended ? 'Completed ✓' : 'Done today — pick a different mission'}
        </p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={handleComplete}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white disabled:opacity-60"
          style={{ backgroundColor: accent }}
        >
          {busy ? 'Completing…' : (mission.completionCount ?? 0) > 0 ? 'Complete again' : 'Complete mission'}
        </button>
      )}
    </div>
  );
}

export function PulseMissionDetailModal({
  open,
  mission,
  missionIndex = 0,
  coinReward = 100,
  busy = false,
  accent = '#7C3AED',
  isRecommended = true,
  onClose,
  onComplete,
}) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mission) return null;

  const doneToday = isMissionCompletedToday(mission);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex w-full max-w-md flex-col rounded-3xl border border-violet-500/30 bg-[#14141f] shadow-[0_24px_64px_rgba(0,0,0,0.65),0_0_32px_rgba(124,58,237,0.15)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pulse-mission-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-violet-500/20 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-violet-500">
              Mission {missionIndex + 1}
              {isRecommended ? (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                  Recommended
                </span>
              ) : (
                <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
                  Optional
                </span>
              )}
            </p>
            <h2
              id="pulse-mission-modal-title"
              className="mt-1 font-display text-lg font-semibold text-violet-100"
            >
              {mission.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-violet-400 hover:bg-violet-500/15"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-500">Mission</p>
            <p className="mt-1 text-sm leading-relaxed text-violet-200/90">{mission.description}</p>
          </div>

          <MissionWhyDisclosure whyText={mission.whyText} />

          <div className="flex items-center justify-between rounded-xl border border-violet-500/20 bg-violet-950/40 px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-500">Reward</p>
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-800">
              <Coins className="h-4 w-4" aria-hidden="true" />
              +{coinReward} coins
            </p>
          </div>

          {doneToday ? (
            <p className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-800">
              {isRecommended ? 'Completed ✓' : 'Done today — pick a different mission'}
            </p>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => !busy && onComplete?.(mission.id)}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              {busy ? 'Completing…' : (mission.completionCount ?? 0) > 0 ? 'Complete again' : 'Complete mission'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
