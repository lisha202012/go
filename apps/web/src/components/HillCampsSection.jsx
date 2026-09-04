import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Sprout, TreeDeciduous } from 'lucide-react';
import { CampStreakBadge, CampStreakInfoModal } from './CampStreakInfoModal';
import { HILL_LUCIDE } from '../lib/hillIcons';
import { HILL_RING_COLORS, FLOW_RING_FOUNDATION_THRESHOLD } from '../lib/hillRingColors';
import {
  CAMP_CHECKPOINTS,
  campTrailMarkers,
  resolveCampProgress,
  appClimbDisplayMax,
  STEPS_PER_HILL,
} from '../lib/hillProgress';
import {
  formatHillCodeDomain,
  formatHillTitle,
  hillVirtueLabel,
} from '../lib/hills';
import { GAP_HILL_JOURNEY_ORDER } from '../lib/gapHillJourney';

function sortHillsLikeGapAssessment(hills = []) {
  const byCode = new Map((hills ?? []).map((h) => [h.code, h]));
  const ordered = GAP_HILL_JOURNEY_ORDER.map((code) => byCode.get(code)).filter(Boolean);
  const extras = (hills ?? []).filter((h) => !GAP_HILL_JOURNEY_ORDER.includes(h.code));
  return [...ordered, ...extras];
}

function enrichHillCamp(hill, climbMax = STEPS_PER_HILL) {
  const steps = hill?.completedSteps ?? 0;
  const camp = resolveCampProgress(steps);
  const nextCamp =
    camp.nextCamp && camp.nextCamp.stepThreshold <= climbMax ? camp.nextCamp : null;
  return {
    ...hill,
    workingStep: hill?.workingStep ?? (steps >= climbMax ? climbMax : steps + 1),
    camp: hill?.camp ?? camp.currentCamp,
    nextCamp: hill?.nextCamp && hill.nextCamp.stepThreshold <= climbMax ? hill.nextCamp : nextCamp,
    stepsRemaining: nextCamp
      ? Math.max(0, nextCamp.stepThreshold - steps)
      : camp.nextCamp && camp.nextCamp.stepThreshold > climbMax
        ? 0
        : hill?.stepsRemaining ?? camp.stepsRemaining,
  };
}

function isFlourishingHill(hill) {
  // Matches GAP / FLOW Ring foundation: Emerging < 40, else Flourishing group.
  return (hill?.score ?? 0) >= FLOW_RING_FOUNDATION_THRESHOLD;
}

/**
 * Camp trail: 7 camp checkpoints (1·3·7·14·21·35·49).
 * Live step badge sits on the track between camps — never replaces a camp label
 * (avoids “Step 2” sitting on top of “3” looking like Camp 3).
 */
