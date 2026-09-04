import { Heart, Sprout, X } from 'lucide-react';

const MILESTONES = [
  { lifetime: '10,000', reward: '1,000' },
  { lifetime: '50,000', reward: '2,000' },
  { lifetime: '100,000', reward: '3,000' },
  { lifetime: '250,000', reward: '5,000' },
  { lifetime: '500,000', reward: '7,500' },
  { lifetime: '1,000,000', reward: '10,000' },
];

export function HarvestHowItWorksModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        className="max-h-[88dvh] w-full max-w-app overflow-y-auto rounded-3xl border border-emerald-500/20 bg-[#12121c] p-5 shadow-2xl"
        role="dialog"
        aria-labelledby="harvest-how-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400">
              GLOW Harvest Rewards v1.0
            </p>
            <h2 id="harvest-how-title" className="font-display text-xl font-semibold text-violet-50">
              How it works
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-violet-400 hover:bg-violet-500/10 hover:text-violet-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-violet-200/90">
          Harvest Rewards celebrate the person who introduced another member to GOFAM. This is not
          referral commission, passive income, or multi-level marketing — it is a small thank-you
          for planting a GLOW Seed that helped someone begin.
        </p>
        <p className="mt-2 text-sm font-medium italic text-emerald-300/90">
          &ldquo;You didn&apos;t build their life. You helped them begin.&rdquo;
        </p>

        <section className="mt-4 rounded-2xl border border-violet-500/15 bg-[#0f0f18] p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-violet-300">Eligibility</h3>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-violet-200/85">
            <li>✅ Direct GLOW Seed relationships only — you must be the original planter.</li>
            <li>✅ No second-level or indirect rewards.</li>
            <li>✅ Triggered when they reach lifetime Personal Growth Coin milestones.</li>
            <li>❌ Promotional, admin, or purchased coins do not count.</li>
          </ul>
        </section>

        <section className="mt-3 rounded-2xl border border-emerald-500/15 bg-[#0a1410] p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-300">
            Harvest milestones
          </h3>
          <ul className="mt-2 divide-y divide-emerald-500/10">
            {MILESTONES.map((row) => (
              <li
                key={row.lifetime}
                className="flex items-center justify-between py-1.5 text-xs text-violet-100"
              >
                <span>{row.lifetime} lifetime coins</span>
                <span className="font-semibold text-amber-300">+{row.reward} coins</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-emerald-300/80">
            Total possible per referral: <strong>28,500 coins</strong> (spread across years of
            genuine growth). Each milestone is awarded once only.
          </p>
        </section>

        <section className="mt-3 rounded-2xl border border-violet-500/15 bg-[#0f0f18] p-3">
          <h3 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-violet-300">
            <Heart className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
            Philosophy
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-violet-200/85">
            The recipient is always the hero. Harvest Rewards should feel appreciative, meaningful,
            and small compared to their achievement — never transactional or passive.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-300/90">
            <Sprout className="h-3.5 w-3.5" aria-hidden="true" />
            Master the FLOW. Share the GLOW. Harvest the Joy.
          </p>
        </section>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
