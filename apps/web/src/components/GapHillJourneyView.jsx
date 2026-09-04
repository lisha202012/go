import { motion } from 'framer-motion';
import { HILL_LUCIDE } from '../lib/hillIcons';
import { HILL_RING_COLORS } from '../lib/hillRingColors';
import { GAP_HILL_JOURNEY_ORDER, GAP_QUESTIONS_PER_HILL } from '../lib/gapHillJourney';

/** Exact image ratio — gap-hill-journey-map.png is 572×1024. */
const MAP_ASPECT = 572 / 1024;

/** Label positions beside each hill on the artwork (%). */
const HILL_LAYOUT = [
  { step: 1, labelX: 22, labelY: 84 },
  { step: 2, labelX: 72, labelY: 73 },
  { step: 3, labelX: 10, labelY: 61 },
  { step: 4, labelX: 80, labelY: 49 },
  { step: 5, labelX: 16, labelY: 38 },
  { step: 6, labelX: 78, labelY: 25 },
  { step: 7, labelX: 49, labelY: 14 },
];

const STAGGER_S = 0.12;

function pct(v) {
  return `${v}%`;
}

function hillColor(code, hillsByCode) {
  return hillsByCode?.[code]?.colorTheme ?? HILL_RING_COLORS[code] ?? '#7C3AED';
}

function HillLabel({ code, hill, color, isLocked, staggerDelay }) {
  const Icon = HILL_LUCIDE[code];

  return (
    <motion.div
      className="absolute z-20"
      style={{
        left: pct(hill.labelX),
        top: pct(hill.labelY),
        transform: 'translate(-50%, -50%)',
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24, delay: staggerDelay }}
    >
      <div
        className="w-[3.75rem] rounded-lg border border-white/80 px-1.5 py-1 text-center shadow-md backdrop-blur-sm"
        style={{
          background: isLocked
            ? 'rgba(255,255,255,0.92)'
            : `linear-gradient(140deg, ${color} 0%, ${color}CC 100%)`,
        }}
      >
        <div className="flex items-center justify-center gap-0.5">
          {Icon ? (
            <Icon
              width={10}
              height={10}
              className={isLocked ? 'text-slate-500' : 'text-white'}
              strokeWidth={2.5}
              aria-hidden="true"
            />
          ) : null}
          <span
            className={[
              'text-[9px] font-bold leading-none',
              isLocked ? 'text-slate-700' : 'text-white',
            ].join(' ')}
          >
            {code}
          </span>
        </div>
        <p
          className={[
            'mt-0.5 text-[6px] font-semibold leading-tight',
            isLocked ? 'text-slate-500' : 'text-white/90',
          ].join(' ')}
        >
          Step {hill.step} · {GAP_QUESTIONS_PER_HILL} Qs
        </p>
      </div>
    </motion.div>
  );
}

export function GapHillJourneyView({
  hillsByCode = {},
  startHillCode = GAP_HILL_JOURNEY_ORDER[0],
}) {
  return (
    <section
      className="overflow-hidden rounded-3xl border border-amber-200/50 bg-white shadow-xl shadow-amber-950/10"
      aria-label="Seven hills journey map"
    >
      <header className="border-b border-amber-100/80 bg-gradient-to-b from-amber-50/90 to-white px-4 py-2.5 text-center">
        <p className="font-display text-[11px] font-bold tracking-[0.22em] text-emerald-900">
          7 HILLS · YOUR JOURNEY
        </p>
      </header>

      <div className="relative w-full overflow-hidden bg-slate-900" style={{ aspectRatio: MAP_ASPECT }}>
        <img
          src="/images/gap-hill-journey-map.png"
          alt="Seven hills journey map"
          className="absolute inset-0 h-full w-full object-fill"
          draggable={false}
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-[5] rounded-full bg-gradient-to-b from-[#4a7c45]/90 to-[#3d6b38]/95 blur-[1px]"
          style={{ left: '34%', top: '88.5%', width: '14%', height: '2.8%', transform: 'translate(-50%, -50%)' }}
        />

        {GAP_HILL_JOURNEY_ORDER.map((code, index) => (
          <HillLabel
            key={code}
            code={code}
            hill={HILL_LAYOUT[index]}
            color={hillColor(code, hillsByCode)}
            isLocked={code !== startHillCode}
            staggerDelay={0.1 + index * STAGGER_S}
          />
        ))}
      </div>
    </section>
  );
}
