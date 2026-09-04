import { Lock } from 'lucide-react';
import { isMissionCompleted } from '../lib/missionCompletion';

const GLOW_IMAGES = [
  '/images/missions/glow-1.png',
  '/images/missions/glow-2.jpg',
  '/images/missions/glow-3.jpg',
];

function PulseGlowIcon({ index, completed = false, dimmed = false, locked = false }) {
  const src = GLOW_IMAGES[index] ?? GLOW_IMAGES[0];

  return (
    <div className="relative mx-auto flex h-[92px] w-[92px] items-center justify-center">
      <img
        src={src}
        alt=""
        className={[
          'h-full w-full object-contain transition',
          locked ? 'opacity-25 grayscale' : '',
          dimmed && !locked ? 'opacity-45 saturate-50 brightness-75 hue-rotate-[250deg]' : '',
          completed && !dimmed && !locked ? 'brightness-110' : '',
        ].join(' ')}
        draggable={false}
      />
      {completed && !locked ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/35 px-2 py-0.5 text-sm font-bold text-emerald-400">
            ✓
          </span>
        </span>
      ) : null}
    </div>
  );
}

export function PulseGlowMissionCard({
  index,
  mission,
  coinReward = 100,
  completed,
  completedToday,
  busy,
  locked = false,
  useModal = false,
  onOpen,
  expanded,
  onToggle,
  onWhy,
  onStart,
  onComplete,
  accent,
}) {
  const done = isMissionCompleted(mission) || completed || completedToday;
  const showChakraActivated = index === 2 && done;
  const hillAccent = accent ?? '#7C3AED';

  function handleOpen() {
    if (busy || locked) return;
    if (useModal) {
      onOpen?.(mission);
      return;
    }
    if (done) return;
    if (!mission.started) onStart?.(mission.id);
    onToggle?.(mission.id);
  }

  return (
    <div
      className={[
        'relative flex shrink-0 flex-col rounded-xl border px-3 pb-3 pt-2.5 transition',
        useModal || !expanded ? 'w-[132px] sm:w-[142px]' : 'w-[168px] sm:w-[180px]',
        locked
          ? 'border-white/5 bg-[#141414] opacity-80'
          : done
            ? 'border-emerald-600/30 bg-[#1c1c1c]'
            : !useModal && expanded
              ? 'border-rose-500/40 bg-[#1c1c1c]'
              : 'border-white/10 bg-[#1a1a1a]',
        busy ? 'opacity-60' : '',
      ].join(' ')}
    >
      {locked ? (
        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/50">
          <Lock className="h-3.5 w-3.5 text-white/50" strokeWidth={2} />
        </span>
      ) : null}

      <button
        type="button"
        disabled={busy || locked}
        onClick={handleOpen}
        className={[
          'w-full text-left',
          locked ? 'cursor-default' : 'cursor-pointer',
        ].join(' ')}
      >
        <p className={`text-[10px] font-bold uppercase tracking-wide ${locked ? 'text-white/40' : 'text-white'}`}>
          Mission {index + 1}
        </p>
        <p className={`text-[10px] font-semibold ${locked ? 'text-amber-300/40' : 'text-amber-300/95'}`}>
          +{coinReward} Coins
        </p>

        <div className="my-3">
          <PulseGlowIcon index={index} completed={done} locked={locked} />
        </div>

        <p
          className={`text-center text-[11px] font-bold uppercase tracking-wide ${
            locked ? 'text-rose-400/35' : 'text-rose-400'
          }`}
        >
          Pulse {index + 1}
        </p>

        {useModal && !locked && mission.title ? (
          <div className="mt-2 border-t border-white/10 pt-2">
            <p className="text-[10px] font-bold leading-snug text-white line-clamp-2">{mission.title}</p>
          </div>
        ) : null}
      </button>

      {showChakraActivated ? (
        <span className="mx-auto mt-2 rounded-full bg-emerald-800 px-3 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-100">
          Chakra activated
        </span>
      ) : null}

      {!useModal && !locked && expanded && !done ? (
        <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
          <p className="text-[11px] font-bold leading-snug text-white">{mission.title}</p>
          {mission.description ? (
            <p className="text-[10px] leading-relaxed text-white/70">{mission.description}</p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => onComplete?.(mission.id)}
            className="w-full rounded-lg py-2 text-[10px] font-bold uppercase text-white disabled:opacity-60"
            style={{ backgroundColor: hillAccent }}
          >
            {busy ? '…' : 'Complete'}
          </button>
        </div>
      ) : null}

      {!useModal && !locked && expanded && done && index !== 2 ? (
        <p className="mt-2 text-center text-[9px] font-semibold text-emerald-400">Complete ✓</p>
      ) : null}
    </div>
  );
}

export function ExtraMissionCard({ coinReward = 10, onExplore, locked = false }) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onExplore}
      className={[
        'relative flex w-[132px] shrink-0 flex-col rounded-xl border px-3 pb-3 pt-2.5 text-left sm:w-[142px]',
        locked
          ? 'cursor-not-allowed border-white/5 bg-[#141414] opacity-80'
          : 'border-violet-900/40 bg-[#1a1a1a] hover:border-violet-700/50',
      ].join(' ')}
    >
      {locked ? (
        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/50">
          <Lock className="h-3.5 w-3.5 text-white/50" strokeWidth={2} />
        </span>
      ) : null}

      <p className={`text-[10px] font-bold uppercase tracking-wide ${locked ? 'text-white/40' : 'text-white'}`}>
        Extra mission
      </p>
      <p className={`text-[10px] font-semibold ${locked ? 'text-amber-300/40' : 'text-amber-300/95'}`}>
        +{coinReward} Coins
      </p>

      <div className="my-3">
        <PulseGlowIcon index={0} dimmed locked={locked} />
      </div>

      <p
        className={`text-center text-[10px] font-bold uppercase tracking-wide ${
          locked ? 'text-violet-300/35' : 'text-violet-300'
        }`}
      >
        Extra mission
      </p>
    </button>
  );
}
