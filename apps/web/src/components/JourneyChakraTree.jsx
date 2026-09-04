import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { formatHillTitle, HILL_DOMAINS } from '../lib/hills';
import { HILL_LUCIDE } from '../lib/hillIcons';
import { getTreeStageBackground, normalizeTreeLevel } from '../lib/treeStages';

/**
 * Crown → root. Neon chakra colors against a black-purple tree.
 */
export const JOURNEY_CHAKRA_SPINE = [
  { hillCode: 'HOOK', color: '#E879F9', core: '#A21CAF', glow: 'rgba(232, 121, 249, 0.95)' },
  { hillCode: 'HORN', color: '#818CF8', core: '#3730A3', glow: 'rgba(129, 140, 248, 0.95)' },
  { hillCode: 'HOST', color: '#22D3EE', core: '#0891B2', glow: 'rgba(34, 211, 238, 0.95)' },
  { hillCode: 'HOOD', color: '#4ADE80', core: '#15803D', glow: 'rgba(74, 222, 128, 0.95)' },
  { hillCode: 'HOLD', color: '#FDE047', core: '#CA8A04', glow: 'rgba(253, 224, 71, 0.95)' },
  { hillCode: 'HONE', color: '#FB923C', core: '#C2410C', glow: 'rgba(251, 146, 60, 0.95)' },
  { hillCode: 'HOPE', color: '#FB7185', core: '#BE123C', glow: 'rgba(251, 113, 133, 0.95)' },
];

const HILL_ROOT_ORDER = {
  HOPE: 1,
  HONE: 2,
  HOLD: 3,
  HOOD: 4,
  HOST: 5,
  HORN: 6,
  HOOK: 7,
};

const HILL_VIRTUE = {
  HOPE: 'Kindness',
  HONE: 'Responsibility',
  HOLD: 'Discipline',
  HOOD: 'Integrity',
  HOST: 'Hard Work',
  HORN: 'Courage',
  HOOK: 'Patience',
};

/** Trunk is slightly left of the art’s horizontal center (waterfall is on the right). */
export const CHAKRA_SPINE_X = 44.5;
export const CHAKRA_SPINE_Y = [16, 27, 38, 49, 60, 71, 82];
const LABEL_X = 2;

const SPARKLES = [
  { left: '18%', top: '12%', size: 3, delay: 0.1 },
  { left: '72%', top: '8%', size: 2, delay: 0.4 },
  { left: '88%', top: '22%', size: 2.5, delay: 0.8 },
  { left: '64%', top: '18%', size: 2, delay: 1.2 },
  { left: '40%', top: '6%', size: 2.5, delay: 0.6 },
  { left: '81%', top: '41%', size: 2, delay: 1.5 },
  { left: '91%', top: '63%', size: 3, delay: 0.3 },
  { left: '76%', top: '78%', size: 2, delay: 1.1 },
  { left: '12%', top: '48%', size: 2, delay: 0.9 },
  { left: '8%', top: '88%', size: 3, delay: 0.2 },
];

function missionCountForHill(hill) {
  if (hill?.activated || hill?.dailyFlowComplete) return 3;
  const done = hill?.prescribedCompleted;
  if (typeof done === 'number') return Math.min(3, Math.max(0, done));
  const pulses = hill?.pulses;
  if (typeof pulses === 'number' && pulses > 0) return Math.min(3, pulses);
  return 0;
}

/** Three Home Hill bonus slots around a chakra (top, lower-right, lower-left). */
export const CHAKRA_MISSION_DOT_ANGLES = [-90, 30, 150];

/** Extra (+10) lite circles — keep off the check badge (top-right) and the 3/3 dots. */
export const CHAKRA_EXTRA_DOT_ANGLES = [20, 75, 130, 180, 230, 280];

