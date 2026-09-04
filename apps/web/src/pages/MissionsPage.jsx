import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  Clock,
  Coins,
  Heart,
  Leaf,
  Lock,
  Mountain,
  Target,
  Users,
} from 'lucide-react';
import { HillBlockPick } from '../components/HillBlockPick';
import { CycleCompleteSummary } from '../components/CycleCompleteSummary';
import { MissionCelebrationModal } from '../components/MissionCelebrationModal';
import { CampCelebrationModal } from '../components/CampCelebrationModal';
import { api } from '../lib/api';
import { isMissedDayBlockingError, redirectHomeForMissedDay } from '../lib/missedDayBlock';
import { formatStepProgressLine, formatNextStepIntro } from '../lib/cycleLabels';
import { formatHillTitle, HILL_DOMAINS } from '../lib/hills';
import { cycleCoinPotential, formatCycleBonusNote } from '../lib/missionRewards';
import { useAuthStore } from '../store/useAuthStore';
import { FlowWeekMissionsPanel } from '../components/FlowWeekMissionsPanel';

const HILL_LUCIDE = {
  HOOK: Clock,
  HOPE: Heart,
  HONE: Target,
  HOLD: Coins,
  HOOD: Leaf,
  HOST: Users,
  HORN: Mountain,
};

const HILL_ORDER = ['HOPE', 'HONE', 'HOLD', 'HOOD', 'HOST', 'HORN', 'HOOK'];
const MISSIONS_PER_BLOCK = 3;
const TABS = [
  { id: 'focus', label: 'Focus Hill' },
  { id: 'all', label: 'All Missions' },
  { id: 'library', label: 'Hill Library' },
];

function HillLucideIcon({ code, className = 'h-5 w-5' }) {
  const Icon = HILL_LUCIDE[code] ?? Mountain;
  return <Icon className={className} aria-hidden="true" />;
}

function PageCard({ children, className = '' }) {
  return (
    <div
      className={`gofam-game-card p-4 ${className}`}
    >
      {children}
    </div>
  );
}

function ProgressBar({ value, max, accentColor, className = '' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-violet-100 ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          background: accentColor
            ? `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`
            : 'linear-gradient(90deg, #7C3AED, #C026D3)',
        }}
      />
    </div>
  );
}

function MissionsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 rounded-xl bg-violet-100" />
      <div className="h-44 rounded-2xl bg-violet-100" />
      <div className="h-28 rounded-2xl bg-violet-100" />
      <div className="h-28 rounded-2xl bg-violet-100" />
      <div className="h-28 rounded-2xl bg-violet-100" />
    </div>
  );
}

function MissionsErrorCard({ title, message, children }) {
  return (
    <PageCard className="border-rose-100 bg-rose-50/50">
      <h1 className="font-display text-xl font-semibold text-violet-950">{title}</h1>
      {message ? <p className="mt-2 text-sm text-rose-600">{message}</p> : null}
      {children}
    </PageCard>
  );
}

