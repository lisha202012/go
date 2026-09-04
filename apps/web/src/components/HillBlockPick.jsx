import { useEffect, useState } from 'react';
import { formatHillSubtitle, formatHillTitle } from '../lib/hills';
import { formatNextStepIntro } from '../lib/cycleLabels';
import { formatStepLabel } from '../lib/hillProgress';
import { api } from '../lib/api';
import { MissionChangeSheet, MissionPickCard } from './MissionChangeSheet';

const PICK_COUNT = 3;

export function HillBlockPick({
  stepNumber,
  blockStartWeek,
  hill,
  onComplete,
  onCancel,
}) {
  const [missions, setMissions] = useState([]);
  const [rewards, setRewards] = useState(null);
  const [changingSlotId, setChangingSlotId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const displayHill = hill ?? {};
  const selectedIds = missions.map((m) => m.id);
  const changingSlot = missions.find((m) => m.id === changingSlotId) ?? null;
  const cycleContext =
    blockStartWeek != null ? `block-${blockStartWeek}` : stepNumber ? `block-${stepNumber}` : 'block-1';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.getBlockSelectionOptions();
        if (!cancelled) {
          const loaded = result.options ?? [];
          setMissions(loaded);
          setRewards(result.rewards ?? null);
          setLoadError('');
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Could not load options');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleMissionSwapped(originalId, replacementMission) {
    if (!replacementMission) return;
    setMissions((prev) => prev.map((m) => (m.id === originalId ? replacementMission : m)));
    setChangingSlotId(null);
  }

  async function confirm() {
    if (selectedIds.length !== PICK_COUNT) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await api.selectBlockMissions(selectedIds);
      onComplete?.(result);
    } catch (err) {
      setSubmitError(err.message || 'Could not save your picks');
    } finally {
      setSubmitting(false);
    }
  }

  const pickReady = selectedIds.length === PICK_COUNT;
  const stepIntro = stepNumber
    ? `${formatStepLabel(stepNumber)} on ${formatHillTitle(displayHill)} · ${formatHillSubtitle(displayHill)}`
    : formatNextStepIntro({ stepNumber, hill: displayHill });

  return (
    <section className="flex min-h-[50vh] flex-col px-1 pb-4">
      <h2 className="font-display text-xl font-semibold text-violet-900">
        Your 3 {formatHillTitle(displayHill)} missions
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-violet-800/70">
        {stepIntro}. Pick {PICK_COUNT} missions to work on together for this step.
      </p>
      <p className="mt-2 text-xs text-violet-600/90">
        One step = complete all 3 missions on this hill in order. Camps you reach along the way are
        permanent — they stay unlocked even if you pause between steps.
      </p>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-violet-100 px-4 py-2.5">
        <p className="text-sm font-semibold text-violet-800">
          Ready to confirm: {selectedIds.length} / {PICK_COUNT}
        </p>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-violet-600">Loading mission options…</p>
      ) : loadError ? (
        <p className="mt-6 text-sm text-rose-600">{loadError}</p>
      ) : missions.length === 0 ? (
        <p className="mt-6 text-sm text-violet-600">
          No mission options are available right now. Pull down to refresh or try again shortly.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {missions.map((mission, index) => (
            <MissionPickCard
              key={mission.id}
              mission={mission}
              pickOrder={index + 1}
              rewards={rewards}
              onChange={() => setChangingSlotId(mission.id)}
            />
          ))}
        </ul>
      )}

      {submitError ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{submitError}</p>
      ) : null}

      <MissionChangeSheet
        open={Boolean(changingSlot)}
        slotMission={changingSlot}
        hillId={displayHill.id}
        selectedMissionIds={selectedIds}
        cycleContext={cycleContext}
        rewards={rewards}
        onClose={() => setChangingSlotId(null)}
        onSwapped={handleMissionSwapped}
      />

      <div className="mt-auto flex flex-col gap-2 pt-6">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-2xl border border-violet-200 bg-white px-5 py-3 text-sm font-semibold text-violet-700"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          disabled={!pickReady || submitting || Boolean(loadError)}
          onClick={confirm}
          className="w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Start this step'}
        </button>
      </div>
    </section>
  );
}
