import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gift, Sparkles } from 'lucide-react';

export function CoachMonthlySurpriseModal({ open, surprise, onDismiss }) {
  if (!open || !surprise) return null;

  const coachName = surprise.coachDisplayName || 'GoFam Coach Bala';
  const monthLabel = surprise.monthLabel || 'this month';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coach-monthly-surprise-title"
    >
      <motion.div
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-amber-400/35 bg-gradient-to-br from-[#2a1a0a] via-[#1f1408] to-[#140e06] p-6 shadow-[0_0_40px_rgba(245,158,11,0.28)]"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      >
        <div className="flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 ring-2 ring-amber-400/50">
            <Gift className="h-7 w-7 text-amber-300" aria-hidden="true" />
          </span>
        </div>

        <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200/90">
          A surprise from your coach
        </p>

        <h2
          id="coach-monthly-surprise-title"
          className="mt-2 text-center font-display text-xl font-bold leading-snug text-amber-50"
        >
          {coachName} left you a gift
        </h2>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-amber-100/90">
          <p>
            You&apos;ve been growing — so Coach Bala shared a spontaneous Glow Seed with you in{' '}
            {monthLabel}. Open it to add another virtue to your collection.
          </p>
          <p className="flex items-start gap-2 rounded-xl bg-amber-950/50 px-3 py-2 text-amber-100">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            <span>
              These monthly surprises arrive on different days — never like a fixed allowance on the
              1st.
            </span>
          </p>
        </div>

        <Link
          to={`/glow?openSeed=${encodeURIComponent(surprise.seedId)}`}
          onClick={onDismiss}
          className="mt-5 flex w-full items-center justify-center rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-amber-950 transition hover:bg-amber-400"
        >
          Open my surprise seed
        </Link>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-2 w-full rounded-2xl py-2 text-xs font-medium text-amber-300/90 hover:text-amber-100"
        >
          I&apos;ll open it later on GLOW
        </button>
      </motion.div>
    </div>
  );
}
