import { Users } from 'lucide-react';
import { resolveCampProgress, STEPS_PER_HILL } from '../lib/hillProgress';
import { trailPointForStep } from '../lib/hillMountainLayout';
import { formatHillCodeDomain, formatHillTitle } from '../lib/hills';
import { HILL_LUCIDE } from '../lib/hillIcons';

const HILL_BG = '/images/hill-mountain.jpg';
const BOY_AVATAR = '/images/hill-avatar-boy.png';

function nextCampPillLabel(nextCamp) {
  if (!nextCamp) return '';
  if (nextCamp.number === 7) return 'SUMMIT';
  return `CAMP ${nextCamp.number}`;
}

function RedGlowStage() {
  return (
    <div className="relative flex h-[26px] w-[72px] items-center justify-center sm:h-[30px] sm:w-[84px]">
      <div
        className="absolute inset-x-[-20%] bottom-0 h-16 bg-red-600/50 blur-2xl sm:h-20"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-full left-1/2 h-10 w-12 -translate-x-1/2 bg-gradient-to-t from-red-600/55 to-transparent blur-lg"
        aria-hidden="true"
      />
      <div className="relative h-full w-full rounded-[100%] border-2 border-red-400 bg-gradient-to-b from-red-500 via-red-600 to-red-900 shadow-[0_0_22px_#ef4444,0_0_40px_#ea580c88,inset_0_1px_6px_#fca5a5]">
        <div className="absolute inset-[3px] rounded-[100%] border border-red-300/35" />
        <div className="absolute inset-[7px] rounded-[100%] border border-red-200/20" />
      </div>
    </div>
  );
}

function HillHeadCards({ hill, completedSteps, variant, camp, nextCamp }) {
  if (!hill) return null;

  const HillIcon = HILL_LUCIDE[hill.code] ?? Users;
  const hillTitle = formatHillTitle(hill).toUpperCase();
  const hillLine = formatHillCodeDomain(hill);
  const isAssigned = variant === 'assigned';

  return (
    <div className="mb-2 flex gap-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-violet-200/80 bg-[#1a1a1a] px-2 py-1.5 shadow-sm">
        <div className="min-w-0 flex-1">
          <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-rose-400">
            {isAssigned ? 'Your focus hill' : 'Hill'}
          </p>
          <p className="truncate font-display text-[11px] font-bold uppercase leading-tight text-white">
            {hillTitle}
          </p>
          <p className="truncate text-[8px] font-bold uppercase tracking-wide text-rose-400">
            {hillLine}
          </p>
        </div>
        <HillIcon className="h-5 w-5 shrink-0 text-rose-400" strokeWidth={1.75} aria-hidden="true" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg border border-violet-200/80 bg-[#1a1a1a] px-1.5 py-1.5 shadow-sm">
        <p className="text-[7px] font-bold uppercase tracking-[0.14em] text-white/85">
          — Your progress —
        </p>
        <p className="mt-0.5 flex items-baseline justify-center gap-0.5 font-display uppercase leading-none">
          <span className="text-[9px] font-bold text-white">Step</span>
          <span className="text-lg font-black text-rose-400">{completedSteps}</span>
          <span className="text-[9px] font-bold text-white/75">/ {STEPS_PER_HILL}</span>
        </p>
        {nextCamp ? (
          <p className="mt-0.5 text-center text-[8px] font-semibold text-white/90">
            {camp.stepsRemaining} Step{camp.stepsRemaining === 1 ? '' : 's'} to{' '}
            {nextCampPillLabel(nextCamp)}
          </p>
        ) : (
          <p className="mt-0.5 text-center text-[8px] font-semibold text-emerald-300">Summit reached</p>
        )}
      </div>
    </div>
  );
}

export function HillMountainVisual({
  hill,
  completedSteps = 0,
  variant = 'assigned',
  className = '',
}) {
  const camp = resolveCampProgress(completedSteps);
  const nextCamp = camp.nextCamp;
  const isAssigned = variant === 'assigned';
  const userPoint = trailPointForStep(completedSteps);

  return (
    <div className={['mx-auto w-full max-w-md', className].join(' ')}>
      {hill ? (
        <HillHeadCards
          hill={hill}
          completedSteps={completedSteps}
          variant={variant}
          camp={camp}
          nextCamp={nextCamp}
        />
      ) : null}

      <div
        className={[
          'relative overflow-hidden rounded-3xl shadow-xl',
          isAssigned ? 'ring-1 ring-black/15' : 'opacity-90 ring-1 ring-violet-900/20',
        ].join(' ')}
        style={{ aspectRatio: '9 / 16', minHeight: 520, maxHeight: 680 }}
      >
        <img
          src={HILL_BG}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_42%]"
          draggable={false}
        />

        <div
          className="absolute z-10 flex flex-col items-center transition-[left,top] duration-700 ease-out"
          style={{
            left: `${userPoint.x}%`,
            top: `${userPoint.y}%`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="relative z-30 mb-1 shrink-0 min-w-[96px] rounded-md border-2 border-white bg-white px-2.5 py-1.5 shadow-md">
            <div
              className="absolute -bottom-1.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-white bg-white"
              aria-hidden="true"
            />
            <p className="text-center text-[7px] font-bold uppercase tracking-wider text-neutral-700">
              You are here
            </p>
            <p className="text-center text-sm font-black uppercase leading-none text-red-600">
              Step {completedSteps}
            </p>
          </div>

          <div className="relative z-10 flex flex-col items-center leading-none">
            <div className="relative">
              <div
                className="pointer-events-none absolute left-1/2 top-[50%] h-20 w-24 -translate-x-1/2 rounded-full bg-red-500/40 blur-2xl sm:h-24 sm:w-28"
                aria-hidden="true"
              />
              <img
                src={BOY_AVATAR}
                alt="Your position on the hill"
                className="relative z-10 block h-[92px] w-auto max-w-[96px] drop-shadow-[0_0_10px_rgba(239,68,68,0.9),0_0_24px_rgba(249,115,22,0.65),0_0_40px_rgba(234,88,12,0.35),0_6px_14px_rgba(0,0,0,0.5)] sm:h-[104px] sm:max-w-[110px]"
                draggable={false}
              />
            </div>
            <div className="-mt-[20px] sm:-mt-[22px]">
              <RedGlowStage />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
