import { motion } from 'framer-motion';
import { HILL_RING_COLORS } from '../lib/hillRingColors';
import { HILL_LUCIDE } from '../lib/hillIcons';
import {
  GAP_HILL_ARC_OFFSETS,
  GAP_HILL_JOURNEY_ORDER,
} from '../lib/gapHillJourney';

const LOCKED = {
  opacity: 0.35,
  scale: 0.9,
  filter: 'grayscale(100%)',
};

function hillThemeColor(code, hillsByCode) {
  return hillsByCode?.[code]?.colorTheme ?? HILL_RING_COLORS[code] ?? '#7C3AED';
}

function hillState(code, progress, currentHillCode) {
  const entry = progress?.[code];
  if (entry?.complete) return 'complete';
  if (code === currentHillCode) return 'current';
  return 'locked';
}

function AnimatedHillIcon({
  code,
  color,
  variant,
  state,
  popToken = 0,
  celebrateHillCode = null,
  arcIndex,
}) {
  const Icon = HILL_LUCIDE[code];
  const isIntro = variant === 'intro';
  const size = isIntro ? 48 : 32;
  const iconPx = isIntro ? 20 : 14;
  const isCurrent = state === 'current';
  const isComplete = state === 'complete';
  const isLocked = state === 'locked';
  const isPopping = celebrateHillCode === code;

  const circleAnimate = (() => {
    if (isPopping) {
      return {
        opacity: 1,
        scale: [1, 1.3, 1],
        filter: 'grayscale(0%)',
        boxShadow: [`0 0 10px ${color}66`, `0 0 22px ${color}cc`, `0 0 12px ${color}88`],
      };
    }
    if (isCurrent) {
      return {
        opacity: 1,
        scale: [1.1, 1.2, 1.1],
        filter: 'grayscale(0%)',
        boxShadow: [
          `0 0 8px ${color}55`,
          `0 0 20px ${color}bb`,
          `0 0 8px ${color}55`,
        ],
      };
    }
    if (isComplete) {
      return {
        opacity: 1,
        scale: 1,
        filter: 'grayscale(0%)',
        boxShadow: `0 0 10px ${color}55`,
      };
    }
    return LOCKED;
  })();

  const circleTransition = (() => {
    if (isPopping) {
      return { duration: 0.4, ease: 'easeOut' };
    }
    if (isCurrent) {
      return {
        scale: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' },
        boxShadow: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' },
        opacity: { duration: 0.25 },
        filter: { duration: 0.25 },
      };
    }
    return { duration: 0.28, ease: 'easeOut' };
  })();

  return (
    <div
      className={[
        'flex flex-col items-center',
        isIntro ? 'min-w-[2.75rem]' : 'min-w-0 flex-1',
      ].join(' ')}
      style={
        isIntro && arcIndex != null
          ? { transform: `translateY(${GAP_HILL_ARC_OFFSETS[arcIndex] ?? 0}px)` }
          : undefined
      }
    >
      <motion.div
        key={`${code}-pop-${popToken}`}
        className="flex items-center justify-center rounded-full border-2 border-white/90"
        style={{
          width: size,
          height: size,
          backgroundColor: isComplete || isCurrent || isPopping ? color : 'rgba(243, 232, 255, 0.9)',
        }}
        initial={
          isPopping
            ? { opacity: 0.35, scale: 1, filter: 'grayscale(100%)' }
            : isLocked
              ? LOCKED
              : false
        }
        animate={circleAnimate}
        transition={circleTransition}
      >
        {Icon ? (
          <Icon
            width={iconPx}
            height={iconPx}
            className={isLocked && !isPopping ? 'text-violet-400' : 'text-white'}
            aria-hidden="true"
          />
        ) : null}
      </motion.div>
      <motion.span
        className={[
          'mt-1.5 font-bold tracking-wide',
          isIntro ? 'text-[10px]' : 'text-[8px] leading-none',
          isLocked ? 'text-violet-400/70' : 'text-violet-700',
        ].join(' ')}
        animate={{ opacity: isLocked ? 0.55 : 1 }}
      >
        {code}
      </motion.span>
    </div>
  );
}

export function GapHillJourneyMap({
  variant = 'compact',
  hillsByCode = {},
  progress = {},
  currentHillCode = null,
  celebrateHillCode = null,
  hillPopTokens = {},
}) {
  const isIntro = variant === 'intro';

  return (
    <div
      className={[
        isIntro
          ? 'flex items-end justify-between gap-1 px-1 pt-2'
          : 'flex items-center justify-between gap-0.5 rounded-xl border border-violet-100/80 bg-white/60 px-1.5 py-2',
      ].join(' ')}
      aria-label="Seven hills journey progress"
    >
      {GAP_HILL_JOURNEY_ORDER.map((code, arcIndex) => (
        <AnimatedHillIcon
          key={code}
          code={code}
          color={hillThemeColor(code, hillsByCode)}
          variant={variant}
          state={hillState(code, progress, currentHillCode)}
          popToken={hillPopTokens[code] ?? 0}
          celebrateHillCode={celebrateHillCode}
          arcIndex={isIntro ? arcIndex : undefined}
        />
      ))}
    </div>
  );
}