function CampDotTrail({ currentStep = 0, workingStep = 1, accent }) {
  const markers = campTrailMarkers(STEPS_PER_HILL);
  const maxStep = markers[markers.length - 1] ?? STEPS_PER_HILL;
  const gaps = Math.max(1, markers.length - 1);
  const safeDone = Math.max(0, Math.min(maxStep, currentStep));
  const liveStep = Math.max(1, Math.min(maxStep, workingStep));
  const showLive = safeDone < maxStep;

  function stepToTrailPct(step) {
    const n = Math.max(0, Math.min(maxStep, step));
    if (n <= 0) return 0;
    if (n >= maxStep) return 100;
    if (n < markers[0]) return (n / markers[0]) * (100 / gaps);
    for (let i = 0; i < markers.length - 1; i += 1) {
      const a = markers[i];
      const b = markers[i + 1];
      if (n >= a && n <= b) {
        const t = b === a ? 0 : (n - a) / (b - a);
        return ((i + t) / gaps) * 100;
      }
    }
    return 100;
  }

  const progressPct = stepToTrailPct(safeDone);
  const livePct = stepToTrailPct(Math.max(safeDone, liveStep));

  return (
    <div className="w-full">
      <div className="relative px-1 pt-1">
        <div className="absolute left-3 right-3 top-[14px] h-[3px] rounded-full bg-slate-200" />
        <div
          className="absolute left-3 top-[14px] h-[3px] rounded-full transition-all duration-500"
          style={{
            width: `calc((100% - 1.5rem) * ${Math.min(100, progressPct) / 100})`,
            backgroundColor: accent,
          }}
        />

        {/* Live step — between camps, not inside a camp node */}
        {showLive ? (
          <div
            className="pointer-events-none absolute top-[14px] z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
            style={{ left: `calc(0.75rem + (100% - 1.5rem) * ${livePct / 100})` }}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-md ring-2 ring-white"
              style={{ backgroundColor: accent }}
              title={`Step ${liveStep}`}
            >
              {liveStep}
            </span>
          </div>
        ) : null}

        <div className="relative z-10 flex items-start justify-between">
          {markers.map((threshold) => {
            const reached = safeDone >= threshold;
            const camp = CAMP_CHECKPOINTS.find((c) => c.stepThreshold === threshold);

            return (
              <div
                key={threshold}
                title={camp ? `${camp.name} · Step ${threshold}` : `Step ${threshold}`}
                className="flex w-7 flex-col items-center gap-1"
              >
                <span
                  className={[
                    'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold',
                    reached
                      ? 'text-white'
                      : 'border border-slate-300 bg-white text-transparent',
                  ].join(' ')}
                  style={reached ? { backgroundColor: accent } : undefined}
                >
                  {reached ? '✓' : '·'}
                </span>
                <span className="text-[9px] font-medium tabular-nums text-slate-400">
                  {threshold}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HillProgressRow({ hill, climbMax, isFocus }) {
  const enriched = enrichHillCamp(hill, climbMax);
  const stepsDone = enriched.completedSteps ?? 0;
  const accent = HILL_RING_COLORS[enriched.code] ?? '#7C3AED';
  const Icon = HILL_LUCIDE[enriched.code] ?? Sprout;
  const campNumber = enriched.camp?.number ?? 1;
  const workingStep = Math.min(enriched.workingStep, climbMax);
  const gapPct = Math.round(Math.max(0, Math.min(100, Number(enriched.score) || 0)));
  const weekDone = enriched.missionsCompletedThisStep ?? 0;
  const weekTotal = enriched.missionsRequiredThisStep ?? 3;
  const weekComplete = weekDone >= weekTotal;
  const title = formatHillCodeDomain(enriched);
  const virtue = hillVirtueLabel(enriched);

  return (
    <div className="space-y-4 py-4">
      {/* Identity */}
      <div className="flex items-start gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        >
          <Icon className="h-6 w-6" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[15px] font-bold leading-tight tracking-tight text-slate-900">
              {title}
            </h3>
            {isFocus ? (
              <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                Focus
              </span>
            ) : null}
          </div>
          {virtue ? (
            <p className="mt-0.5 text-sm font-medium text-slate-500">{virtue}</p>
          ) : null}
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
            Step {workingStep} · Camp {campNumber}
          </p>
        </div>
        <span
          className="shrink-0 rounded-lg border bg-white px-2.5 py-1 text-sm font-bold tabular-nums"
          style={{ borderColor: `${accent}66`, color: accent }}
        >
          {gapPct}%
        </span>
      </div>

      {/* Camp trail — full width, never shares a row with the title on mobile */}
      <CampDotTrail currentStep={stepsDone} workingStep={workingStep} accent={accent} />

      {/* Week + CTA */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-slate-500">Today</p>
          <p
            className="text-2xl font-bold tabular-nums leading-none"
            style={{ color: weekComplete ? '#16a34a' : accent }}
          >
            {Math.min(weekDone, weekTotal)}/{weekTotal}
          </p>
        </div>
        <Link
          to={`/missions?hill=${encodeURIComponent(enriched.code)}`}
          className="inline-flex items-center gap-1 rounded-xl border bg-white px-3.5 py-2.5 text-sm font-semibold transition hover:bg-slate-50"
          style={{ borderColor: `${accent}55`, color: accent }}
        >
          View Missions
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function HillGroupCard({ variant, open, onToggle, children, empty }) {
  const isEmerging = variant === 'emerging';
  const Icon = isEmerging ? Sprout : TreeDeciduous;
  const iconWrap = isEmerging
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-sky-100 text-sky-700';
  const title = isEmerging ? 'Emerging Hills' : 'Flourishing Hills';
  const blurb = isEmerging
    ? 'These areas need your attention — small steps grow big roots.'
    : 'Keep watering what’s already strong.';

  if (empty) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/80"
        aria-expanded={open}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconWrap}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-900">
            {title}
          </h3>
          {!open ? (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              Work on any Hill to grow your flow!
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={[
            'h-5 w-5 shrink-0 text-slate-400 transition-transform',
            open ? 'rotate-180' : '',
          ].join(' ')}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="border-t border-slate-100 px-4 pb-1">
          <p className="pt-3 text-xs leading-relaxed text-slate-500">
            <span className="font-medium text-slate-600">Work on any Hill to grow your flow!</span>
            {' '}
            {blurb}
          </p>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function HillCampsSection({
  hills = [],
  todayHillCode,
  focusHillCode,
  campStreak,
}) {
  const rows = useMemo(
    () => sortHillsLikeGapAssessment((hills ?? []).filter((hill) => hill?.code)),
    [hills],
  );
  const climbMax = appClimbDisplayMax(rows);
  const defaultCode = todayHillCode ?? focusHillCode ?? rows[0]?.code ?? '';
  const [selectedCode, setSelectedCode] = useState(defaultCode);
  const [emergingOpen, setEmergingOpen] = useState(true);
  const [flourishingOpen, setFlourishingOpen] = useState(true);
  const [streakInfoOpen, setStreakInfoOpen] = useState(false);

  const selectedHill =
    rows.find((hill) => hill.code === selectedCode) ??
    rows.find((hill) => hill.code === defaultCode) ??
    rows[0];

  if (!rows.length || !selectedHill) return null;

  const flourishing = isFlourishingHill(selectedHill);
  const streakCount = campStreak?.tokensAvailable ?? 0;

  return (
    <section className="space-y-3">
      <CampStreakInfoModal open={streakInfoOpen} onClose={() => setStreakInfoOpen(false)} />
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-slate-900">Hill Camps</h2>
          <CampStreakBadge count={streakCount} onClick={() => setStreakInfoOpen(true)} />
        </div>
        <label className="block w-[min(100%,11.5rem)] shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Hill
          <select
            value={selectedHill.code}
            onChange={(e) => setSelectedCode(e.target.value)}
            className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm font-semibold text-violet-950 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
          >
            {rows.map((hill) => {
              const isToday = hill.code === todayHillCode;
              const isFocus = hill.isFocus || hill.code === focusHillCode;
              const suffix = isToday ? ' · Today' : isFocus ? ' · Focus' : '';
              return (
                <option key={hill.code} value={hill.code}>
                  {formatHillTitle(hill)}
                  {suffix}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      <HillGroupCard
        variant="emerging"
        open={emergingOpen}
        onToggle={() => setEmergingOpen((v) => !v)}
        empty={flourishing}
      >
        <HillProgressRow
          hill={selectedHill}
          climbMax={climbMax}
          isFocus={selectedHill.isFocus || selectedHill.code === focusHillCode}
        />
      </HillGroupCard>

      <HillGroupCard
        variant="flourishing"
        open={flourishingOpen}
        onToggle={() => setFlourishingOpen((v) => !v)}
        empty={!flourishing}
      >
        <HillProgressRow
          hill={selectedHill}
          climbMax={climbMax}
          isFocus={selectedHill.isFocus || selectedHill.code === focusHillCode}
        />
      </HillGroupCard>
    </section>
  );
}