export function ChakraExtraDots({
  filled = 0,
  color,
  glow,
  size = 56,
  animateNewest = false,
  glowing = true,
  className = '',
}) {
  const c = size / 2;
  const orbit = size * 0.62;
  const count = Math.min(6, Math.max(0, filled));
  if (count <= 0 || !glowing) return null;

  return (
    <div
      className={['pointer-events-none absolute inset-0 z-[6]', className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      {CHAKRA_EXTRA_DOT_ANGLES.slice(0, count).map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const x = c + Math.cos(rad) * orbit;
        const y = c + Math.sin(rad) * orbit;
        const isNewest = animateNewest && i === count - 1;
        const dim = size * 0.13;
        return (
          <motion.span
            key={`extra-${deg}`}
            className="absolute rounded-full"
            style={{
              left: x,
              top: y,
              width: dim,
              height: dim,
              marginLeft: -(dim / 2),
              marginTop: -(dim / 2),
              background: 'rgba(255,255,255,0.78)',
              border: `1.5px solid ${color}`,
              boxShadow: `0 0 8px 2px ${glow}, 0 0 0 1px rgba(255,255,255,0.55)`,
            }}
            initial={isNewest ? { scale: 0.2, opacity: 0 } : { scale: 1, opacity: 0.92 }}
            animate={
              isNewest
                ? { scale: [0.2, 1.35, 1], opacity: [0, 1, 0.92] }
                : { scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }
            }
            transition={
              isNewest
                ? { duration: 0.55, ease: 'easeOut' }
                : { duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }
            }
          />
        );
      })}
    </div>
  );
}

/** Renders only completed mission dots — empty slots stay hidden. */
export function ChakraMissionDots({
  filled = 0,
  color,
  core,
  glow,
  size = 56,
  animateNewest = false,
  isToday = false,
  className = '',
}) {
  const c = size / 2;
  const orbit = size * 0.42;
  const count = Math.min(3, Math.max(0, filled));

  if (count <= 0) return null;

  return (
    <div
      className={['pointer-events-none absolute inset-0', isToday ? 'z-[5]' : 'z-[4]', className]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      {CHAKRA_MISSION_DOT_ANGLES.slice(0, count).map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const x = c + Math.cos(rad) * orbit;
        const y = c + Math.sin(rad) * orbit;
        const isNewest = animateNewest && i === count - 1;
        const dotSize = isToday ? size * 0.17 : size * 0.13;
        const dotOffset = dotSize / 2;
        return (
          <span key={deg} className="absolute" style={{ left: x, top: y, marginLeft: -dotOffset, marginTop: -dotOffset }}>
            {isToday ? (
              <motion.span
                className="absolute rounded-full"
                style={{
                  left: '50%',
                  top: '50%',
                  width: dotSize * 2,
                  height: dotSize * 2,
                  marginLeft: -(dotSize * 2) / 2,
                  marginTop: -(dotSize * 2) / 2,
                  background: color,
                  filter: 'blur(6px)',
                }}
                animate={{ opacity: [0.45, 1, 0.45], scale: [0.85, 1.45, 0.85] }}
                transition={{ duration: 1.35, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
                aria-hidden="true"
              />
            ) : null}
            <motion.span
              className={['absolute rounded-full', isToday ? 'border-2 border-white' : 'border border-white/80'].join(' ')}
              style={{
                left: '50%',
                top: '50%',
                width: dotSize,
                height: dotSize,
                marginLeft: -dotOffset,
                marginTop: -dotOffset,
                background: isToday
                  ? `radial-gradient(circle at 30% 30%, #fff, ${color})`
                  : `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.92), ${color}cc)`,
                boxShadow: isToday
                  ? `0 0 16px 5px ${glow}, 0 0 32px 12px ${color}, 0 0 0 1px rgba(255,255,255,0.8)`
                  : `0 0 3px 1px ${glow}`,
              }}
              initial={isNewest ? { scale: 0.4, opacity: 0 } : { scale: 1, opacity: isToday ? 1 : 0.72 }}
              animate={
                isToday
                  ? isNewest
                    ? { scale: [0.4, 1.4, 1], opacity: [0.4, 1, 1] }
                    : { scale: [1, 1.28, 1], opacity: [1, 0.88, 1] }
                  : { scale: 1, opacity: 0.72 }
              }
              transition={
                isToday
                  ? isNewest
                    ? { duration: 0.7, ease: 'easeOut' }
                    : { duration: 1.35, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }
                  : { duration: 0.2 }
              }
              title={core}
            />
          </span>
        );
      })}
    </div>
  );
}

function MissionDotRow({ filled, extra = 0, color, glow, isToday = false }) {
  const count = Math.min(3, Math.max(0, filled));
  const extraCount = isToday ? Math.min(6, Math.max(0, extra)) : 0;
  if (count <= 0 && extraCount <= 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <motion.span
          key={`m-${i}`}
          className="relative h-1.5 w-1.5 rounded-full"
          style={{
            background: isToday ? color : `${color}cc`,
            boxShadow: isToday ? `0 0 10px 3px ${glow}, 0 0 20px 8px ${color}88` : 'none',
            opacity: isToday ? 1 : 0.72,
          }}
          animate={
            isToday ? { opacity: [1, 0.6, 1], scale: [1, 1.4, 1] } : { opacity: 0.72, scale: 1 }
          }
          transition={
            isToday
              ? { duration: 1.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }
              : { duration: 0.2 }
          }
        />
      ))}
      {Array.from({ length: extraCount }).map((_, i) => (
        <motion.span
          key={`e-${i}`}
          className="h-1.5 w-1.5 rounded-full bg-white/80"
          style={{
            border: `1px solid ${color}`,
            boxShadow: `0 0 6px 1px ${glow}`,
          }}
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 }}
        />
      ))}
    </div>
  );
}

