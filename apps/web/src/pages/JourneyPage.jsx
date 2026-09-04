import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingBackButton } from './onboarding/OnboardingBackButton';
import { JourneyHillClimbSection } from '../components/JourneyHillClimbSection';
import { JourneyHillDetailSheet } from '../components/JourneyHillDetailSheet';
import { JourneyTabRow } from '../components/JourneyTabRow';
import { api } from '../lib/api';
import { formatHillTitle } from '../lib/hills';
import { JourneyChakraTree, areAllChakrasActivated } from '../components/JourneyChakraTree';
import { JourneyHillsProgress } from '../components/JourneyHillsProgress';
import { TreeSummitCelebration } from '../components/TreeSummitCelebration';
import { useDashboard } from '../context/DashboardContext';

export default function JourneyPage() {
  const navigate = useNavigate();
  const { data, status, error: dashboardError } = useDashboard();
  const [weeklyChakras, setWeeklyChakras] = useState([]);
  const [chakrasReady, setChakrasReady] = useState(false);
  const [treeHighlightHillCode, setTreeHighlightHillCode] = useState(null);
  const [showSummitCopy, setShowSummitCopy] = useState(false);
  const [activeTab, setActiveTab] = useState('chakras');
  const [sheetHillCode, setSheetHillCode] = useState(null);
  const [tabInitialized, setTabInitialized] = useState(false);

  async function loadChakras() {
    try {
      const stats = await api.getFlowWeekChakras();
      setWeeklyChakras(stats?.hills ?? []);
    } catch {
      setWeeklyChakras([]);
    } finally {
      setChakrasReady(true);
    }
  }

  useEffect(() => {
    const STORAGE_KEY = 'gofam_tree_pulse';

    function applyPulse() {
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
      if (!payload?.at || Date.now() - payload.at > 15_000) return;

      setTreeHighlightHillCode(payload.hillCode ?? null);
      void loadChakras();

      const ms = payload.kind === 'daily' ? 2600 : 2000;
      setTimeout(() => {
        setTreeHighlightHillCode(null);
      }, ms);

      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* */
      }
    }

    applyPulse();
    void loadChakras();
    window.addEventListener('gofam_tree_pulse', applyPulse);
    window.addEventListener('storage', applyPulse);
    return () => {
      window.removeEventListener('gofam_tree_pulse', applyPulse);
      window.removeEventListener('storage', applyPulse);
    };
  }, []);

  const allActivated = areAllChakrasActivated(weeklyChakras);
  const todayHill = weeklyChakras.find((h) => h.isToday);
  const todayComplete = Boolean(
    todayHill?.dailyFlowComplete || (todayHill?.prescribedCompleted ?? 0) >= 3,
  );
  const pulseIncomplete = Boolean(todayHill && !todayComplete);

  useEffect(() => {
    if (tabInitialized || !chakrasReady) return;
    setActiveTab(pulseIncomplete ? 'pulse' : 'chakras');
    setTabInitialized(true);
  }, [chakrasReady, pulseIncomplete, tabInitialized]);

  useEffect(() => {
    if (!allActivated) {
      setShowSummitCopy(false);
      return undefined;
    }
    const timer = setTimeout(() => setShowSummitCopy(true), 2200);
    return () => clearTimeout(timer);
  }, [allActivated]);

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }

  function handleSelectHill(hillCode) {
    setSheetHillCode(hillCode);
  }

  const hills = data?.hills ?? [];
  const loading = (!chakrasReady || status === 'loading') && hills.length === 0 && weeklyChakras.length === 0;
  const error = dashboardError && hills.length === 0 ? dashboardError : '';

  if (loading) {
    return (
      <div>
        <OnboardingBackButton onClick={goBack} />
        <div className="flex min-h-[50vh] items-center justify-center px-6">
          <p className="text-sm text-violet-700">Loading your Tree of Life…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <OnboardingBackButton onClick={goBack} />
        <div className="px-6 py-4">
          <h1 className="font-display text-2xl font-semibold text-violet-900">Tree of Life</h1>
          <p className="mt-3 text-sm text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  const hillProgress = hills.map((hill) => ({
    hill: {
      id: hill.code,
      code: hill.code,
      name: hill.name,
      isFocus: hill.isFocus,
    },
    completedSteps: hill.completedSteps ?? 0,
  }));

  return (
    <div>
      <OnboardingBackButton onClick={goBack} />
      <div className="px-6 pb-24 pt-2">
        <h1 className="font-display text-2xl font-semibold text-violet-50">Tree of Life</h1>
        <p className="mt-1 text-sm text-violet-300/90">
          {allActivated
            ? 'Your life is flourishing.'
            : todayHill
              ? `Today’s Home Hill is ${formatHillTitle({ code: todayHill.hillCode, name: todayHill.hillName })}. Tap a chakra for hill details.`
              : 'Complete Home Hill missions to light each chakra — 3 missions activate the glow.'}
        </p>

        {todayHill ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-950/50 px-2.5 py-1 text-[11px] font-semibold text-violet-100">
              Today · {formatHillTitle({ code: todayHill.hillCode, name: todayHill.hillName })}
            </span>
            <span
              className={[
                'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold',
                todayComplete
                  ? 'border border-emerald-500/35 bg-emerald-950/40 text-emerald-200'
                  : 'border border-amber-500/35 bg-amber-950/30 text-amber-100',
              ].join(' ')}
            >
              {todayComplete
                ? 'Flow complete'
                : `${Math.min(3, todayHill.prescribedCompleted ?? todayHill.pulses ?? 0)}/3 missions`}
            </span>
          </div>
        ) : null}

        <div className="sticky top-0 z-10 -mx-6 mt-4 bg-[#07070d]/95 px-6 py-2 backdrop-blur-sm">
          <JourneyTabRow
            activeTab={activeTab}
            onChange={setActiveTab}
            pulseIncomplete={pulseIncomplete}
          />
        </div>

        {activeTab === 'chakras' ? (
          <section className="mt-4">
            {weeklyChakras.length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Chakra progress could not be loaded. Refresh the page.
              </p>
            ) : (
              <>
                <JourneyChakraTree
                  weeklyChakras={weeklyChakras}
                  highlightHillCode={treeHighlightHillCode}
                  allActivated={allActivated}
                  treeLevel={data?.user?.treeLevel ?? 1}
                  onSelectHill={handleSelectHill}
                  compact
                />
                <p className="mt-2 text-center text-[11px] text-violet-400">
                  Tap any chakra or hill label to open climb &amp; missions
                </p>
              </>
            )}
            {allActivated && showSummitCopy ? (
              <div className="mt-4">
                <TreeSummitCelebration />
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === 'climb' ? (
          <section className="mt-4">
            <JourneyHillClimbSection
              dashboardHills={hills}
              growChallenge={data?.growChallenge ?? null}
              journeyView="climb"
              onAfterMissionComplete={() => {
                void loadChakras();
              }}
            />
          </section>
        ) : null}

        {activeTab === 'pulse' ? (
          <section className="mt-4">
            <JourneyHillClimbSection
              dashboardHills={hills}
              growChallenge={data?.growChallenge ?? null}
              journeyView="pulse"
              onAfterMissionComplete={() => {
                void loadChakras();
              }}
            />
          </section>
        ) : null}

        <div className="hidden" aria-hidden="true">
          <JourneyHillsProgress hillProgress={hillProgress} focusHillId={data?.focusHill?.code} />
        </div>
      </div>

      <JourneyHillDetailSheet
        open={Boolean(sheetHillCode)}
        hillCode={sheetHillCode}
        onClose={() => setSheetHillCode(null)}
        dashboardHills={hills}
        growChallenge={data?.growChallenge ?? null}
        onAfterMissionComplete={() => {
          void loadChakras();
        }}
      />
    </div>
  );
}
