import { X } from 'lucide-react';

export function MissionWhySheet({ open, title, whyText, onClose }) {
  if (!open || !whyText) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-violet-100 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-500">Why?</p>
            {title ? (
              <p className="mt-1 font-display text-lg font-semibold text-violet-950">{title}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-violet-400 hover:bg-violet-50 hover:text-violet-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-violet-800/90">{whyText}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