function chakraCircleStyle({ entry, allActivated, isToday, activated, completed }) {
  if (allActivated) {
    return {
      borderColor: '#fff',
      boxShadow: `0 0 0 3px ${entry.color}99, 0 0 28px 12px ${entry.glow}, 0 0 52px 18px ${entry.color}66`,
      filter: 'saturate(1.45) brightness(1.18)',
    };
  }
  if (isToday) {
    return {
      borderColor: '#fff',
      boxShadow: activated
        ? `0 0 0 3px ${entry.color}66, 0 0 26px 11px ${entry.glow}, 0 0 50px 18px ${entry.color}55`
        : completed > 0
          ? `0 0 0 3px ${entry.color}55, 0 0 22px 9px ${entry.glow}, 0 0 42px 14px ${entry.color}44`
          : `0 0 0 2px ${entry.color}44, 0 0 18px 7px ${entry.glow}, 0 0 34px 12px ${entry.color}33`,
      filter: 'saturate(1.4) brightness(1.14)',
    };
  }
  if (activated) {
    return {
      borderColor: entry.color,
      boxShadow: `0 0 12px 4px ${entry.glow}`,
      filter: 'saturate(1.2) brightness(1.04)',
    };
  }
  return {
    borderColor: entry.color,
    boxShadow: completed > 0 ? `0 0 10px 3px ${entry.glow}` : `0 0 10px 3px ${entry.glow}`,
    filter: 'saturate(1.15) brightness(1.02)',
  };
}

