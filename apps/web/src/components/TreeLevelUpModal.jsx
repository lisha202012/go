import { TreePine, Sparkles } from 'lucide-react';

export function TreeLevelUpModal({ open, stage, level, onConfirm }) {
  if (!open || !stage) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tree-level-up-title"
    >
      <div className="w-full max-w-app overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-emerald-100 via-white to-amber-50 px-6 pb-2 pt-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200">
            <TreePine className="h-8 w-8" strokeWidth={2.2} aria-hidden="true" />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-emerald-700">
            Tree of Life
          </p>
          <h2
            id="tree-level-up-title"
            className="mt-1 font-display text-2xl font-semibold text-violet-950"
          >
            {stage}
          </h2>
          {level ? (
            <p className="mt-1 text-sm font-medium text-violet-700">Tree Level {level}</p>
          ) : null}
        </div>
        <div className="px-6 pb-6 pt-4 text-center">
          <p className="text-sm leading-relaxed text-violet-800/90">
            Your Tree evolved. Lifetime growth, made visible.
          </p>
          <button
            type="button"
            onClick={onConfirm}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-300/40"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