function TabRow({ activeTab, onChange }) {
  return (
    <div className="flex gap-1 rounded-xl border border-violet-100 bg-violet-50/80 p-1">
      {TABS.map((tab) => {
        const selected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              'flex-1 rounded-lg px-2 py-2.5 text-xs font-semibold transition',
              selected
                ? 'bg-white text-violet-800 shadow-sm shadow-violet-100'
                : 'text-violet-600 hover:text-violet-800',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function hillDescription(hill) {
  if (hill?.description) return hill.description;
  return HILL_DOMAINS[hill?.code]?.description ?? 'Master this hill through focused missions';
}

function hillVirtueLabel(hill) {
  if (!hill) return '';
  const domain = formatHillTitle(hill);
  const virtue = hill.virtueName ?? HILL_DOMAINS[hill.code]?.hill ?? '';
  return `${hill.code} · ${domain}${virtue ? ` & ${virtue}` : ''}`;
}

function getHillJourneyStatus(hillId, weeks) {
  const hillWeeks = weeks.filter((w) => w.hill?.id === hillId);
  const withMissions = hillWeeks.filter((w) => w.mission);

  if (withMissions.length === 0) {
    return hillWeeks.some((w) => w.status === 'pending_selection') ? 'locked' : 'locked';
  }

  if (withMissions.every((w) => w.status === 'completed')) return 'completed';
  if (withMissions.some((w) => w.status === 'current')) return 'in-progress';
  if (withMissions.some((w) => w.status === 'completed')) return 'in-progress';
  return 'locked';
}

function hillStatusLabel(status) {
  if (status === 'completed') return 'Completed';
  if (status === 'in-progress') return 'In progress';
  return 'Locked';
}

function resolveCurrentWeek(data, missionIdParam, hillParam) {
  if (!data?.weeks) return null;

  if (data.summary?.needsBlockSelection) {
    return (
      data.weeks.find((w) => w.mission?.id === missionIdParam && w.status === 'current') ??
      data.weeks.find((w) => w.status === 'current' && w.mission) ??
      null
    );
  }

  return (
    data.weeks.find((w) => w.mission?.id === missionIdParam) ??
    (hillParam ? data.weeks.find((w) => w.hill?.code === hillParam && w.mission) : null) ??
    data.weeks.find((w) => w.status === 'current' && w.mission) ??
    data.weeks.find((w) => w.mission)
  );
}

function formatOpensAt(iso) {
  if (!iso) return 'next week';
  try {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return 'next week';
  }
}

function MissionCard({
  week,
  accent,
  expanded,
  completingId,
  onStart,
  onComplete,
  onCollapse,
}) {
  const { mission } = week;
  const isCompleted = week.status === 'completed';
  const isLocked = week.status === 'locked';
  const isWaitingNextWeek = week.status === 'waiting_next_week';
  const isStarted = Boolean(week.startedAt);
  const isActive = week.status === 'current';
  const isCompleting = completingId === mission.id;

  if (isCompleted) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
            <Check className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-violet-950">{mission.title}</p>
            <p className="mt-1 text-xs text-violet-700/70">{mission.description}</p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
      </div>
    );
  }

  if (isLocked || isWaitingNextWeek || !isActive) {
    const upNext = isWaitingNextWeek || (!isLocked && !isActive);
    return (
      <div className={`rounded-2xl border border-violet-100 bg-violet-50/30 p-4 ${upNext ? 'opacity-80' : 'opacity-70'}`}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-500">
            {week.taskNumber}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-violet-900">{mission.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-violet-700/60">{mission.description}</p>
            {isWaitingNextWeek ? (
              <p className="mt-1.5 text-[11px] font-semibold text-violet-500">
                Opens {formatOpensAt(week.opensAt)} · complete this week&apos;s mission first
              </p>
            ) : upNext ? (
              <p className="mt-1.5 text-[11px] font-semibold text-violet-500">Complete the prior mission first</p>
            ) : null}
          </div>
          <Lock className="h-4 w-4 shrink-0 self-center text-violet-300" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (expanded && isActive) {
    return (
      <div
        className="overflow-hidden rounded-2xl border shadow-lg"
        style={{
          borderColor: `${accent}55`,
          boxShadow: `0 8px 24px ${accent}22`,
        }}
      >
        <div
          className="px-4 py-3"
          style={{ background: `linear-gradient(135deg, ${accent}18, ${accent}08)` }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
              style={{ backgroundColor: accent }}
            >
              {week.taskNumber}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold text-violet-950">{mission.title}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-amber-700">
                <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                +{mission.coinReward} coins
              </p>
            </div>
            <button
              type="button"
              onClick={onCollapse}
              disabled={isCompleting}
              className="shrink-0 text-xs font-semibold text-violet-600 hover:text-violet-900 disabled:opacity-50"
            >
              Minimize
            </button>
          </div>
        </div>

        <div className="space-y-4 bg-white px-4 py-4">
          <p className="text-sm leading-relaxed text-violet-800/90">{mission.description}</p>
          <button
            type="button"
            disabled={Boolean(completingId)}
            onClick={() => onComplete(week)}
            className="w-full rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
            style={{ backgroundColor: accent }}
          >
            {isCompleting ? 'Saving…' : 'Complete mission'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={Boolean(completingId)}
      onClick={() => onStart(week)}
      className="w-full rounded-2xl border border-violet-100 bg-white p-4 text-left shadow-sm transition hover:border-violet-200 hover:shadow-md disabled:opacity-60"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: accent }}
        >
          {week.taskNumber}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-violet-950">{mission.title}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-violet-700/75">
            {mission.description}
          </p>
          <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            <Coins className="h-3 w-3" aria-hidden="true" />
            +{mission.coinReward}
          </p>
        </div>
        <span
          className="shrink-0 self-center rounded-xl px-3 py-2 text-xs font-semibold text-white"
          style={{ backgroundColor: accent }}
        >
          {isStarted ? 'Open' : 'Start'}
        </span>
      </div>
    </button>
  );
}

function FocusHillContent({
  data,
  currentWeek,
  expandedMissionId,
  completingId,
  error,
  onStartMission,
  onCompleteMission,
  onCollapseMission,
  allHills,
  onNavigateHill,
}) {
  const { hill } = currentWeek;
  const accent = hill.colorTheme ?? '#7C3AED';
  const rewards = data.rewards;

  const blockWeeks = useMemo(
    () =>
      data.weeks
        .filter((w) => w.hillBlock === currentWeek.hillBlock && w.mission)
        .sort((a, b) => a.taskNumber - b.taskNumber),
    [data.weeks, currentWeek.hillBlock],
  );

  const blockCompleted = blockWeeks.filter((w) => w.status === 'completed').length;
  const { earned: blockCoinsEarned, max: blockCoinMax } = cycleCoinPotential(rewards, blockCompleted);

  const focusHillId = hill.id;
  const otherHills = useMemo(() => {
    const fromApi = allHills?.length
      ? allHills
      : [...new Map(data.weeks.map((w) => [w.hill?.id, w.hill]).filter(([id]) => id)).values()];

    const byCode = new Map(fromApi.map((h) => [h.code, h]));
    return HILL_ORDER.map((code) => byCode.get(code)).filter((h) => h && h.id !== focusHillId);
  }, [allHills, data.weeks, focusHillId]);

  return (
    <div className="space-y-4">
      {data.summary.activeStep ? (
        <PageCard className="border-violet-200 bg-violet-50/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">
            Current step
          </p>
          <p className="mt-1 text-sm font-semibold text-violet-900">
            {formatStepProgressLine(data.summary.activeStep)}
          </p>
        </PageCard>
      ) : null}

      {/* Focus Hill hero */}
      <div
        className="overflow-hidden rounded-2xl border border-violet-100 p-5 shadow-md"
        style={{
          background: `linear-gradient(135deg, ${accent}22 0%, ${accent}11 50%, white 100%)`,
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{ backgroundColor: accent }}
          >
            <HillLucideIcon code={hill.code} className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold text-violet-950">
              {formatHillTitle(hill)}
            </p>
            <p className="text-xs font-medium text-violet-700/80">{hillVirtueLabel(hill)}</p>
            <p className="mt-1 text-xs font-semibold text-violet-600">
              {blockCompleted} / {MISSIONS_PER_BLOCK} missions this step
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-violet-800/75">{hillDescription(hill)}</p>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-violet-700">
            <span>
              {blockCompleted} / {MISSIONS_PER_BLOCK} Missions Completed
            </span>
            <span>{Math.round((blockCompleted / MISSIONS_PER_BLOCK) * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/40">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round((blockCompleted / MISSIONS_PER_BLOCK) * 100)}%`,
                background: `linear-gradient(90deg, ${accent}, ${accent}cc)`,
              }}
            />
          </div>
        </div>
      </div>

      {data.summary.weeklyProgress?.thisWeekComplete ? (
        <PageCard className="border-emerald-200 bg-emerald-50/70">
          <p className="text-sm font-semibold text-emerald-800">This week&apos;s mission complete</p>
          <p className="mt-1 text-xs text-emerald-700/90">
            {data.summary.weeklyProgress.opensAt
              ? `Your next mission opens ${formatOpensAt(data.summary.weeklyProgress.opensAt)}.`
              : 'Your next mission opens when the new week starts.'}
          </p>
        </PageCard>
      ) : null}

      {/* Three mission cards */}
      <div className="space-y-3">
        {blockWeeks.map((week) => (
          <MissionCard
            key={week.mission.id}
            week={week}
            accent={accent}
            expanded={expandedMissionId === week.mission.id}
            completingId={completingId}
            onStart={onStartMission}
            onComplete={onCompleteMission}
            onCollapse={onCollapseMission}
          />
        ))}
      </div>

      {/* Step progress + rewards */}
      <PageCard>
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">
          Step progress
        </p>
        <p className="mt-1 text-sm font-semibold text-violet-900">
          {blockCompleted} / {MISSIONS_PER_BLOCK} missions completed
        </p>
        <ProgressBar
          value={blockCompleted}
          max={MISSIONS_PER_BLOCK}
          className="mt-3"
          accentColor={accent}
        />
      </PageCard>

      <PageCard>
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">
          Step rewards
        </p>
        <p className="mt-2 flex items-center gap-2 font-display text-2xl font-semibold text-violet-950">
          <Coins className="h-6 w-6 text-amber-500" aria-hidden="true" />
          +{blockCoinsEarned}
          <span className="text-sm font-medium text-violet-600">/ {blockCoinMax} coins this step</span>
        </p>
        {rewards ? (
          <p className="mt-2 text-xs text-violet-600/90">{formatCycleBonusNote(rewards)}</p>
        ) : null}
      </PageCard>

      {/* Other hills */}
      <PageCard>
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">Other Hills</p>
        <ul className="mt-3 space-y-2">
          {otherHills.map((otherHill) => {
            const status = getHillJourneyStatus(otherHill.id, data.weeks);
            const tappable = status === 'in-progress' || status === 'completed';
            const HillIcon = HILL_LUCIDE[otherHill.code] ?? Mountain;

            return (
              <li key={otherHill.id}>
                <button
                  type="button"
                  disabled={!tappable}
                  onClick={() => tappable && onNavigateHill(otherHill)}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                    tappable
                      ? 'border-violet-100 bg-violet-50/40 hover:border-violet-200 hover:bg-violet-50'
                      : 'cursor-not-allowed border-violet-50 bg-violet-50/20 opacity-70',
                  ].join(' ')}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: otherHill.colorTheme ?? '#7C3AED' }}
                  >
                    <HillIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-violet-900">
                      {formatHillTitle(otherHill)}
                    </span>
                    <span className="text-[11px] font-medium text-violet-600">
                      {hillStatusLabel(status)}
                    </span>
                  </span>
                  {tappable ? (
                    <ChevronRight className="h-4 w-4 shrink-0 text-violet-400" aria-hidden="true" />
                  ) : (
                    <Lock className="h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </PageCard>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <Link
        to="/journey"
        className="flex items-center justify-center rounded-2xl border border-violet-200 bg-white px-5 py-3.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-50"
      >
        View full hill climb
      </Link>
    </div>
  );
}

export default function MissionsPage() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const isFlowWeekUser = (authUser?.journeyModelVersion ?? 0) >= 2;
  const [params] = useSearchParams();

  // authUser is cached in localStorage at login and does not update itself when
  // journeyModelVersion changes server-side (e.g. after a migration cutover runs
  // on an already-logged-in account). Refresh it from /auth/me on mount so a
  // migrated user is routed to FlowWeekMissionsPanel instead of the stale legacy
  // block/week-gated view.
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then(({ user }) => {
        if (!cancelled && user && user.journeyModelVersion !== authUser?.journeyModelVersion) {
          updateUser({ ...authUser, ...user });
        }
      })
      .catch(() => {
        // Non-fatal: fall back to whatever is cached if the refresh fails.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const missionIdParam = params.get('missionId');
  const hillParam = params.get('hill');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completingId, setCompletingId] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [campCelebration, setCampCelebration] = useState(null);
  const [expandedMissionId, setExpandedMissionId] = useState(null);
  const [showCycleComplete, setShowCycleComplete] = useState(false);
  const [completedCycleSummary, setCompletedCycleSummary] = useState(null);
  const [showPick, setShowPick] = useState(false);
  const [pickLoading, setPickLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('focus');
  const [allHills, setAllHills] = useState(null);

  async function loadJourney() {
    try {
      const result = await api.getMyJourney();
      setData(result);
      if (result.summary?.needsBlockSelection && result.summary.lastCompletedCycle) {
        setCompletedCycleSummary(result.summary.lastCompletedCycle);
        setShowCycleComplete(true);
      } else if (result.summary?.needsBlockSelection) {
        setShowPick(true);
      }
    } catch (err) {
      setError(err?.message || 'Could not load mission');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isFlowWeekUser) {
      setLoading(false);
      return;
    }
    loadJourney();
  }, [isFlowWeekUser]);

  useEffect(() => {
    if (isFlowWeekUser || !data) return;
    let cancelled = false;
    api
      .getHills()
      .then((res) => {
        if (!cancelled) setAllHills(res.hills ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isFlowWeekUser, data]);

  useEffect(() => {
    if (isFlowWeekUser || !data || expandedMissionId) return;
    const started = data.weeks.find(
      (w) => w.status === 'current' && w.startedAt && w.mission,
    );
    if (started?.mission?.id) {
      setExpandedMissionId(started.mission.id);
    }
  }, [isFlowWeekUser, data, expandedMissionId]);

  async function ensureMissionStarted(missionId) {
    try {
      const result = await api.startMission(missionId);
      setData(result.journey);
      return result.journey;
    } catch (err) {
      if (isMissedDayBlockingError(err)) {
        redirectHomeForMissedDay();
        return null;
      }
      setError(err.message || 'Could not start mission');
      return null;
    }
  }

  async function handleStartMission(week) {
    setError('');
    setExpandedMissionId(week.mission.id);
    if (!week.startedAt) {
      await ensureMissionStarted(week.mission.id);
    }
  }

  async function handleCompleteMission(week) {
    const { id, title, coinReward } = week.mission;
    setCompletingId(id);
    setError('');
    try {
      if (!week.startedAt) {
        const journey = await ensureMissionStarted(id);
        if (!journey) return;
      }

      const result = await api.completeMission(id);
      setExpandedMissionId(null);
      setCelebration({
        missionTitle: title,
        coinReward,
        pendingJourney: result.journey,
        needsBlockSelection: result.needsBlockSelection,
        completedCycleSummary: result.completedCycleSummary,
        campReached: result.campReached ?? null,
        hillTitle: formatHillTitle(week.hill),
      });
    } catch (err) {
      if (isMissedDayBlockingError(err)) {
        redirectHomeForMissedDay();
        return;
      }
      setError(err.message || 'Could not complete mission');
    } finally {
      setCompletingId(null);
    }
  }

  function handleCollapseMission() {
    if (completingId) return;
    setExpandedMissionId(null);
  }

  function dismissCelebration() {
    if (!celebration) return;
    if (celebration.campReached) {
      setCampCelebration({
        camp: celebration.campReached,
        hillTitle: celebration.hillTitle,
        pending: celebration,
      });
      setCelebration(null);
      return;
    }
    finishMissionCelebration(celebration);
    setCelebration(null);
  }

  function dismissCampCelebration() {
    if (!campCelebration?.pending) return;
    finishMissionCelebration(campCelebration.pending);
    setCampCelebration(null);
  }

  function finishMissionCelebration(payload) {
    setData(payload.pendingJourney);
    if (payload.needsBlockSelection && payload.completedCycleSummary) {
      setCompletedCycleSummary(payload.completedCycleSummary);
      setShowCycleComplete(true);
    } else if (payload.needsBlockSelection) {
      void beginNextCyclePick();
    }
  }

  async function beginNextCyclePick() {
    setPickLoading(true);
    setError('');
    try {
      const result = await api.getMyJourney();
      setData(result);
      if (result.summary?.pendingBlockSelection) {
        setShowCycleComplete(false);
        setShowPick(true);
      } else {
        setError('Your next step is not ready yet. Try again in a moment.');
      }
    } catch (err) {
      setError(err?.message || 'Could not load your next step');
    } finally {
      setPickLoading(false);
    }
  }

  function renderBlockPick(pending) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold text-violet-950">Missions</h1>
        <PageCard>
          <HillBlockPick
            stepNumber={pending.stepNumber}
            blockStartWeek={pending.blockStartWeek}
            hill={pending.hill}
            onComplete={(result) => {
              setShowPick(false);
              setCompletedCycleSummary(null);
              setData(result.journey);
              const missionId = result.unlockedMission?.id;
              if (missionId) navigate(`/missions?missionId=${missionId}`, { replace: true });
            }}
          />
        </PageCard>
      </div>
    );
  }

  function navigateToHill(hill) {
    const currentMissionWeek = data.weeks.find(
      (w) => w.hill?.id === hill.id && w.status === 'current' && w.mission,
    );
    if (currentMissionWeek?.mission?.id) {
      navigate(`/missions?missionId=${currentMissionWeek.mission.id}`, { replace: true });
      return;
    }
    const anyWeek = data.weeks.find((w) => w.hill?.id === hill.id && w.mission);
    if (anyWeek?.mission?.id) {
      navigate(`/missions?missionId=${anyWeek.mission.id}`, { replace: true });
      return;
    }
    navigate(`/missions?hill=${hill.code}`, { replace: true });
  }

  if (isFlowWeekUser) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold text-violet-950">Missions</h1>
        <FlowWeekMissionsPanel />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold text-violet-950">Missions</h1>
        <MissionsSkeleton />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold text-violet-950">Missions</h1>
        <MissionsErrorCard title="Missions" message={error}>
          <Link to="/journey" className="mt-4 inline-flex text-sm font-semibold text-violet-700">
          View Tree of Life →
        </Link>
        </MissionsErrorCard>
      </div>
    );
  }

  if (data?.summary?.needsMissionSelection) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold text-violet-950">Missions</h1>
        <MissionsErrorCard
          title="Choose your focus missions"
          message="Pick 3 missions on your focus hill first to begin Step 1."
        >
          <Link to="/onboarding" className="mt-4 inline-flex text-sm font-semibold text-violet-700">
          Choose your 3 missions →
        </Link>
        </MissionsErrorCard>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold text-violet-950">Missions</h1>
        <MissionsErrorCard
          title="Missions unavailable"
          message={error || 'Could not load your missions.'}
        >
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadJourney();
            }}
            className="mt-4 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </MissionsErrorCard>
      </div>
    );
  }

  if (pickLoading) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold text-violet-950">Missions</h1>
        <PageCard className="py-12 text-center">
          <p className="text-sm font-medium text-violet-700">Loading your next step…</p>
        </PageCard>
      </div>
    );
  }

  if (showCycleComplete && completedCycleSummary) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold text-violet-950">Missions</h1>
        <PageCard>
          <CycleCompleteSummary
            cycle={completedCycleSummary}
            rewards={data?.rewards}
            onContinue={beginNextCyclePick}
          />
        </PageCard>
        {pickLoading ? (
          <p className="text-center text-sm text-violet-600">Loading your next step…</p>
        ) : null}
        {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
        </div>
    );
  }

  if (showPick) {
    const pending = data?.summary?.pendingBlockSelection;
    if (pending) {
      return renderBlockPick(pending);
    }

    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold text-violet-950">Missions</h1>
        <MissionsErrorCard
          title="Next step unavailable"
          message={error || 'We could not load mission options for your next step.'}
        >
          <button
            type="button"
            onClick={beginNextCyclePick}
            className="mt-4 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </MissionsErrorCard>
      </div>
    );
  }

  const currentWeek = resolveCurrentWeek(data, missionIdParam, hillParam);

  if (!currentWeek?.mission) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold text-violet-950">Missions</h1>
        <MissionsErrorCard
          title="No active mission"
          message={
            data.summary.needsBlockSelection
              ? `Pick 3 ${formatHillTitle(data.summary.pendingBlockSelection?.hill)} missions for your next step.`
              : 'No active mission found yet.'
          }
        >
          {data.summary.needsBlockSelection ? (
            <button
              type="button"
              onClick={beginNextCyclePick}
              className="mt-4 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white"
            >
              Pick missions for {formatNextStepIntro(data.summary.pendingBlockSelection)}
          </button>
        ) : (
            <Link to="/journey" className="mt-4 inline-flex text-sm font-semibold text-violet-700">
              View hill climb →
          </Link>
        )}
        </MissionsErrorCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-violet-950">Missions</h1>

      <TabRow activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'focus' ? (
        <FocusHillContent
          data={data}
          currentWeek={currentWeek}
          expandedMissionId={expandedMissionId}
          completingId={completingId}
          error={error}
          onStartMission={handleStartMission}
          onCompleteMission={handleCompleteMission}
          onCollapseMission={handleCollapseMission}
          allHills={allHills}
          onNavigateHill={navigateToHill}
        />
      ) : (
        <PageCard className="py-10 text-center">
          <Mountain className="mx-auto h-10 w-10 text-violet-300" aria-hidden="true" />
          <p className="mt-3 font-display text-lg font-semibold text-violet-900">Coming soon</p>
          <p className="mt-1 text-sm text-violet-600/80">
            {activeTab === 'all' ? 'All Missions' : 'Hill Library'} is on the way.
          </p>
        <button
          type="button"
            onClick={() => setActiveTab('focus')}
            className="mt-4 text-sm font-semibold text-violet-700 hover:underline"
        >
            Back to Focus Hill
        </button>
        </PageCard>
      )}

      <MissionCelebrationModal
        open={Boolean(celebration)}
        missionTitle={celebration?.missionTitle}
        coinReward={celebration?.coinReward}
        onConfirm={dismissCelebration}
      />
      <CampCelebrationModal
        open={Boolean(campCelebration)}
        camp={campCelebration?.camp}
        hillTitle={campCelebration?.hillTitle}
        onConfirm={dismissCampCelebration}
      />
    </div>
  );
}
