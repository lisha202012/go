import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { formatMissionCoinLabel, normalizeMissionRewards } from '../lib/missionRewards';

function AlternateRow({ mission, rewards, onSelect, selecting }) {
  const rewardConfig = normalizeMissionRewards(rewards);

  return (
    <button
      type="button"
      disabled={selecting}
      onClick={() => onSelect(mission.id)}
      className="flex w-full items-start gap-3 rounded-xl border border-violet-100 bg-white px-3 py-3 text-left transition hover:border-violet-300 hover:bg-violet-50/50 disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-violet-900">{mission.title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-violet-700/75">
          {mission.description}
        </span>
        <span className="mt-2 inline-flex gap-2 text-[11px] font-semibold text-violet-600">
          <span>{formatMissionCoinLabel(rewardConfig)}</span>
          {mission.requiresReflection ? <span>· Reflection</span> : null}
          {mission.requiresEvidence ? <span>· Evidence</span> : null}
        </span>
      </span>
    </button>
  );
}

export function MissionPickCard({
  mission,
  pickOrder,
  rewards,
  canChange = true,
  onChange,
}) {
  const rewardConfig = normalizeMissionRewards(rewards);

  return (
    <div className="flex w-full items-start gap-3 rounded-2xl border border-violet-500 bg-violet-50 px-4 py-3.5 shadow-md shadow-violet-200/50 ring-2 ring-violet-300/60">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
        {pickOrder}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-violet-900">{mission.title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-violet-700/75">
          {mission.description}
        </span>
        <div className="mt-2">
          <p className="text-[11px] font-semibold text-violet-600">
            {formatMissionCoinLabel(rewardConfig)}
            {mission.requiresReflection ? <span> · Reflection</span> : null}
            {mission.requiresEvidence ? <span> · Evidence</span> : null}
          </p>
          {canChange ? (
            <button
              type="button"
              onClick={() => onChange?.(mission.id)}
              className="mt-1.5 text-xs font-semibold text-violet-700 underline decoration-violet-300 underline-offset-2 hover:text-violet-900"
            >
              Change Mission
            </button>
          ) : null}
        </div>
      </span>
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-violet-600 bg-violet-600 text-[10px] font-bold text-white"
        aria-hidden="true"
      >
        ✓
      </span>
    </div>
  );
}

export function MissionChangeSheet({
  open,
  slotMission,
  hillId,
  selectedMissionIds = [],
  cycleContext,
  rewards,
  onClose,
  onSwapped,
}) {
  const [alternates, setAlternates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState('');
  const fetchGenerationRef = useRef(0);

  const selectedKey = (selectedMissionIds ?? []).join(',');

  useEffect(() => {
    if (!open || !slotMission?.id || !hillId) return;

    const generation = ++fetchGenerationRef.current;
    let cancelled = false;

    async function loadAlternates(retryCount = 0) {
      setLoading(true);
      setError('');
      setAlternates([]);
      try {
        const result = await api.getMissionAlternates({
          hillId,
          slotMissionId: slotMission.id,
          selectedMissionIds,
          context: cycleContext,
        });
        if (cancelled || generation !== fetchGenerationRef.current) return;
        setAlternates(result.alternates ?? []);
      } catch (err) {
        if (cancelled || generation !== fetchGenerationRef.current) return;
        const retryable = err.status === 503 || err.status === 0;
        if (retryable && retryCount < 1) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          if (!cancelled && generation === fetchGenerationRef.current) {
            return loadAlternates(retryCount + 1);
          }
          return;
        }
        setError(err.message || 'Could not load alternates');
      } finally {
        if (!cancelled && generation === fetchGenerationRef.current) {
          setLoading(false);
        }
      }
    }

    loadAlternates();

    return () => {
      cancelled = true;
    };
  }, [open, slotMission?.id, hillId, selectedKey, cycleContext]);

  if (!open) return null;

  async function pickReplacement(replacementMissionId) {
    setSelecting(true);
    setError('');
    try {
      await api.recordMissionSwap({
        hillId,
        originalMissionId: slotMission.id,
        replacementMissionId,
        context: cycleContext,
      });
      const replacement = alternates.find((m) => m.id === replacementMissionId);
      onSwapped?.(slotMission.id, replacement);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Could not swap mission');
    } finally {
      setSelecting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        className="flex max-h-[min(85vh,640px)] w-full max-w-md flex-col rounded-3xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-change-title"
      >
        <div className="flex items-start justify-between border-b border-violet-100 px-5 py-4">
          <div>
            <p id="mission-change-title" className="font-display text-lg font-semibold text-violet-900">
              Change Mission
            </p>
            <p className="mt-1 text-xs text-violet-600/90">
              Replacing: <span className="font-semibold">{slotMission?.title}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-violet-500 hover:bg-violet-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs text-violet-700/80">
            Pick another mission from your hill pool. Swapping won&apos;t reduce your rewards.
          </p>
          {loading ? (
            <p className="py-8 text-center text-sm text-violet-600">Loading alternates…</p>
          ) : null}
          {!loading && !error && alternates.length === 0 ? (
            <p className="py-8 text-center text-sm text-violet-600">No alternates available.</p>
          ) : null}
          <div className="mt-3 space-y-2">
            {alternates.map((mission) => (
              <AlternateRow
                key={mission.id}
                mission={mission}
                rewards={rewards}
                selecting={selecting}
                onSelect={pickReplacement}
              />
            ))}
          </div>
          {error ? (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function useMissionSelection(initialMissions = [], initialRewards = null) {
  const [missions, setMissions] = useState(initialMissions);
  const [rewards, setRewards] = useState(initialRewards);
  const [changingSlotId, setChangingSlotId] = useState(null);

  useEffect(() => {
    if (initialMissions.length > 0) {
      setMissions(initialMissions);
    }
  }, [initialMissions]);

  const selectedIds = missions.map((m) => m.id);
  const changingSlot = missions.find((m) => m.id === changingSlotId) ?? null;

  function applySwap(originalId, replacementId, replacementMission) {
    setMissions((prev) =>
      prev.map((m) => (m.id === originalId ? { ...replacementMission, id: replacementId } : m)),
    );
  }

  function handleSwapped(originalId, replacementId, alternatesList) {
    const replacement = alternatesList?.find((m) => m.id === replacementId);
    if (replacement) {
      applySwap(originalId, replacementId, replacement);
      return;
    }
    setMissions((prev) => {
      const idx = prev.findIndex((m) => m.id === originalId);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], id: replacementId };
      return next;
    });
  }

  return {
    missions,
    setMissions,
    rewards,
    setRewards,
    selectedIds,
    changingSlotId,
    setChangingSlotId,
    changingSlot,
    applySwap,
    handleSwapped,
  };
}
