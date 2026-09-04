import { motion } from 'framer-motion';
import { Flower2 } from 'lucide-react';

export function TreeSummitCelebration() {
  return (
    <div className="mt-3 space-y-2.5">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        className="mx-auto w-full max-w-xs rounded-2xl border-2 px-4 py-2.5 text-center"
        style={{
          borderColor: '#F5D06A',
          background: 'linear-gradient(180deg, rgba(28, 14, 4, 0.94), rgba(12, 6, 2, 0.96))',
          boxShadow: '0 0 22px rgba(245, 208, 106, 0.45)',
        }}
      >
        <p
          className="font-display text-sm font-bold uppercase tracking-[0.18em]"
          style={{
            color: '#F5D06A',
            textShadow: '0 0 12px rgba(245, 208, 106, 0.8)',
          }}
        >
          Summit Reached
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, type: 'spring', stiffness: 240, damping: 22 }}
        className="flex items-start gap-3 rounded-2xl border px-3.5 py-3"
        style={{
          borderColor: '#F5D06A',
          background: 'linear-gradient(135deg, rgba(20, 8, 28, 0.96), rgba(8, 4, 16, 0.96))',
          boxShadow: '0 0 24px rgba(245, 208, 106, 0.28)',
        }}
      >
        <span
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{
            background: 'radial-gradient(circle at 35% 30%, #F9A8D4, #BE123C 70%)',
            boxShadow: '0 0 16px rgba(251, 113, 133, 0.75)',
          }}
        >
          <Flower2 className="h-5 w-5 text-white" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.12em]"
            style={{
              color: '#F5D06A',
              textShadow: '0 0 10px rgba(245, 208, 106, 0.7)',
            }}
          >
            Permanent Growth Activated!
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/90">
            Your Tree will keep growing, even when you miss a day. You&apos;ve built a strong
            foundation. Keep flourishing!
          </p>
        </div>
      </motion.div>
    </div>
  );
}
