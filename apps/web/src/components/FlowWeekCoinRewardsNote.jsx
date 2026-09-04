export function FlowWeekCoinRewardsNote({ coinRewards, className = '' }) {
  if (!coinRewards) return null;

  const perMission = coinRewards.prescribedMission ?? 100;
  const dailyBonus = coinRewards.dailyFlowBonus ?? 200;
  const optional = coinRewards.optionalOffHillMission ?? 10;
  const perfectWeekBonus = coinRewards.perfectWeekBonus ?? 1500;
  const dailyTotal = perMission * 3 + dailyBonus;

  return (
    <p
      className={[
        'rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-xs leading-relaxed text-violet-800/90',
        className,
      ].join(' ')}
    >
      <span className="font-semibold text-violet-900">Rewards:</span> Complete any 3 missions on
      today&apos;s Home Hill for +{perMission}×3 + {dailyBonus} bonus (= {dailyTotal} coins), +1 Glow
      Seed, and +1 Step — once per day. Extra missions earn +{optional} each. Perfect week (7/7
      on-time): +{perfectWeekBonus} coins and +3 Glow Seeds.
    </p>
  );
}

function formatCompletedAt(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatMissionCompletedAt(iso) {
  return formatCompletedAt(iso);
}
