import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, ShieldCheck } from 'lucide-react';

export function OrgVerifiedPromptModal({ open, prompt, onDismiss }) {
  if (!open || !prompt) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="org-verified-prompt-title"
    >
      <motion.div
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-emerald-400/35 bg-gradient-to-br from-[#0a2218] via-[#0f281c] to-[#102818] p-6 shadow-[0_0_40px_rgba(16,185,129,0.28)]"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        <div className="flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-400/50">
            <Building2 className="h-7 w-7 text-emerald-300" />
          </span>
        </div>
        <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300/90">
          Your school joined GOFAM
        </p>
        <h2
          id="org-verified-prompt-title"
          className="mt-2 text-center font-display text-xl font-bold text-emerald-50"
        >
          {prompt.organizationName} is now GOFAM verified
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-emerald-100/90">
          You previously registered interest — thank you! That did not auto-enroll you. Complete
          official verification with your school&apos;s invite code to represent them on
          leaderboards.
        </p>
        <Link
          to="/profile#belonging"
          onClick={onDismiss}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-emerald-950"
        >
          <ShieldCheck className="h-4 w-4" />
          Verify my membership
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-2 w-full py-2 text-xs font-medium text-emerald-300/90"
        >
          Later
        </button>
      </motion.div>
    </div>
  );
}
