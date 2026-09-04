export const GLOW_SEED_JOURNEY = [
  {
    id: 'activate',
    label: 'Seed activates account',
    hint: 'Your garden opens — you and your sender grow together',
    emoji: '✨',
  },
  {
    id: 'bloom',
    label: 'Hidden bloom',
    hint: 'A mystery virtue is revealed just for you',
    emoji: '🌱',
  },
  {
    id: 'bonus',
    label: 'Welcome bonus',
    hint: 'Growth Coins are added to your wallet',
    emoji: '🪙',
  },
  {
    id: 'virtue',
    label: 'First virtue activated',
    hint: 'That virtue glows for both of you until month-end',
    emoji: '💜',
  },
];

export function GlowSeedJourneyList({
  completedIds = [],
  activeId = null,
  variant = 'preview',
}) {
  const isPreview = variant === 'preview';
  const isDone = variant === 'done';

  return (
    <ul className="space-y-2.5">
      {GLOW_SEED_JOURNEY.map((step) => {
        const done = completedIds.includes(step.id);
        const active = activeId === step.id;

        return (
          <li
            key={step.id}
            className={[
              'flex items-start gap-3 rounded-xl px-3 py-2.5 transition',
              isDone && done
                ? 'bg-white/20'
                : active
                  ? 'bg-white/10 ring-1 ring-white/30'
                  : isPreview
                    ? 'border border-dashed border-violet-200 bg-violet-50/50'
                    : 'bg-white/5 opacity-70',
            ].join(' ')}
          >
            <span
              className={[
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm',
                isDone && done
                  ? 'bg-white text-violet-700'
                  : active
                    ? 'bg-white/30 text-white'
                    : isPreview
                      ? 'bg-violet-100 text-violet-600'
                      : 'bg-white/20 text-white',
              ].join(' ')}
              aria-hidden="true"
            >
              {isDone && done ? '✓' : active ? '…' : isPreview ? step.emoji : '○'}
            </span>
            <span className="min-w-0">
              <span
                className={[
                  'block text-sm font-semibold',
                  isPreview ? 'text-violet-900' : 'text-white',
                ].join(' ')}
              >
                {step.label}
              </span>
              <span
                className={[
                  'mt-0.5 block text-xs leading-relaxed',
                  isPreview ? 'text-violet-700/70' : 'text-violet-100/90',
                ].join(' ')}
              >
                {step.hint}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
