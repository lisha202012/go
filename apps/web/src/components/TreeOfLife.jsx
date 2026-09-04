import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Hand, Info, Star } from 'lucide-react';
import { HILL_LUCIDE } from '../lib/hillIcons';
import { getTreeStageBackground, getTreeStage, normalizeTreeLevel } from '../lib/treeStages';

/** Stagger delay between hill badge entrances (Growth Report reveal). */
export const TREE_BADGE_STAGGER_S = 0.15;
export const TREE_BADGE_COUNT = 7;
/** Delay before callouts appear after the last badge finishes animating. */
export const TREE_CALLOUT_DELAY_S =
  0.1 + TREE_BADGE_COUNT * TREE_BADGE_STAGGER_S + 0.35;

/** Percent positions tuned to /images/tree-of-life-bg.png */
const HEART = { x: 50, y: 51.5 };
const BADGE_SIZE = 72;

const HILL_COLORS = {
  HOOK: {
    from: '#C4B5FD',
    to: '#6D28D9',
    glow: 'rgba(124, 58, 237, 0.9)',
    fill: 'radial-gradient(circle at 38% 28%, rgba(196, 181, 253, 0.95) 0%, rgba(139, 92, 246, 0.9) 48%, rgba(91, 33, 182, 0.92) 100%)',
  },
  HOPE: {
    from: '#FDA4AF',
    to: '#DC2626',
    glow: 'rgba(244, 63, 94, 0.85)',
    fill: 'radial-gradient(circle at 38% 28%, rgba(253, 164, 175, 0.95) 0%, rgba(244, 63, 94, 0.9) 48%, rgba(220, 38, 38, 0.92) 100%)',
  },
  HONE: {
    from: '#FDBA74',
    to: '#EA580C',
    glow: 'rgba(249, 115, 22, 0.85)',
    fill: 'radial-gradient(circle at 38% 28%, rgba(253, 186, 116, 0.95) 0%, rgba(249, 115, 22, 0.9) 48%, rgba(234, 88, 12, 0.92) 100%)',
  },
  HOLD: {
    from: '#FDE047',
    to: '#CA8A04',
    glow: 'rgba(234, 179, 8, 0.85)',
    fill: 'radial-gradient(circle at 38% 28%, rgba(253, 224, 71, 0.96) 0%, rgba(234, 179, 8, 0.9) 48%, rgba(202, 138, 4, 0.92) 100%)',
  },
  HOOD: {
    from: '#86EFAC',
    to: '#16A34A',
    glow: 'rgba(34, 197, 94, 0.85)',
    fill: 'radial-gradient(circle at 38% 28%, rgba(134, 239, 172, 0.95) 0%, rgba(34, 197, 94, 0.9) 48%, rgba(22, 163, 74, 0.92) 100%)',
  },
  HOST: {
    from: '#93C5FD',
    to: '#2563EB',
    glow: 'rgba(59, 130, 246, 0.85)',
    fill: 'radial-gradient(circle at 38% 28%, rgba(147, 197, 253, 0.95) 0%, rgba(59, 130, 246, 0.9) 48%, rgba(37, 99, 235, 0.92) 100%)',
  },
  HORN: {
    from: '#A5B4FC',
    to: '#4338CA',
    glow: 'rgba(79, 70, 229, 0.85)',
    fill: 'radial-gradient(circle at 38% 28%, rgba(165, 180, 252, 0.95) 0%, rgba(99, 102, 241, 0.9) 48%, rgba(67, 56, 202, 0.92) 100%)',
  },
};

const HILL_POSITIONS = {
  HOOK: { x: 50, y: 11.5 },
  HORN: { x: 21.5, y: 21.5 },
  HOPE: { x: 78.5, y: 21.5 },
  HOST: { x: 14.5, y: 49.5 },
  HONE: { x: 85.5, y: 49.5 },
  HOOD: { x: 23, y: 76.5 },
  HOLD: { x: 77, y: 76.5 },
};

const HILL_CODES = Object.keys(HILL_POSITIONS);

const badgeContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: TREE_BADGE_STAGGER_S,
      delayChildren: 0.1,
    },
  },
};

const badgeEntranceVariants = {
  hidden: { opacity: 0, scale: 0.35 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 280, damping: 22 },
  },
};

const previewEntranceVariants = {
  hidden: { opacity: 0, scale: 0.2 },
  visible: (custom) => {
    const highlighted = typeof custom === 'object' ? custom.highlighted : custom;
    const staggerDelay = typeof custom === 'object' ? (custom.staggerDelay ?? 0) : 0;
    return {
      opacity: highlighted ? 1 : 0.62,
      scale: highlighted ? 1 : 0.94,
      filter: highlighted ? 'grayscale(0%) saturate(1)' : 'grayscale(0.15) saturate(0.72)',
      transition: {
        type: 'spring',
        stiffness: 260,
        damping: 22,
        delay: staggerDelay,
      },
    };
  },
};

