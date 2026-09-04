import { useState } from 'react';
import { api } from '../lib/api';
import { formatHillTitle } from '../lib/hills';
import { CampCelebrationModal } from './CampCelebrationModal';

function formatMissedDate(iso) {
  if (!iso) return 'a previous day';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'a previous day';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function MissedDayRecoveryCard({
  blockingMissedDay,
  campStreak,
  onResolved,
  onCompleteMissedMissions,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [campReached, setCampReached] = useState(null);

  if (!blockingMissedDay) return null;

  const tokensAvailable = campStreak?.tokensAvailable ?? 0;
  const hillTitle = formatHillTitle(blockingMissedDay.hill);
  const dateLabel = formatMissedDate(blockingMissedDay.calendarDate);

  async function handleUseStreak() {
    setBusy(true);
    setError('');
    try {
      const result = await api.resolveMissedDayWithStreak(blockingMissedDay.dayAssignmentId);
      if (result.campReached) {
        setCampReached(result.campReached);
      }
      await onResolved?.();
    } catch (err) {
      setError(err.message || 'Could not use a free streak');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section
        id="missed-day"
        className="rounded-3xl border border-amber-200 bg-white p-4 shadow-sm"
      >
        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
          Missed day
        </p>
        <h2 className="mt-1 font-display text-base font-semibold text-violet-950">
          You missed {hillTitle} on {dateLabel}
        </h2>
        <p className="mt-1.5 text-sm text-violet-800/80">
          {tokensAvailable > 0
            ? `You have ${tokensAvailable} free streak${tokensAvailable === 1 ? '' : 's'} available`
            : "No free streaks left — you'll need to complete it yourself."}
        </p>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        <div className="mt-3 grid gap-2">
          {tokensAvailable > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleUseStreak}
              className="w-full rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/25 transition hover:bg-violet-700 disabled:bg-violet-300"
            >
              {busy ? 'Using streak…' : 'Use a Free Streak'}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => onCompleteMissedMissions?.(blockingMissedDay.dayIndex)}
            className="w-full rounded-2xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-800 transition hover:bg-violet-50 disabled:opacity-50"
          >
            Complete Missed Missions
          </button>
        </div>
      </section>

      <CampCelebrationModal
        open={Boolean(campReached)}
        camp={campReached}
        hillTitle={hillTitle}
        onConfirm={() => setCampReached(null)}
      />
    </>
  );
}
