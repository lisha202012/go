/**
 * Main 30-day challenge indicator — matches spec:
 * 🌱 GLOW SEEDS
 * 14 / 21
 */
export function GrowChallengeProgress({
  challenge,
  size = 'default',
  className = '',
  showDayMeta = false,
}) {
  if (!challenge) return null;

  const {
    glowSeedsEarned,
    glowSeedsTarget,
    challengeDaysTotal,
    challengeDayIndex,
    daysRemaining,
    isComplete,
  } = challenge;

  const isCompact = size === 'compact';

  return (
    <div className={className}>
      <p
        className={[
          'font-bold uppercase tracking-[0.14em] text-emerald-400',
          isCompact ? 'text-[9px]' : 'text-[11px]',
        ].join(' ')}
      >
        <span aria-hidden="true">🌱</span> Glow Seeds
      </p>
      <p
        className={[
          'font-display font-bold tabular-nums text-violet-50',
          isCompact ? 'mt-0.5 text-lg leading-none' : 'mt-1 text-3xl leading-none',
        ].join(' ')}
      >
        {glowSeedsEarned}
        <span className={isCompact ? 'text-sm font-semibold text-violet-400' : 'text-xl font-semibold text-violet-400'}>
          {' '}
          / {glowSeedsTarget}
        </span>
      </p>
      {showDayMeta && !isComplete ? (
        <p className={['text-violet-400', isCompact ? 'mt-1 text-[10px]' : 'mt-2 text-xs'].join(' ')}>
          Day {challengeDayIndex} of {challengeDaysTotal}
          {daysRemaining != null ? (
            <>
              {' '}
              · <span className="font-medium text-violet-300">{daysRemaining} days left</span>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