function hillCaption(hill, isFocus) {
  if (isFocus) return 'Focus Hill';
  return hill.status;
}

function connectorEnds(hillX, hillY) {
  const hx = hillX;
  const hy = hillY;
  const cx = HEART.x;
  const cy = HEART.y;
  const dx = cx - hx;
  const dy = cy - hy;
  const dist = Math.hypot(dx, dy) || 1;
  const inset = 5.4;
  return {
    x1: hx + (dx / dist) * inset,
    y1: hy + (dy / dist) * inset,
    x2: cx,
    y2: cy,
  };
}

function sparklePoints(x1, y1, x2, y2, count = 10) {
  const points = [];
  for (let i = 1; i < count; i += 1) {
    const t = i / count;
    const along = 0.12 + t * 0.78;
    points.push({
      x: x1 + (x2 - x1) * along,
      y: y1 + (y2 - y1) * along,
      r: i % 3 === 0 ? 0.42 : i % 2 === 0 ? 0.28 : 0.2,
      opacity: i % 3 === 0 ? 0.95 : 0.55 + (i % 4) * 0.1,
    });
  }
  return points;
}

function ConnectorLines({ hills, ambientMotion = false }) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <filter id="tolBeamBlur" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="0.9" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
          </feMerge>
        </filter>
        <filter id="tolBeamGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.45" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="tolSparkle" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="0.18" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {[
        [46, 44], [54, 42], [50, 38], [43, 48], [57, 47], [48, 52], [52, 50], [45, 40], [55, 44],
      ].map(([x, y], i) => (
        <circle
          key={`ambient-${i}`}
          cx={x}
          cy={y}
          r={i % 3 === 0 ? 0.35 : 0.22}
          fill="#FFFFFF"
          opacity={0.35 + (i % 3) * 0.15}
          filter="url(#tolSparkle)"
        />
      ))}

      {hills.map((hill) => {
        const colors = HILL_COLORS[hill.code] ?? HILL_COLORS.HOOK;
        const { x1, y1, x2, y2 } = connectorEnds(hill.x, hill.y);
        const gradId = `beam-${hill.code}`;
        const sparkles = sparklePoints(x1, y1, x2, y2);

        return (
          <g key={hill.code}>
            <defs>
              <linearGradient
                id={gradId}
                gradientUnits="userSpaceOnUse"
                x1={x2}
                y1={y2}
                x2={x1}
                y2={y1}
              >
                <stop offset="0%" stopColor="#FFFEF7" stopOpacity="1" />
                <stop offset="18%" stopColor="#FEF08A" stopOpacity="0.95" />
                <stop offset="50%" stopColor={colors.from} stopOpacity="0.9" />
                <stop offset="100%" stopColor={colors.to} stopOpacity="0.95" />
              </linearGradient>
            </defs>

            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={`url(#${gradId})`}
              strokeWidth="1.35"
              strokeLinecap="round"
              opacity="0.45"
              filter="url(#tolBeamBlur)"
            />
            {ambientMotion ? (
              <motion.line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={`url(#${gradId})`}
                strokeWidth="0.65"
                strokeLinecap="round"
                filter="url(#tolBeamGlow)"
                animate={{ opacity: [0.55, 0.95, 0.55] }}
                transition={{
                  repeat: Infinity,
                  duration: 2.8,
                  ease: 'easeInOut',
                  delay: (hill.x + hill.y) * 0.012,
                }}
              />
            ) : (
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={`url(#${gradId})`}
                strokeWidth="0.65"
                strokeLinecap="round"
                filter="url(#tolBeamGlow)"
              />
            )}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#FFFEF7"
              strokeWidth="0.12"
              strokeLinecap="round"
              opacity="0.55"
            />

            {sparkles.map((spark, i) => (
              <circle
                key={`${hill.code}-spark-${i}`}
                cx={spark.x}
                cy={spark.y}
                r={spark.r}
                fill="#FFFFFF"
                opacity={spark.opacity}
                filter="url(#tolSparkle)"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

const lockedPreviewState = {
  opacity: 0.62,
  scale: 0.94,
  filter: 'grayscale(0.15) saturate(0.72)',
};

const highlightPulse = {
  scale: [1.06, 1.16, 1.06],
  opacity: 1,
  filter: 'grayscale(0%) saturate(1.1)',
};

const highlightPulseTransition = {
  scale: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' },
  opacity: { duration: 0.25 },
  filter: { duration: 0.25 },
};

function HillBadge({
  hill,
  isFocus,
  onSelect,
  animateEntrance,
  interactive,
  lockedPreview = false,
  isHighlighted = false,
  staggerDelay = 0,
}) {
  const Icon = HILL_LUCIDE[hill.code] ?? HILL_LUCIDE.HORN;
  const colors = HILL_COLORS[hill.code] ?? HILL_COLORS.HOOK;
  const isLocked = lockedPreview && !isHighlighted;
  const bloomOpacity = isLocked ? 0.38 : 0.72;
  const haloOpacity = isLocked ? 0.45 : 0.85;
  const showScore = !lockedPreview && hill.score != null && hill.score !== '';
  const showStar = !lockedPreview && (isFocus || hill.score >= 80);
  const caption = lockedPreview ? hill.code : hillCaption(hill, isFocus);

  const positionStyle = {
    left: `${hill.x}%`,
    top: `${hill.y}%`,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    transform: 'translate(-50%, -50%)',
  };

  const badgeInner = (
    <>
      {/* Outer color bloom */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.from} 0%, ${colors.to}99 38%, transparent 72%)`,
          filter: 'blur(10px)',
          opacity: bloomOpacity,
        }}
      />
      {/* Mid halo ring */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[118%] w-[118%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          boxShadow: `0 0 28px 10px ${colors.glow}, 0 0 52px 18px ${colors.glow}`,
          opacity: haloOpacity,
        }}
      />

      <div
        className={[
          'relative flex h-full w-full flex-col items-center justify-between rounded-full px-1 py-2 text-white',
          isFocus ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent' : '',
          isHighlighted ? 'ring-2 ring-amber-200/90 ring-offset-1 ring-offset-transparent' : '',
        ].join(' ')}
        style={{
          background: colors.fill,
          border: '2.5px solid rgba(255,255,255,0.92)',
          outline: `2px solid ${colors.from}`,
          outlineOffset: '-1px',
          opacity: isLocked ? 0.78 : 1,
          boxShadow: [
            `0 0 16px 4px ${colors.glow}`,
            `0 0 32px 8px ${colors.glow}`,
            'inset 0 2px 10px rgba(255,255,255,0.35)',
            'inset 0 -4px 12px rgba(0,0,0,0.15)',
          ].join(', '),
        }}
      >
        <Icon
          className="h-3 w-3 shrink-0 opacity-95 drop-shadow-sm"
          strokeWidth={2.25}
          aria-hidden="true"
        />
        <span className="text-[9px] font-bold leading-none tracking-wide drop-shadow-sm">
          {hill.code}
        </span>
        {showScore ? (
          <span className="-my-0.5 flex items-center gap-0.5 drop-shadow-sm">
            <span className="font-display text-lg font-semibold leading-none tabular-nums">
              {hill.score}
            </span>
            {showStar ? (
              <Star className="h-2.5 w-2.5 shrink-0 fill-amber-300 text-amber-300" aria-hidden="true" />
            ) : null}
          </span>
        ) : (
          <span className="h-5" aria-hidden="true" />
        )}
        {!lockedPreview ? (
          <span className="max-w-full truncate px-0.5 text-[8px] font-semibold leading-tight text-white drop-shadow-sm">
            {caption}
          </span>
        ) : isHighlighted ? (
          <span className="max-w-full truncate px-0.5 text-[8px] font-bold leading-tight text-amber-100 drop-shadow-sm">
            Start here
          </span>
        ) : null}
      </div>
    </>
  );

  const ariaLabel = lockedPreview
    ? `${hill.code}, locked`
    : `${hill.code}, score ${hill.score}, ${caption}`;

  const badgeContent = isHighlighted ? (
    <motion.div
      className="relative h-full w-full"
      animate={highlightPulse}
      transition={highlightPulseTransition}
    >
      {badgeInner}
    </motion.div>
  ) : (
    badgeInner
  );

  function wrapBadge(className, extraProps = {}) {
    if (animateEntrance || lockedPreview) {
      return (
        <motion.div
          variants={
            lockedPreview && animateEntrance ? previewEntranceVariants : badgeEntranceVariants
          }
          custom={
            lockedPreview && animateEntrance
              ? { highlighted: isHighlighted, staggerDelay }
              : isHighlighted
          }
          className={className}
          style={positionStyle}
          aria-label={ariaLabel}
          initial="hidden"
          animate={
            lockedPreview && !animateEntrance && isLocked
              ? lockedPreviewState
              : 'visible'
          }
          transition={lockedPreview && !animateEntrance && isLocked ? { duration: 0.3 } : undefined}
          {...extraProps}
        >
          {badgeContent}
        </motion.div>
      );
    }
    return (
      <div className={className} style={positionStyle} aria-label={ariaLabel} {...extraProps}>
        {badgeContent}
      </div>
    );
  }

  if (interactive) {
    if (animateEntrance || lockedPreview) {
      return wrapBadge('absolute z-20');
    }
    return (
      <button
        type="button"
        onClick={() => onSelect(hill.code)}
        className="absolute z-20 border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        style={positionStyle}
        aria-label={ariaLabel}
      >
        {badgeContent}
      </button>
    );
  }

  return wrapBadge('absolute z-20');
}

export function TreeOfLife({
  hills = [],
  focusHillCode,
  highlightHillCode = null,
  animateEntrance = false,
  interactive = true,
  lockedPreview = false,
  showHeader = true,
  headerTitle = 'TREE OF LIFE',
  footerChip = null,
  staggerOrder = null,
  ambientMotion = false,
  treeLevel = 1,
}) {
  const navigate = useNavigate();
  const level = normalizeTreeLevel(treeLevel);
  const stage = getTreeStage(level);
  const stageBg = getTreeStageBackground(level);
  const hillList = Array.isArray(hills) ? hills : [];
  const hillByCode = Object.fromEntries(hillList.map((h) => [h.code, h]));

  const placedHills = HILL_CODES.map((code) => {
    const pos = HILL_POSITIONS[code];
    const hill = hillByCode[code] ?? {
      code,
      name: code,
      score: 0,
      status: 'Emerging',
    };
    return { ...hill, x: pos.x, y: pos.y };
  });

  function handleHillSelect(code) {
    if (!interactive) return;
    navigate(`/missions?hill=${encodeURIComponent(code)}`);
  }

  function handleInfoClick() {
    window.alert('Each Hill reflects your growth in a life area. Tap one to explore missions.');
  }

  const revealOrder = staggerOrder ?? HILL_CODES;

  const badgeList = placedHills.map((hill) => (
    <HillBadge
      key={hill.code}
      hill={hill}
      isFocus={hill.code === focusHillCode}
      isHighlighted={hill.code === highlightHillCode}
      onSelect={handleHillSelect}
      animateEntrance={animateEntrance}
      interactive={interactive}
      lockedPreview={lockedPreview}
      staggerDelay={
        animateEntrance ? Math.max(0, revealOrder.indexOf(hill.code)) * TREE_BADGE_STAGGER_S + 0.1 : 0
      }
    />
  ));

  return (
    <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-md shadow-slate-300/35">
      {showHeader ? (
        <header className="flex items-center justify-center gap-1.5 bg-white px-4 py-3">
          <h2 className="font-display text-xs font-bold tracking-[0.18em] text-slate-900">
            {headerTitle}
          </h2>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
            Lv {level} · {stage.stage}
          </span>
          {interactive ? (
            <button
              type="button"
              onClick={handleInfoClick}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
              aria-label="About Tree of Life"
            >
              <Info className="h-3 w-3" strokeWidth={2.5} />
            </button>
          ) : null}
        </header>
      ) : null}

      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-sky-300/40 via-emerald-100/60 to-emerald-200/80"
        />
        <motion.img
          key={stageBg}
          src={stageBg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_40%]"
          animate={
            ambientMotion
              ? { scale: [1, 1.04, 1], x: [0, -0.4, 0], y: [0, -0.25, 0] }
              : undefined
          }
          transition={
            ambientMotion
              ? { repeat: Infinity, duration: 14, ease: 'easeInOut' }
              : { duration: 0.45, ease: 'easeOut' }
          }
        />

        <ConnectorLines hills={placedHills} ambientMotion={ambientMotion} />

        {animateEntrance && !staggerOrder ? (
          <motion.div
            className="absolute inset-0"
            variants={badgeContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {badgeList}
          </motion.div>
        ) : (
          badgeList
        )}

        {footerChip ? (
          <div className="absolute inset-x-0 bottom-2 z-30 flex justify-center px-3">
            <span className="inline-flex items-center rounded-full border border-white/60 bg-white/95 px-3 py-1.5 text-[10px] font-semibold text-violet-800 shadow-md backdrop-blur-sm">
              {footerChip}
            </span>
          </div>
        ) : null}

        {interactive && !footerChip ? (
          <div className="absolute inset-x-0 bottom-2 z-30 flex justify-center px-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-[#0c0c14]/90 px-3 py-1.5 text-[10px] font-semibold text-violet-100 shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_12px_rgba(124,58,237,0.25)] backdrop-blur-sm">
              <Hand className="h-3 w-3 text-violet-300" aria-hidden="true" />
              Tap a Hill to explore
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
