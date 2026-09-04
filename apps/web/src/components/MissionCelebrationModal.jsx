import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Coins, Sparkles, Sprout } from 'lucide-react';
import { formatHillTitle, HILL_DOMAINS } from '../lib/hills';
import { HILL_LUCIDE } from '../lib/hillIcons';
import {
  CHAKRA_MISSION_DOT_ANGLES,
  CHAKRA_SPINE_X,
  CHAKRA_SPINE_Y,
  ChakraExtraDots,
  JOURNEY_CHAKRA_SPINE,
} from './JourneyChakraTree';

const ENCOURAGEMENT = [
  'You showed up and followed through — that kind of consistency changes lives.',
  'Beautiful work. Every small act of care builds stronger connections.',
  'Well done! Growth happens in these quiet, everyday choices.',
  'You did it. Keep leaning into moments that matter.',
  'That took intention. Be proud — you are building real habits.',
];

function pickMessage() {
  return ENCOURAGEMENT[Math.floor(Math.random() * ENCOURAGEMENT.length)];
}


function AnimatedMissionDots({ filled, color, glow, size = 72, play = true }) {
  const c = size / 2;
  const orbit = size * 0.44;
  const count = Math.min(3, Math.max(0, filled));
  const [visibleCount, setVisibleCount] = useState(play ? Math.max(0, count - 1) : count);

  useEffect(() => {
    if (!play) {
      setVisibleCount(count);
      return undefined;
    }
    const prior = Math.max(0, count - 1);
    setVisibleCount(prior);
    if (count <= prior) return undefined;
    const t = setTimeout(() => setVisibleCount(count), 380);
    return () => clearTimeout(t);
  }, [count, play]);

  if (count <= 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <AnimatePresence>
        {CHAKRA_MISSION_DOT_ANGLES.slice(0, visibleCount).map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const x = c + Math.cos(rad) * orbit;
          const y = c + Math.sin(rad) * orbit;
          const isNewest = i === visibleCount - 1 && visibleCount === count;
          return (
            <motion.span
              key={`${deg}-${i}`}
              className="absolute rounded-full border-2 border-white"
              style={{
                left: x,
                top: y,
                width: size * 0.16,
                height: size * 0.16,
                marginLeft: -(size * 0.08),
                marginTop: -(size * 0.08),
                background: `radial-gradient(circle at 30% 30%, #fff, ${color})`,
                boxShadow: `0 0 14px 4px ${glow}`,
              }}
              initial={
                isNewest
                  ? { scale: 0, opacity: 0, x: -28, y: 18 }
                  : { scale: 1, opacity: 1, x: 0, y: 0 }
              }
              animate={
                isNewest
                  ? {
                      scale: [0, 1.55, 1],
                      opacity: [0, 1, 1],
                      x: [ -28, 0, 0],
                      y: [18, -6, 0],
                    }
                  : { scale: [1, 1.22, 1], opacity: [1, 0.65, 1], x: 0, y: 0 }
              }
              transition={
                isNewest
                  ? { duration: 0.85, ease: [0.22, 1.2, 0.36, 1] }
                  : { duration: 1.35, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }
              }
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function CelebrationTreeScene({ hillCode, hillName, slotsFilled, extraFilled = 0, activated }) {
  const filled = Math.min(3, Math.max(0, slotsFilled));
  const extras = Math.min(6, Math.max(0, extraFilled));
  const activeEntry =
    JOURNEY_CHAKRA_SPINE.find((h) => h.hillCode === hillCode) ?? JOURNEY_CHAKRA_SPINE[6];
  const domain = formatHillTitle({ code: hillCode, name: hillName });
  const hillLabel = HILL_DOMAINS[hillCode]?.hill ?? hillCode;
  const Icon = HILL_LUCIDE[hillCode];

  return (
    <div className="mx-auto mt-1 w-full">
      <div className="relative w-full overflow-hidden rounded-2xl border border-fuchsia-400/30 bg-[#05010a] shadow-[0_0_28px_rgba(168,85,247,0.35)]">
        {/* Tall frame so the full canopy halo + roots stay visible */}
        <div className="relative w-full">
          <img
            src="/images/tree-of-life-bg.png?v=cosmic2"
            alt=""
            className="block h-auto w-full"
          />

          {/* Soft sparkles */}
          {[
            { left: '22%', top: '18%', d: 0.1 },
            { left: '78%', top: '14%', d: 0.5 },
            { left: '86%', top: '48%', d: 0.9 },
            { left: '16%', top: '62%', d: 0.3 },
            { left: '70%', top: '72%', d: 1.1 },
          ].map((s, i) => (
            <motion.span
              key={i}
              className="pointer-events-none absolute rounded-full bg-white"
              style={{
                left: s.left,
                top: s.top,
                width: 3,
                height: 3,
                boxShadow: '0 0 8px 2px rgba(255,255,255,0.85)',
              }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.4, 0.7] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: s.d, ease: 'easeInOut' }}
            />
          ))}

          {JOURNEY_CHAKRA_SPINE.map((entry, index) => {
            const isActive = entry.hillCode === hillCode;
            const NodeIcon = HILL_LUCIDE[entry.hillCode];
            return (
              <motion.div
                key={entry.hillCode}
                className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={{ left: `${CHAKRA_SPINE_X}%`, top: `${CHAKRA_SPINE_Y[index]}%` }}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{
                  opacity: isActive ? 1 : 0.55,
                  scale: isActive ? 1.08 : 1,
                }}
                transition={{ delay: 0.05 * index, duration: 0.45 }}
              >
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <div
                    className="flex items-center justify-center rounded-full border-2"
                    style={{
                      width: isActive ? 44 : 28,
                      height: isActive ? 44 : 28,
                      borderColor: entry.color,
                      background: `radial-gradient(circle at 35% 28%, ${entry.color}, ${entry.core} 70%, #05010a)`,
                      boxShadow: isActive
                        ? activated
                          ? `0 0 0 3px ${entry.color}66, 0 0 28px 10px ${entry.glow}`
                          : `0 0 18px 6px ${entry.glow}`
                        : `0 0 8px 2px ${entry.glow}`,
                      filter: isActive
                        ? 'saturate(1.25) brightness(1.1)'
                        : 'saturate(0.75) brightness(0.85)',
                    }}
                  >
                    {NodeIcon ? (
                      <NodeIcon
                        className={isActive ? 'h-5 w-5 text-white' : 'h-3 w-3 text-white/90'}
                        strokeWidth={2.2}
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                  {isActive ? (
                    <>
                      <AnimatedMissionDots
                        filled={filled}
                        color={entry.color}
                        glow={entry.glow}
                        size={56}
                        play={extras === 0}
                      />
                      <ChakraExtraDots
                        filled={extras}
                        color={entry.color}
                        glow={entry.glow}
                        size={72}
                        glowing
                        animateNewest
                      />
                    </>
                  ) : null}
                  {isActive && activated ? (
                    <motion.span
                      className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white text-white"
                      style={{ backgroundColor: entry.core, boxShadow: `0 0 10px ${entry.glow}` }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.9 }}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </motion.span>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Caption below the tree — does not cover canopy or roots */}
      <motion.div
        className="mt-2 rounded-xl border px-3 py-2"
        style={{
          borderColor: `${activeEntry.color}99`,
          background: 'rgba(5, 1, 12, 0.88)',
          boxShadow: `0 0 16px ${activeEntry.glow}`,
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2">
          {Icon ? (
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${activeEntry.color}, ${activeEntry.core})`,
                boxShadow: `0 0 10px ${activeEntry.glow}`,
              }}
            >
              <Icon className="h-4 w-4 text-white" strokeWidth={2.2} />
            </span>
          ) : null}
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-bold uppercase tracking-wide text-white">
              {hillLabel} · {domain}
            </p>
            <p className="text-[11px] font-semibold tabular-nums text-white/85">
              {activated
                ? extras > 0
                  ? `Chakra activated · 3/3 + ${extras} extra`
                  : 'Chakra activated · 3/3'
                : `Lighting mission ${filled} of 3…`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-2 w-2 rounded-full"
                style={{
                  background: i < filled ? activeEntry.color : 'rgba(255,255,255,0.2)',
                  boxShadow: i < filled ? `0 0 8px ${activeEntry.glow}` : 'none',
                }}
                initial={i === filled - 1 ? { scale: 0 } : false}
                animate={
                  i < filled
                    ? { scale: [1, 1.35, 1], opacity: [1, 0.7, 1] }
                    : { scale: 1, opacity: 0.35 }
                }
                transition={
                  i === filled - 1
                    ? { delay: 0.45, duration: 0.55 }
                    : i < filled
                      ? { duration: 1.2, repeat: Infinity, delay: i * 0.1 }
                      : { duration: 0.2 }
                }
              />
            ))}
            {Array.from({ length: extras }).map((_, i) => (
              <motion.span
                key={`extra-${i}`}
                className="h-2 w-2 rounded-full bg-white/85"
                style={{
                  border: `1px solid ${activeEntry.color}`,
                  boxShadow: `0 0 6px ${activeEntry.glow}`,
                }}
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ delay: 0.2 + i * 0.08, duration: 1.4, repeat: Infinity }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function MissionCelebrationModal({
  open,
  missionTitle,
  coinReward,
  dailyBonusAwarded = 0,
  dailySeedsAwarded = 0,
  perfectWeekBonusAwarded = 0,
  perfectWeekSeedsAwarded = 0,
  lateCatchUp = false,
  starterWeekJustCompleted = false,
  isPrescribed = true,
  showChakra = false,
  chakraHillCode = null,
  chakraHillName = null,
  chakraSlotsFilled = 0,
  extraCompleted = 0,
  chakraActivated = false,
  onConfirm,
}) {
  const [message, setMessage] = useState(ENCOURAGEMENT[0]);
  const justDailyBonus = dailyBonusAwarded > 0;
  const dailyFlowComplete = justDailyBonus || chakraActivated;
  const perfectWeekComplete = perfectWeekBonusAwarded > 0 || perfectWeekSeedsAwarded > 0;
  const missionCoins =
    coinReward != null
      ? Math.max(0, coinReward - dailyBonusAwarded - perfectWeekBonusAwarded)
      : null;
  const useTree = showChakra && chakraHillCode;

  useEffect(() => {
    if (open) {
      setMessage(pickMessage());
    }
  }, [open]);

  if (!open) return null;

  const title = starterWeekJustCompleted
    ? 'Starter FLOW Week!'
    : perfectWeekComplete
      ? '🌈 PERFECT FLOW WEEK'
      : justDailyBonus
        ? 'Daily FLOW complete!'
        : lateCatchUp
          ? 'Late catch-up'
          : extraCompleted > 0
            ? 'Extra mission lit!'
            : useTree && chakraSlotsFilled > 0
            ? 'Chakra waking up!'
            : 'Nice work!';

  const subtitle = starterWeekJustCompleted
    ? 'You finished every assigned starter day on time. Next week begins the full seven-hill cycle.'
    : perfectWeekComplete
      ? 'Seven days of on-time FLOW — +1,500 GoFam Coins and +3 Glow Seeds toward your challenge!'
      : justDailyBonus
        ? 'All 3 Home Hill missions done — your chakra glows and you earned the daily bonus!'
        : lateCatchUp
          ? 'This mission earns +10 coins only. No Home Hill bonus, Step, or Glow Seed.'
          : extraCompleted > 0
            ? 'Extra mission — small light-glow dots on the chakra (not one of the 3 daily slots).'
            : useTree && chakraSlotsFilled > 0
            ? `Watch the Tree of Life — mission ${chakraSlotsFilled} of 3 just lit. Complete ${3 - chakraSlotsFilled} more to activate this chakra.`
            : message;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-celebration-title"
    >
      <div className="max-h-[92vh] w-full max-w-app overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div
          className={[
            'px-4 pb-2 pt-4 text-center sm:px-6 sm:pt-5',
            useTree
              ? 'bg-[#05010a]'
              : perfectWeekComplete
                ? 'bg-gradient-to-br from-amber-100 via-white to-emerald-50'
                : dailyFlowComplete
                  ? 'bg-gradient-to-br from-emerald-100 via-white to-violet-50'
                  : 'bg-gradient-to-br from-emerald-50 via-white to-violet-50',
          ].join(' ')}
        >
          {useTree ? (
            <CelebrationTreeScene
              hillCode={chakraHillCode}
              hillName={chakraHillName}
              slotsFilled={chakraSlotsFilled}
              extraFilled={extraCompleted}
              activated={dailyFlowComplete || chakraActivated}
            />
          ) : (
            <div
              className={[
                'mx-auto mt-3 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg',
                perfectWeekComplete
                  ? 'bg-amber-500 shadow-amber-200'
                  : dailyFlowComplete
                    ? 'bg-emerald-600 shadow-emerald-300'
                    : 'bg-emerald-500 shadow-emerald-200',
              ].join(' ')}
            >
              <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden="true" />
            </div>
          )}

          <h2
            id="mission-celebration-title"
            className={[
              'mt-4 font-display text-2xl font-semibold',
              useTree ? 'text-white' : 'text-violet-950',
            ].join(' ')}
          >
            {title}
          </h2>

          {missionTitle ? (
            <p
              className={[
                'mt-1 text-sm font-medium',
                useTree ? 'text-fuchsia-100/90' : 'text-violet-700',
              ].join(' ')}
            >
              {missionTitle}
            </p>
          ) : null}
        </div>

        <div className="px-6 pb-6 pt-4 text-center">
          <p className="text-sm leading-relaxed text-violet-800/90">{subtitle}</p>

          {coinReward != null ? (
            <div className="mt-4 space-y-2">
              {dailyFlowComplete && missionCoins != null ? (
                <div className="space-y-1.5 text-sm">
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-1.5 font-semibold text-amber-800">
                    <Coins className="h-4 w-4" aria-hidden="true" />
                    +{missionCoins} mission
                  </p>
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-4 py-1.5 font-semibold text-emerald-800">
                    <Coins className="h-4 w-4" aria-hidden="true" />
                    +{dailyBonusAwarded} daily bonus
                  </p>
                  {perfectWeekBonusAwarded > 0 ? (
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-4 py-1.5 font-semibold text-amber-900">
                      <Coins className="h-4 w-4" aria-hidden="true" />
                      +{perfectWeekBonusAwarded} perfect week bonus
                    </p>
                  ) : null}
                  {dailySeedsAwarded > 0 ? (
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-lime-100 px-4 py-1.5 font-semibold text-lime-900">
                      <Sprout className="h-4 w-4" aria-hidden="true" />
                      +{dailySeedsAwarded} Glow Seed
                    </p>
                  ) : null}
                  {perfectWeekSeedsAwarded > 0 ? (
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-lime-100 px-4 py-1.5 font-semibold text-lime-900">
                      <Sprout className="h-4 w-4" aria-hidden="true" />
                      +{perfectWeekSeedsAwarded} Glow Seeds (perfect week)
                    </p>
                  ) : null}
                  <p className="text-xs font-semibold text-violet-600">
                    {coinReward} coins total from this mission
                  </p>
                </div>
              ) : (
                <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                  <Coins className="h-4 w-4" aria-hidden="true" />
                  +{coinReward} coins earned
                  {!isPrescribed ? (
                    <span className="font-normal text-amber-700/80"> (extra mission)</span>
                  ) : null}
                </p>
              )}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onConfirm}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Keep going
          </button>
        </div>
      </div>
    </div>
  );
}