function ChakraNode({ entry, hill, index, highlightHillCode, allActivated = false, onSelectHill }) {
  const activated = Boolean(hill?.activated);
  const completed = missionCountForHill(hill);
  const extra = Math.max(0, hill?.extraCompleted ?? 0);
  const needed = Math.max(0, 3 - completed);
  const isToday = Boolean(hill?.isToday);
  const isHighlight = highlightHillCode === entry.hillCode;
  const domain = formatHillTitle({ code: entry.hillCode, name: hill?.hillName });
  const Icon = HILL_LUCIDE[entry.hillCode];
  const circleStyle = chakraCircleStyle({ entry, allActivated, isToday, activated, completed });
  const interactive = Boolean(onSelectHill);

  const nodeBody = (
    <div className="relative flex h-20 w-20 items-center justify-center overflow-visible">
        {allActivated ? (
          <div
            className="pointer-events-none absolute inset-[-22%] rounded-full"
            style={{
              background: `radial-gradient(circle, ${entry.color}66 0%, ${entry.glow} 38%, transparent 72%)`,
              filter: 'blur(2px)',
            }}
          />
        ) : null}
        <div
          className="relative flex h-11 w-11 items-center justify-center rounded-full border-[2.5px]"
          style={{
            borderColor: circleStyle.borderColor,
            background: `radial-gradient(circle at 35% 28%, ${entry.color}, ${entry.core} 72%, #05010a 100%)`,
            boxShadow: circleStyle.boxShadow,
            filter: circleStyle.filter,
          }}
        >
          {Icon ? (
            <Icon className="h-5 w-5 text-white" strokeWidth={2.2} aria-hidden="true" />
          ) : null}
        </div>
        <ChakraMissionDots
          filled={completed}
          color={entry.color}
          core={entry.core}
          glow={entry.glow}
          size={80}
          isToday={isToday}
          animateNewest={isHighlight && completed > 0 && extra === 0}
        />
        <ChakraExtraDots
          filled={extra}
          color={entry.color}
          glow={entry.glow}
          size={80}
          glowing={extra > 0}
          animateNewest={isHighlight && extra > 0}
        />
        {activated ? (
          <span
            className="absolute -right-0.5 -top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full border border-white text-white"
            style={{ backgroundColor: entry.core, boxShadow: `0 0 10px ${entry.glow}` }}
          >
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        ) : null}
      </div>
  );

  return (
    <motion.div
      className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${CHAKRA_SPINE_X}%`, top: `${CHAKRA_SPINE_Y[index]}%` }}
      initial={{ opacity: 0.85, scale: 0.85 }}
      animate={{
        opacity: 1,
        scale: isHighlight ? [1, 1.14, 1] : allActivated ? [1, 1.1, 1] : 1,
      }}
      transition={{
        delay: allActivated ? 0.12 * index : 0.04 * index,
        type: 'spring',
        stiffness: 280,
        damping: 20,
        ...(isHighlight
          ? { repeat: 2, duration: 0.55 }
          : allActivated
            ? { repeat: Infinity, duration: 1.8, delay: 0.12 * index }
            : {}),
      }}
    >
      {interactive ? (
        <button
          type="button"
          onClick={() => onSelectHill(entry.hillCode)}
          className="rounded-full transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          title={
            activated
              ? `${domain} activated (3/3) — view hill`
              : `${domain}: ${completed}/3 done · tap for details`
          }
          aria-label={`${domain}, ${completed} of 3 missions`}
        >
          {nodeBody}
        </button>
      ) : (
        <div
          title={
            activated
              ? `${domain} activated (3/3)`
              : `${domain}: ${completed}/3 done · ${needed} more to activate`
          }
        >
          {nodeBody}
        </div>
      )}
    </motion.div>
  );
}

function HillLabel({ entry, hill, index, onSelectHill }) {
  const completed = missionCountForHill(hill);
  const extra = Math.max(0, hill?.extraCompleted ?? 0);
  const activated = Boolean(hill?.activated);
  const isToday = Boolean(hill?.isToday);
  const domainName =
    HILL_DOMAINS[entry.hillCode]?.domain ??
    formatHillTitle({ code: entry.hillCode, name: hill?.hillName });
  const hillName = HILL_DOMAINS[entry.hillCode]?.hill ?? entry.hillCode;
  const virtue = HILL_VIRTUE[entry.hillCode] ?? '';
  const order = HILL_ROOT_ORDER[entry.hillCode] ?? index + 1;
  const onRight = order % 2 === 1;
  const y = CHAKRA_SPINE_Y[index];
  const interactive = Boolean(onSelectHill);

  const labelCard = (
    <div
      className={[
        'shrink-0 rounded-xl border px-2.5 py-1.5 backdrop-blur-md',
        onRight ? 'text-left' : 'text-right',
        interactive ? 'transition hover:brightness-110' : '',
      ].join(' ')}
      style={{
        borderColor: isToday ? '#fff' : `${entry.color}88`,
        background: activated
          ? `linear-gradient(135deg, ${entry.core}dd, rgba(8, 0, 18, 0.88))`
          : 'rgba(8, 0, 18, 0.78)',
        boxShadow:
          isToday || activated
            ? `0 0 16px ${entry.glow}, inset 0 0 8px ${entry.color}22`
            : `0 0 8px ${entry.color}33`,
        maxWidth: '9.75rem',
      }}
    >
      <p
        className="text-[11px] font-bold uppercase leading-tight tracking-wide"
        style={{ color: isToday || activated ? '#fff' : entry.color }}
      >
        {order} {hillName}
        {isToday ? (
          <span className="ml-1 inline-block rounded bg-white/20 px-1 py-px text-[7px] font-bold normal-case text-white">
            Today
          </span>
        ) : null}
      </p>
      <p className="mt-0.5 text-[10px] leading-snug text-white/90">
        {domainName}
        {virtue ? ` · ${virtue}` : ''}
      </p>
      {isToday || completed > 0 || extra > 0 ? (
        <p className="mt-0.5 text-[9px] font-semibold tabular-nums text-white/75">
          {completed}/3{isToday ? ' today' : ''}
          {extra > 0 ? ` · +${extra}` : ''}
        </p>
      ) : null}
      {isToday ? (
        <div className={onRight ? 'mt-0.5' : 'mt-0.5 flex justify-end'}>
          <MissionDotRow
            filled={completed}
            extra={extra}
            color={entry.color}
            glow={entry.glow}
            isToday={isToday}
          />
        </div>
      ) : null}
    </div>
  );

  const connector = (
    <div
      className="h-[2px] min-w-[8px] flex-1"
      style={{
        background: onRight
          ? `linear-gradient(270deg, ${entry.color}, transparent)`
          : `linear-gradient(90deg, ${entry.color}, transparent)`,
        boxShadow: `0 0 6px ${entry.glow}`,
        opacity: 0.9,
      }}
      aria-hidden="true"
    />
  );

  const labelRow = (
    <div className="flex w-full min-w-0 items-center">
      {!onRight ? (
        <>
          {labelCard}
          {connector}
        </>
      ) : (
        <>
          {connector}
          {labelCard}
        </>
      )}
    </div>
  );

  return (
    <motion.div
      className="absolute z-20"
      style={{
        top: `${y}%`,
        transform: 'translateY(-50%)',
        ...(onRight
          ? {
              left: `${CHAKRA_SPINE_X}%`,
              width: `${100 - CHAKRA_SPINE_X - 1.5}%`,
              paddingLeft: '2.5%',
            }
          : {
              left: `${LABEL_X}%`,
              width: `${CHAKRA_SPINE_X - LABEL_X - 3}%`,
            }),
      }}
      initial={{ opacity: 0, x: onRight ? 8 : -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.35 }}
    >
      {interactive ? (
        <button
          type="button"
          onClick={() => onSelectHill(entry.hillCode)}
          className="block w-full min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-xl"
          aria-label={`${hillName} hill, ${completed} of 3 missions`}
        >
          {labelRow}
        </button>
      ) : (
        labelRow
      )}
    </motion.div>
  );
}

export function areAllChakrasActivated(weeklyChakras = []) {
  const byCode = chakraHillsByCode(weeklyChakras);
  return JOURNEY_CHAKRA_SPINE.every((entry) => Boolean(byCode.get(entry.hillCode)?.activated));
}

function chakraHillsByCode(weeklyChakras = []) {
  const byCode = new Map();
  for (const hill of weeklyChakras ?? []) {
    if (!hill?.hillCode) continue;
    const existing = byCode.get(hill.hillCode);
    if (!existing) {
      byCode.set(hill.hillCode, hill);
      continue;
    }
    if (hill.isToday && !existing.isToday) {
      byCode.set(hill.hillCode, hill);
      continue;
    }
    if (existing.isToday && !hill.isToday) continue;
    const existingScore =
      (existing.activated ? 3 : 0) + (existing.prescribedCompleted ?? existing.pulses ?? 0);
    const nextScore = (hill.activated ? 3 : 0) + (hill.prescribedCompleted ?? hill.pulses ?? 0);
    if (nextScore > existingScore) byCode.set(hill.hillCode, hill);
  }
  return byCode;
}

export function JourneyChakraTree({
  weeklyChakras = [],
  highlightHillCode = null,
  allActivated = false,
  treeLevel = 1,
  onSelectHill = null,
  compact = false,
}) {
  const byCode = chakraHillsByCode(weeklyChakras);
  const stageBg = getTreeStageBackground(treeLevel);
  const level = normalizeTreeLevel(treeLevel);

  return (
    <section
      className={[
        'overflow-hidden rounded-3xl border bg-[#05010a]',
        allActivated
          ? 'border-amber-300/50 shadow-[0_0_48px_rgba(245,208,106,0.4)]'
          : 'border-fuchsia-400/25 shadow-[0_0_40px_rgba(120,20,180,0.35)]',
      ].join(' ')}
    >
      <div
        className={[
          'relative w-full overflow-visible',
          compact ? 'min-h-[620px]' : '',
        ].join(' ')}
      >
        <img
          key={stageBg}
          src={stageBg}
          alt={`Tree of Life stage ${level}`}
          className={[
            'block h-auto w-full',
            allActivated ? 'saturate-[1.35] brightness-[1.08]' : '',
          ].join(' ')}
        />

        {allActivated ? (
          <>
            <motion.div
              className="pointer-events-none absolute z-[6] w-1.5 -translate-x-1/2 rounded-full"
              style={{
                left: `${CHAKRA_SPINE_X}%`,
                top: '13%',
                height: '72%',
                background: 'linear-gradient(to bottom, #FDE68A, #fff, #FDE68A)',
                boxShadow: '0 0 18px 6px rgba(253, 224, 71, 0.75), 0 0 32px 10px rgba(255,255,255,0.35)',
                transformOrigin: 'top center',
              }}
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: [0.7, 1, 0.7], scaleY: 1 }}
              transition={{ duration: 1.6, ease: 'easeOut', opacity: { duration: 2.2, repeat: Infinity } }}
              aria-hidden="true"
            />
            <motion.div
              className="pointer-events-none absolute inset-0 z-[4]"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                background:
                  'radial-gradient(circle at 48% 42%, rgba(253, 224, 71, 0.28), transparent 58%)',
              }}
              aria-hidden="true"
            />
          </>
        ) : null}

        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-[34%]"
          style={{
            background:
              'linear-gradient(90deg, rgba(5,1,12,0.5) 0%, rgba(5,1,12,0.12) 70%, transparent 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-[34%]"
          style={{
            background:
              'linear-gradient(270deg, rgba(5,1,12,0.45) 0%, rgba(5,1,12,0.1) 70%, transparent 100%)',
          }}
        />

        {SPARKLES.map((spark, i) => (
          <motion.span
            key={`spark-${i}`}
            className="pointer-events-none absolute rounded-full bg-white"
            style={{
              left: spark.left,
              top: spark.top,
              width: allActivated ? spark.size + 1 : spark.size,
              height: allActivated ? spark.size + 1 : spark.size,
              boxShadow: allActivated
                ? '0 0 12px 4px rgba(253, 224, 71, 0.85)'
                : '0 0 8px 2px rgba(255,255,255,0.7)',
            }}
            animate={{ opacity: [0.2, 0.95, 0.2], scale: [0.7, 1.35, 0.7] }}
            transition={{ duration: allActivated ? 1.8 : 2.6, repeat: Infinity, delay: spark.delay, ease: 'easeInOut' }}
          />
        ))}

        {JOURNEY_CHAKRA_SPINE.map((entry, index) => (
          <HillLabel
            key={`label-${entry.hillCode}`}
            entry={entry}
            hill={byCode.get(entry.hillCode)}
            index={index}
            onSelectHill={onSelectHill}
          />
        ))}

        {JOURNEY_CHAKRA_SPINE.map((entry, index) => (
          <ChakraNode
            key={entry.hillCode}
            entry={entry}
            hill={byCode.get(entry.hillCode)}
            index={index}
            highlightHillCode={highlightHillCode}
            allActivated={allActivated}
            onSelectHill={onSelectHill}
          />
        ))}
      </div>
    </section>
  );
}
