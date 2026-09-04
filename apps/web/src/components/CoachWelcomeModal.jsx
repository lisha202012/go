import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Sparkles, Sprout } from 'lucide-react';

const VIRTUE_EMOJI = {
  Kindness: '❤️',
  Responsibility: '🧡',
  Discipline: '💛',
  Integrity: '💚',
  HardWork: '💙',
  Courage: '🔷',
  Patience: '🟣',
};

export function CoachWelcomeModal({ open, welcome, onDismiss }) {
  if (!open || !welcome) return null;

  const coachName = welcome.coachDisplayName || 'GoFam Coach Bala';
  const pending = welcome.phase === 'pending_seed';
  const virtueEmoji = VIRTUE_EMOJI[welcome.virtue] ?? '🌸';
  const virtueLabel = welcome.virtueLabel || welcome.virtue || 'a virtue';
  const hillName = welcome.hillName;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coach-welcome-title"
    >
      <motion.div
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-violet-400/35 bg-gradient-to-br from-[#1a1033] via-[#22143f] to-[#14082a] p-6 shadow-[0_0_40px_rgba(124,58,237,0.35)]"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      >
        <div className="flex justify-center">
          {pending ? (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-400/50">
              <Sprout className="h-7 w-7 text-emerald-300" aria-hidden="true" />
            </span>
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/20 ring-2 ring-rose-400/50">
              <Heart className="h-7 w-7 text-rose-300" aria-hidden="true" />
            </span>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300">
          Welcome to GOFAM GROW
        </p>

        <h2
          id="coach-welcome-title"
          className="mt-2 text-center font-display text-xl font-bold leading-snug text-violet-50"
        >
          {pending
            ? `${coachName} sent your first Glow Seed`
            : `${coachName} welcomed you to GLOW`}
        </h2>

        {pending ? (
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-violet-200/90">
            <p>
              You&apos;re officially connected with your GOFAM Coach — a friend who helps you start
              your growth journey.
            </p>
            <p>
              A <span className="font-semibold text-emerald-200">Glow Seed</span> is a gift that
              blooms into one of seven virtues (like Kindness or Courage) and adds it to your
              collection on the Tree of Life.
            </p>
            {welcome.friendSeed ? (
              <p className="rounded-xl bg-amber-950/50 px-3 py-2 text-amber-100">
                You also have a seed from{' '}
                <span className="font-semibold">
                  {welcome.friendSeed.senderDisplayName ||
                    `@${welcome.friendSeed.senderUsername}`}
                </span>
                . You&apos;ll see both on GLOW — open each one when you&apos;re ready.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-violet-200/90">
            <p className="rounded-xl bg-emerald-950/40 px-3 py-3 text-center">
              <span className="text-2xl" aria-hidden="true">
                {virtueEmoji}
              </span>
              <span className="mt-1 block font-display text-lg font-semibold text-emerald-100">
                {virtueLabel}
              </span>
              {hillName ? (
                <span className="mt-0.5 block text-xs text-emerald-200/80">
                  Added to your virtue collection · {hillName} hill
                </span>
              ) : (
                <span className="mt-0.5 block text-xs text-emerald-200/80">
                  Added to your virtue collection
                </span>
              )}
            </p>
            <p>
              Coach Bala&apos;s welcome gift is a virtue for your collection — not double coins.
              When friends send you seeds later, blooming can activate ×2 mission coins on that hill
              until month-end.
            </p>
            <p className="flex items-start gap-2 rounded-xl bg-violet-950/60 px-3 py-2 text-violet-100">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
              <span>
                Collect all seven virtues over time. Each one lights a part of your Tree of Life.
              </span>
            </p>
          </div>
        )}

        {pending ? (
          <Link
            to={`/glow?openSeed=${encodeURIComponent(welcome.seedId)}`}
            onClick={onDismiss}
            className="mt-5 flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
          >
            Open & bloom my seed
          </Link>
        ) : (
          <button
            type="button"
            onClick={onDismiss}
            className="mt-5 w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            Got it — let&apos;s grow
          </button>
        )}

        {pending ? (
          <button
            type="button"
            onClick={onDismiss}
            className="mt-2 w-full rounded-2xl py-2 text-xs font-medium text-violet-300 hover:text-violet-100"
          >
            I&apos;ll open it later
          </button>
        ) : null}
      </motion.div>
    </div>
  );
}
