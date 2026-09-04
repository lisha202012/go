import { motion } from 'framer-motion';
import { GrowChallengeProgress } from './GrowChallengeProgress';

export function GrowChallengeCompleteModal({ open, challenge, onConfirm }) {
  if (!open || !challenge) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grow-challenge-complete-title"
    >
      <motion.div
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-emerald-400/40 bg-gradient-to-br from-[#0a2218] via-[#0f281c] to-[#102818] p-6 shadow-[0_0_40px_rgba(16,185,129,0.35)]"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      >
        <p className="text-center text-4xl" aria-hidden="true">
          🎉
        </p>
        <h2
          id="grow-challenge-complete-title"
          className="mt-3 text-center font-display text-lg font-bold leading-snug text-emerald-100"
        >
          30-DAY GOFAM GROW CHALLENGE COMPLETED! 🎉
        </h2>
        <div className="mt-5 flex justify-center">
          <GrowChallengeProgress challenge={challenge} />
        </div>
        <p className="mt-4 text-center text-sm leading-relaxed text-emerald-200/85">
          3 Missions → 1 Glow Seed → 21 Glow Seeds → Challenge Complete. Keep growing your tree.
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-5 w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
        >
          Continue
        </button>
      </motion.div>
    </div>
  );
}
