import { useEffect, useState } from 'react';
import { Mountain, Sparkles, Tent } from 'lucide-react';

const CAMP_MESSAGES = {
  'Base Camp': 'You reached Base Camp — your climb has officially begun!',
  'Camp 2': 'Camp 2 reached! Your consistency is building real momentum.',
  'Camp 3': 'Welcome to Camp 3 — you are finding your rhythm on this hill.',
  'Camp 4': 'Camp 4! Halfway to the summit zone — keep climbing.',
  'Camp 5': 'Camp 5 reached — you are deep into the 49-week climb.',
  'Camp 6': 'Camp 6! The summit is within sight. What a climb.',
  Summit: 'Summit reached! You completed all 49 weeks on this hill.',
};

export function CampCelebrationModal({ open, camp, hillTitle, onConfirm }) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open && camp?.name) {
      setMessage(CAMP_MESSAGES[camp.name] ?? `You reached ${camp.name}!`);
    }
  }, [open, camp?.name]);

  if (!open || !camp) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camp-celebration-title"
    >
      <div className="w-full max-w-app overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-amber-100 via-white to-violet-50 px-6 pb-2 pt-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-200">
            <Tent className="h-8 w-8" strokeWidth={2.2} aria-hidden="true" />
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-amber-700">
            Camp milestone
          </p>
          <h2
            id="camp-celebration-title"
            className="mt-1 font-display text-2xl font-semibold text-violet-950"
          >
            {camp.name}
          </h2>
          {hillTitle ? (
            <p className="mt-1 text-sm font-medium text-violet-700">{hillTitle}</p>
          ) : null}
        </div>

        <div className="px-6 pb-6 pt-4 text-center">
          <p className="text-sm leading-relaxed text-violet-800/90">{message}</p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-700">
            <Mountain className="h-3.5 w-3.5" aria-hidden="true" />
            Permanent checkpoint — never lost
          </p>

          <button
            type="button"
            onClick={onConfirm}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-amber-300/40"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Continue climb
          </button>
        </div>
      </div>
    </div>
  );
}
