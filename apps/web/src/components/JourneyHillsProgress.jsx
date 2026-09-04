import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { HILL_ICONS } from '../lib/gapRating';
import { HILL_RING_COLORS } from '../lib/hillRingColors';
import {
  appClimbDisplayMax,
  isAppUpgradedTo49,
  HILL_CHALLENGE_TASKS,
  STEPS_PER_HILL,
} from '../lib/hillProgress';
import { formatHillTitle } from '../lib/hills';

const STONE_VIEW_W = 120;
const STONE_VIEW_H = 132;
const STONE_ROWS_3 = [2, 1];
const STONE_ROWS_49 = [10, 9, 8, 7, 6, 5, 4];

function buildStoneLayout(rowsFromBase, { rx = 5.35, ry = 4.05 } = {}) {
  const stones = [];
  const rows = rowsFromBase.length;
  const rowH = (STONE_VIEW_H - 14) / rows;
  let i = 0;

  rowsFromBase.forEach((count, rowFromBase) => {
    const cy = STONE_VIEW_H - 8 - rowFromBase * rowH - ry;
    const gap = rx * 2.18;
    const span = Math.max(0, count - 1) * gap;
    const startX = (STONE_VIEW_W - span) / 2;
    for (let col = 0; col < count; col += 1) {
      stones.push({
        i,
        cx: startX + col * gap + ((col % 2) - 0.5) * 0.35,
        cy: cy + (col % 2) * 0.45,
        rx,
        ry,
      });
      i += 1;
    }
  });

  return stones;
}

const STONE_LAYOUT_3 = buildStoneLayout(STONE_ROWS_3, { rx: 16, ry: 12 });
const STONE_LAYOUT_49 = buildStoneLayout(STONE_ROWS_49);

function Stone({ stone, filled, newest, color, glowId }) {
  const { cx, cy, rx, ry } = stone;

  return (
    <g filter={newest ? `url(#${glowId})` : undefined}>
      {newest ? (
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx + 2.4}
          ry={ry + 2}
          fill="none"
          stroke="#fff"
          strokeWidth="1.6"
          opacity="0.9"
        />
      ) : null}
      <ellipse
        cx={cx}
        cy={cy + 0.55}
        rx={rx}
        ry={ry}
        fill={filled ? color : `${color}22`}
        stroke={filled ? '#fff' : color}
        strokeWidth={filled ? 1.15 : 1.4}
        opacity={filled ? 1 : 0.85}
      />
      {filled ? (
        <ellipse
          cx={cx - rx * 0.28}
          cy={cy - ry * 0.32}
          rx={rx * 0.4}
          ry={ry * 0.32}
          fill="#fff"
          opacity="0.55"
        />
      ) : null}
    </g>
  );
}

function StoneMountain({ filled = 0, color, climbMax = STEPS_PER_HILL }) {
  const cap = climbMax >= STEPS_PER_HILL ? STEPS_PER_HILL : HILL_CHALLENGE_TASKS;
  const layout = cap >= STEPS_PER_HILL ? STONE_LAYOUT_49 : STONE_LAYOUT_3;
  const safeFilled = Math.max(0, Math.min(cap, filled));
  const newestIndex = safeFilled > 0 ? safeFilled - 1 : -1;
  const glowId = `glow-${color.replace('#', '')}-${cap}`;

  return (
    <svg
      viewBox={`0 0 ${STONE_VIEW_W} ${STONE_VIEW_H}`}
      className="h-full w-full overflow-visible"
      role="img"
      aria-label={`${safeFilled} of ${cap} stones`}
    >
      <defs>
        <radialGradient id={`sky-${glowId}`} cx="50%" cy="18%" r="70%">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor="#12061f" stopOpacity="0" />
        </radialGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width={STONE_VIEW_W} height={STONE_VIEW_H} fill={`url(#sky-${glowId})`} />
      <line
        x1="10"
        x2="110"
        y1={STONE_VIEW_H - 3}
        y2={STONE_VIEW_H - 3}
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.7"
      />
      {layout.map((stone) => (
        <Stone
          key={stone.i}
          stone={stone}
          filled={stone.i < safeFilled}
          newest={stone.i === newestIndex}
          color={color}
          glowId={glowId}
        />
      ))}
    </svg>
  );
}

function HillClimbCard({ entry, isFocus, index, climbMax }) {
  const code = entry.hill?.code ?? entry.code;
  const color = entry.hill?.colorTheme || HILL_RING_COLORS[code] || '#7C3AED';
  const steps = entry.completedSteps ?? 0;
  const atSummit = steps >= climbMax;
  const icon = HILL_ICONS[code] ?? '🏔️';
  const title = formatHillTitle(entry.hill ?? entry);

  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 260, damping: 24 }}
      className="flex flex-col items-center rounded-2xl px-2 py-3 text-center"
      style={{
        background: `linear-gradient(180deg, ${color}33 0%, rgba(12, 4, 24, 0.92) 42%)`,
        boxShadow: isFocus
          ? `0 0 0 2px ${color}, 0 0 18px ${color}88`
          : `0 0 0 1px ${color}66, 0 8px 18px rgba(0,0,0,0.35)`,
      }}
    >
      <div className="relative h-36 w-full max-w-[11rem]">
        <StoneMountain filled={steps} color={color} climbMax={climbMax} />
        {atSummit ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
            <Check className="h-3 w-3" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <span className="mt-1 text-lg leading-none" aria-hidden="true">
        {icon}
      </span>
      <p className="mt-1 text-xs font-semibold leading-tight text-white">
        {title}
        {isFocus ? <span className="block font-medium" style={{ color }}>Focus</span> : null}
      </p>
      <p
        className="mt-0.5 text-[11px] font-bold tabular-nums"
        style={{ color: steps > 0 ? '#fff' : `${color}` }}
      >
        {Math.min(steps, climbMax)}/{climbMax}
        {climbMax <= HILL_CHALLENGE_TASKS ? ' tasks' : ''}
      </p>
    </motion.li>
  );
}

export function JourneyHillsProgress({ hillProgress = [], focusHillId }) {
  const rows = useMemo(() => hillProgress ?? [], [hillProgress]);
  const climbMax = appClimbDisplayMax(rows);
  const upgraded = isAppUpgradedTo49(rows);

  if (!rows.length) return null;

  const summitDone = rows.filter((hp) => (hp.completedSteps ?? 0) >= climbMax).length;

  return (
    <section className="mt-4 rounded-2xl border border-fuchsia-400/30 bg-[#0b0418] p-4 shadow-[0_0_28px_rgba(124,58,237,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300">
            7 hills
          </p>
          <p className="mt-1 font-display text-lg font-bold text-white">
            {upgraded
              ? `${summitDone} / 7 · ${STEPS_PER_HILL}-week climb`
              : '3 weeks · 1 task / week'}
          </p>
        </div>
        <span className="text-2xl" aria-hidden="true">
          🏔️
        </span>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-2.5">
        {rows.map((entry, index) => (
          <HillClimbCard
            key={entry.hill?.id ?? entry.hill?.code ?? index}
            entry={entry}
            index={index}
            climbMax={climbMax}
            isFocus={entry.hill?.id === focusHillId || Boolean(entry.hill?.isFocus)}
          />
        ))}
      </ul>
    </section>
  );
}
