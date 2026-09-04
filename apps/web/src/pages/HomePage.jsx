import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Flag,
  Sprout,
  Star,
  Target,
} from 'lucide-react';
import { FlowIndexGauge } from '../components/FlowIndexGauge';
import { FlowRingDetailCard } from '../components/FlowRingCard';
import { HillCampsSection } from '../components/HillCampsSection';
import { MissedDayRecoveryCard } from '../components/MissedDayRecoveryCard';
import { GrowChallengeCard } from '../components/GrowChallengeCard';
import { FlowLeadershipCard } from '../components/FlowLeadershipCard';
import { CoachWelcomeModal } from '../components/CoachWelcomeModal';
import { CoachMonthlySurpriseModal } from '../components/CoachMonthlySurpriseModal';
import { OrgVerifiedPromptModal } from '../components/OrgVerifiedPromptModal';
import { TodayExtraMissionsSection } from '../components/TodayExtraMissionsSection';
import { TreeOfLife } from '../components/TreeOfLife';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { useDashboard } from '../context/DashboardContext';
import { formatHillTitle } from '../lib/hills';
import {
  dismissCoachWelcome,
  dismissCoachMonthlySurprise,
  isCoachWelcomeDismissed,
  isCoachMonthlySurpriseDismissed,
} from '../lib/coachWelcome';
import { api } from '../lib/api';

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function StatChip({ icon: Icon, value, label, iconClass }) {
  return (
    <div className="gofam-game-card px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconClass}`}
        >
          <Icon className="h-4 w-4 text-white" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-bold leading-tight text-violet-50">{value}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-400">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value, max, className = '' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-violet-900/50 ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500 shadow-[0_0_8px_rgba(167,139,250,0.35)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function SegmentedProgress({ completed, total }) {
  return (
    <div className="mt-1.5 flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={[
            'flex h-7 flex-1 items-center justify-center rounded-lg text-xs font-bold',
            i < completed
              ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.45)]'
              : i === completed
                ? 'border-2 border-violet-400 bg-violet-900/50 text-violet-200'
                : 'bg-violet-900/30 text-violet-400',
          ].join(' ')}
        >
          {i < completed ? '✓' : i + 1}
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { data, status, retrying, error, refresh } = useDashboard();

  const [treeHighlightHillCode, setTreeHighlightHillCode] = useState(null);
  const [treeAmbientMotion, setTreeAmbientMotion] = useState(false);
  const [coachWelcomeOpen, setCoachWelcomeOpen] = useState(false);
  const [coachMonthlyOpen, setCoachMonthlyOpen] = useState(false);
  const [orgVerifiedPrompt, setOrgVerifiedPrompt] = useState(null);
  const [orgVerifiedOpen, setOrgVerifiedOpen] = useState(false);

  useEffect(() => {
    const STORAGE_KEY = 'gofam_tree_pulse';

    function applyFromStorage() {
      let raw = null;
      try {
        raw = localStorage.getItem(STORAGE_KEY);
      } catch {
        return;
      }
      if (!raw) return;

      let payload = null;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }

      const at = payload?.at ?? 0;
      if (!at || Date.now() - at > 15_000) return; // ignore stale pulses

      const hillCode = payload?.hillCode ?? null;
      const kind = payload?.kind ?? 'mission';

      setTreeHighlightHillCode(hillCode);
      setTreeAmbientMotion(kind === 'daily');

      const timeoutMs = kind === 'daily' ? 2600 : 2000;
      window.setTimeout(() => {
        setTreeHighlightHillCode(null);
        setTreeAmbientMotion(false);
      }, timeoutMs);

      // one-shot so it doesn't keep pulsing
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }

    applyFromStorage();
    window.addEventListener('gofam_tree_pulse', applyFromStorage);
    window.addEventListener('storage', applyFromStorage);
    return () => {
      window.removeEventListener('gofam_tree_pulse', applyFromStorage);
      window.removeEventListener('storage', applyFromStorage);
    };
  }, []);

  useEffect(() => {
    if (status !== 'loaded') {
      setCoachWelcomeOpen(false);
      setCoachMonthlyOpen(false);
      return;
    }

    const showWelcome =
      Boolean(data?.coachWelcome) && !isCoachWelcomeDismissed(data.coachWelcome);
    setCoachWelcomeOpen(showWelcome);

    if (showWelcome) {
      setCoachMonthlyOpen(false);
      return;
    }

    const showMonthly =
      Boolean(data?.coachMonthlySurprise) &&
      !isCoachMonthlySurpriseDismissed(data.coachMonthlySurprise);
    setCoachMonthlyOpen(showMonthly);
  }, [status, data?.coachWelcome, data?.coachMonthlySurprise]);

  function handleDismissCoachWelcome() {
    if (data?.coachWelcome) dismissCoachWelcome(data.coachWelcome);
    setCoachWelcomeOpen(false);
  }

  function handleDismissCoachMonthly() {
    if (data?.coachMonthlySurprise) dismissCoachMonthlySurprise(data.coachMonthlySurprise);
    setCoachMonthlyOpen(false);
  }

  useEffect(() => {
    if (status !== 'loaded') {
      setOrgVerifiedPrompt(null);
      setOrgVerifiedOpen(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const belonging = await api.getBelongingOverview();
        if (!cancelled) setOrgVerifiedPrompt(belonging.prompts?.[0] ?? null);
      } catch {
        if (!cancelled) setOrgVerifiedPrompt(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (!orgVerifiedPrompt || coachWelcomeOpen || coachMonthlyOpen) {
      setOrgVerifiedOpen(false);
      return;
    }
    setOrgVerifiedOpen(true);
  }, [orgVerifiedPrompt, coachWelcomeOpen, coachMonthlyOpen]);

  async function handleDismissOrgVerified() {
    if (orgVerifiedPrompt?.organizationId) {
      try {
        await api.acknowledgeOrgVerifiedPrompt(orgVerifiedPrompt.organizationId);
      } catch {
        /* dismiss locally anyway */
      }
    }
    setOrgVerifiedOpen(false);
    setOrgVerifiedPrompt(null);
  }

  useEffect(() => {
    if (status !== 'loaded' || !data?.blockingMissedDay) return;
    if (window.location.hash !== '#missed-day') return;
    document.getElementById('missed-day')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [status, data?.blockingMissedDay]);

  useEffect(() => {
    if (status === 'loaded' && data?.gapCompleted === false) {
      navigate('/onboarding', { replace: true });
    }
  }, [status, data?.gapCompleted, navigate]);

  if (status === 'loading') {
    return <DashboardSkeleton />;
  }

  if (status === 'error' || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-rose-700">Couldn&apos;t load your dashboard</p>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        <button
          type="button"
          onClick={refresh}
          disabled={retrying}
          className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-violet-300"
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    );
  }

  const {
    user = {},
    hills = [],
    flowRing = null,
    focusHill = null,
    todayHillCode = null,
    todaysFocusMission = null,
    weeklyMissions = { completed: 0, total: 7 },
    notificationCount = 0,
    campStreak = null,
    blockingMissedDay = null,
    extraMissionsToday = null,
    growChallenge = null,
    coachWelcome = null,
    coachMonthlySurprise = null,
  } = data;

  const safeHills = Array.isArray(hills) ? hills : [];
  const todayHill = todayHillCode ? safeHills.find((h) => h.code === todayHillCode) : null;
  const isFlowToday = weeklyMissions?.mode === 'flow_today';
  const walletCoins = Number.isFinite(Number(user.walletCoins)) ? Number(user.walletCoins) : 0;
  const seedInventoryCount = Number.isFinite(Number(user.seedInventoryCount))
    ? Number(user.seedInventoryCount)
    : 0;

  return (
    <div className="space-y-3">
      <CoachWelcomeModal
        open={coachWelcomeOpen}
        welcome={coachWelcome}
        onDismiss={handleDismissCoachWelcome}
      />
      <CoachMonthlySurpriseModal
        open={coachMonthlyOpen}
        surprise={coachMonthlySurprise}
        onDismiss={handleDismissCoachMonthly}
      />
      <OrgVerifiedPromptModal
        open={orgVerifiedOpen}
        prompt={orgVerifiedPrompt}
        onDismiss={handleDismissOrgVerified}
      />
      <header>
        <h1 className="font-display text-xl font-semibold text-violet-50">
          {timeGreeting()}, {user.displayName || user.username}! 👋
        </h1>
        <p className="mt-0.5 text-sm text-violet-300/90">Let&apos;s master the flow today.</p>
      </header>

      {notificationCount > 0 ? (
        <Link
          to={
            coachWelcome?.phase === 'pending_seed' && coachWelcome.seedId
              ? `/glow?openSeed=${encodeURIComponent(coachWelcome.seedId)}`
              : coachMonthlySurprise?.seedId
                ? `/glow?openSeed=${encodeURIComponent(coachMonthlySurprise.seedId)}`
                : '/glow'
          }
          className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <div>
            <p className="text-sm font-semibold text-amber-950">
              {notificationCount === 1
                ? 'You have a request waiting'
                : `${notificationCount} requests waiting`}
            </p>
            <p className="mt-0.5 text-xs text-amber-800/80">
              Open GLOW to join a family or bloom a Glow Seed.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">
            Open
          </span>
        </Link>
      ) : null}

      <GrowChallengeCard challenge={growChallenge} />

      <div className="grid grid-cols-2 gap-2">
        <StatChip
          icon={Star}
          value={walletCoins.toLocaleString()}
          label="Coins"
          iconClass="bg-[#F59E0B]"
        />
        <StatChip
          icon={Sprout}
          value={seedInventoryCount}
          label="GLOW Seeds"
          iconClass="bg-[#22C55E]"
        />
      </div>

      <TreeOfLife
        hills={safeHills}
        focusHillCode={focusHill?.code}
        highlightHillCode={treeHighlightHillCode}
        ambientMotion={treeAmbientMotion}
        treeLevel={user.treeLevel ?? 1}
      />

      <div className="grid grid-cols-2 gap-3">
        <section className="gofam-game-card flex flex-col items-center justify-center px-2 py-3">
          <FlowIndexGauge value={user.flowIndex} label="FLOW Index" size={96} />
          <p className="mt-1 text-center text-[9px] leading-snug text-violet-400">
            Building my flow · Keep going!
          </p>
        </section>

        <FlowRingDetailCard flowRing={flowRing} hills={safeHills} compact />
      </div>
      <section className="gofam-game-card p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 shadow-[0_0_12px_rgba(124,58,237,0.4)]">
            <Target className="h-4 w-4 text-white" aria-hidden="true" />
          </span>
          <h2 className="font-display text-base font-semibold text-violet-50">
            {weeklyMissions?.mode === 'flow_today' ? "Today's missions" : 'This step'}
          </h2>
        </div>
        <p className="mt-2 text-sm font-semibold text-violet-200">
          {weeklyMissions.thisWeekComplete
            ? weeklyMissions?.mode === 'flow_today'
              ? 'Today complete — Daily FLOW done'
              : 'This week complete'
            : weeklyMissions?.mode === 'flow_today'
              ? `${weeklyMissions.completed} / ${weeklyMissions.total} missions today`
              : `${weeklyMissions.completed} / ${weeklyMissions.total} mission this week`}
        </p>
        <ProgressBar
          className="mt-1.5"
          value={weeklyMissions.completed}
          max={weeklyMissions.total}
        />
        {weeklyMissions.thisWeekComplete && weeklyMissions.opensAt ? (
          <p className="mt-2 text-xs text-violet-600">
            Next mission opens {new Date(weeklyMissions.opensAt).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        ) : null}
        {isFlowToday && todayHill ? (
          <>
            <p className="mt-3 flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-violet-400">
                Today&apos;s Home Hill
              </span>
              <span className="text-sm font-semibold text-violet-100">
                {formatHillTitle(todayHill)}
              </span>
            </p>
            <SegmentedProgress
              completed={weeklyMissions.completed}
              total={weeklyMissions.total}
            />
          </>
        ) : focusHill ? (
          <>
            <p className="mt-3 flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-violet-500">
                Focus Hill Progress
              </span>
              <span className="text-sm font-semibold text-violet-900">
                {formatHillTitle(focusHill)}
              </span>
            </p>
            <SegmentedProgress
              completed={focusHill.missionsCompletedThisStep ?? focusHill.missionsCompletedThisWeek}
              total={focusHill.missionsRequiredThisStep ?? focusHill.missionsRequiredThisWeek}
            />
          </>
        ) : null}
        <TodayExtraMissionsSection extraMissionsToday={extraMissionsToday} />
      </section>

      <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7C3AED]">
            <Flag className="h-4 w-4 text-white" aria-hidden="true" />
          </span>
          <h2 className="font-display text-base font-semibold text-slate-900">Today&apos;s Focus</h2>
        </div>
        {todaysFocusMission ? (
          <>
            <p className="mt-2 font-semibold text-violet-900">{todaysFocusMission.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-violet-800/75">
              {todaysFocusMission.description}
            </p>
            <Link
              to="/missions"
              className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/25 transition hover:bg-violet-700"
            >
              View Missions
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-violet-800/75">All caught up! 🎉</p>
            <Link
              to="/journey"
              className="mt-3 inline-flex text-sm font-semibold text-violet-700 hover:text-violet-900"
            >
              View Tree of Life →
            </Link>
          </>
        )}
      </section>

      <MissedDayRecoveryCard
        blockingMissedDay={blockingMissedDay}
        campStreak={campStreak}
        onResolved={refresh}
        onCompleteMissedMissions={(dayIndex) => navigate(`/missions?missedDay=${dayIndex}`)}
      />

      <HillCampsSection
        hills={safeHills}
        todayHillCode={todayHillCode}
        focusHillCode={focusHill?.code}
        campStreak={campStreak}
      />
    </div>
  );
}
