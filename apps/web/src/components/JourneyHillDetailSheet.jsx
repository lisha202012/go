import { X } from 'lucide-react';
import { formatHillTitle } from '../lib/hills';
import { JourneyHillClimbSection } from './JourneyHillClimbSection';

export function JourneyHillDetailSheet({
  open,
  hillCode,
  onClose,
  dashboardHills = [],
  growChallenge = null,
  onAfterMissionComplete,
}) {
  if (!open || !hillCode) return null;

  const hill = dashboardHills.find((h) => h.code === hillCode);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0">
      <button type="button" className="absolute inset-0" aria-label="Close hill details" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="journey-hill-sheet-title"
        className="relative z-10 flex max-h-[88vh] w-full max-w-[480px] flex-col rounded-t-3xl border border-violet-500/25 bg-[#14141f] shadow-[0_-12px_48px_rgba(0,0,0,0.55)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-violet-500/20 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-400">Hill details</p>
            <h2
              id="journey-hill-sheet-title"
              className="font-display text-lg font-semibold text-violet-50"
            >
              {hill ? formatHillTitle(hill) : hillCode}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-violet-400 transition hover:bg-violet-500/15 hover:text-violet-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-3">
          <JourneyHillClimbSection
            dashboardHills={dashboardHills}
            growChallenge={growChallenge}
            journeyView="sheet"
            sheetHillCode={hillCode}
            onAfterMissionComplete={() => {
              onAfterMissionComplete?.();
            }}
          />
        </div>
      </div>
    </div>
  );
}
