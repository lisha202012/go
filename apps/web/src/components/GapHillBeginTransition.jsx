import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { GapHillJourneyView } from './GapHillJourneyView';
import { HILL_LUCIDE } from '../lib/hillIcons';
import { HILL_RING_COLORS } from '../lib/hillRingColors';
import { GAP_HILL_JOURNEY_ORDER } from '../lib/gapHillJourney';

/** HOPE cottage marker on the map (%). */
const HILL = { x: 40, y: 87 };
const DURATION_MS = 1400;

export function GapHillBeginTransition({
  hillsByCode = {},
  hillCode = GAP_HILL_JOURNEY_ORDER[0],
  onComplete,
}) {
  const Icon = HILL_LUCIDE[hillCode];
  const color = hillsByCode?.[hillCode]?.colorTheme ?? HILL_RING_COLORS[hillCode] ?? '#F4A261';

  useEffect(() => {
    const timer = setTimeout(() => onComplete?.(), DURATION_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col px-6 pb-10 pt-4">
      <div className="relative overflow-hidden rounded-3xl">
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: 1.32 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: `${HILL.x}% ${HILL.y}%` }}
        >
          <GapHillJourneyView hillsByCode={hillsByCode} startHillCode={hillCode} />
        </motion.div>

        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-black/25"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 0.5 }}
        />

        {/* Soft glow on the hill */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 rounded-full"
          style={{
            left: `${HILL.x}%`,
            top: `${HILL.y}%`,
            width: '20%',
            height: '20%',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`,
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.7, 0], scale: [0.5, 1.3, 1.6] }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />

        {/* Hill icon pulse */}
        <motion.div
          className="absolute z-20 flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white shadow-xl"
          style={{
            left: `${HILL.x}%`,
            top: `${HILL.y}%`,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle at 35% 30%, ${color}EE, ${color})`,
          }}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: [0.7, 1.12, 1], opacity: [0, 1, 0] }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        >
          {Icon ? (
            <Icon width={20} height={20} className="text-white" strokeWidth={2.25} aria-hidden="true" />
          ) : null}
        </motion.div>

        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-30 bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.95, duration: 0.4, ease: 'easeIn' }}
        />
      </div>

      <motion.p
        className="mt-4 text-center text-sm font-medium text-violet-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        Starting {hillCode}…
      </motion.p>
    </section>
  );
}
