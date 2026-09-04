import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Gift,
  Heart,
  Info,
  Leaf,
  Link2,
  Sprout,
  TreeDeciduous,
} from 'lucide-react';
import { api } from '../lib/api';
import { buildInviteMessage } from '../lib/glowInvite';
import { useAuthStore } from '../store/useAuthStore';
import { HarvestHowItWorksModal } from '../components/HarvestHowItWorksModal';

const SORT_OPTIONS = [
  { id: 'recent', label: 'Recently Updated' },
  { id: 'lifetime', label: 'Lifetime Coins' },
  { id: 'harvest', label: 'Harvest Earned' },
  { id: 'name', label: 'Name' },
];

function formatJoinDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function flowStatusLabel(flowIndex, lifetimeCoins) {
  if (lifetimeCoins < 20_000) return { label: 'New', tone: 'blue' };
  if (flowIndex >= 65) return { label: 'Thriving FLOW 🌳', tone: 'emerald' };
  if (flowIndex >= 40) return { label: 'Growing FLOW', tone: 'violet' };
  return { label: 'Unbalanced FLOW ⚠️', tone: 'amber' };
}

function MilestoneSprouts({ achievedThresholds, milestones }) {
  return (
    <div className="flex flex-wrap gap-1">
      {milestones.map((m) => {
        const done = achievedThresholds.includes(m.threshold);
        return (
          <span
            key={m.threshold}
            title={
              done
                ? `+${m.reward.toLocaleString()} at ${m.threshold.toLocaleString()}`
                : `${m.threshold.toLocaleString()} → +${m.reward.toLocaleString()}`
            }
            className={[
              'flex h-6 w-6 items-center justify-center rounded-full text-[10px]',
              done
                ? 'bg-amber-500/25 text-amber-200 ring-1 ring-amber-400/40'
                : 'bg-violet-500/10 text-violet-500/50',
            ].join(' ')}
          >
            {done ? <Check className="h-3 w-3" /> : <Sprout className="h-3 w-3 opacity-60" />}
          </span>
        );
      })}
    </div>
  );
}

function ReferralCard({ refRow, milestones, onViewJourney }) {
  const { user } = refRow;
  const lifetime = user.growthCoinsLifetime ?? 0;
  const flowPct = user.flowIndex ?? 0;
  const status = flowStatusLabel(flowPct, lifetime);
  const progressPct = refRow.nextThreshold
    ? Math.min(100, Math.round((lifetime / refRow.nextThreshold) * 100))
    : 100;

  return (
    <article className="gofam-game-card overflow-hidden p-0">
      <div className="border-b border-violet-500/10 px-3 py-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-500/20 text-sm font-bold text-violet-200">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (user.username?.[0] ?? '?').toUpperCase()
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate font-semibold text-violet-50">@{user.username}</p>
              <span
                className={[
                  'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase',
                  status.tone === 'blue'
                    ? 'bg-sky-500/20 text-sky-200'
                    : status.tone === 'emerald'
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : status.tone === 'amber'
                        ? 'bg-amber-500/20 text-amber-200'
                        : 'bg-violet-500/20 text-violet-200',
                ].join(' ')}
              >
                {status.label}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-violet-400">
              Joined {formatJoinDate(refRow.acceptedAt ?? user.createdAt)}
            </p>
            <p className="mt-1 text-[11px] text-violet-300/90">
              FLOW Index: <span className="font-semibold text-violet-100">{flowPct}%</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onViewJourney(user.id)}
            className="shrink-0 inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200"
          >
            View Journey
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
        <div className="rounded-xl border border-violet-500/10 bg-[#0f0f18] p-2.5">
          <p className="text-[9px] font-bold uppercase tracking-wide text-violet-400">
            Referred member&apos;s progress
          </p>
          <p className="mt-1 font-display text-lg font-semibold tabular-nums text-violet-50">
            {lifetime.toLocaleString()}
          </p>
          <p className="text-[10px] text-violet-400">Lifetime Coins Earned</p>
          {refRow.nextThreshold ? (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-950">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-violet-300/85">
                Next milestone: {refRow.nextThreshold.toLocaleString()} coins
                {refRow.nextMilestoneReward ? (
                  <span className="text-amber-300">
                    {' '}
                    (+{refRow.nextMilestoneReward.toLocaleString()} for you)
                  </span>
                ) : null}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[10px] font-medium text-emerald-300/90">
              All harvest milestones reached 🌳
            </p>
          )}
        </div>

        <div className="rounded-xl border border-emerald-500/15 bg-[#0a1410] p-2.5">
          <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-400/90">
            Your reward
          </p>
          <p className="mt-1 font-display text-lg font-semibold tabular-nums text-emerald-100">
            {refRow.harvestCoinsEarned.toLocaleString()}
          </p>
          <p className="text-[10px] text-emerald-400/80">Harvest Coins Earned</p>
          <p className="mt-2 text-[10px] text-violet-300/80">
            Milestones achieved: {refRow.milestonesAchievedCount ?? refRow.milestonesAchieved?.length ?? 0}
            /{milestones.length}
          </p>
          <div className="mt-2">
            <MilestoneSprouts
              achievedThresholds={refRow.milestonesAchieved ?? []}
              milestones={milestones}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function HarvestRewardsPage() {
  const currentUsername = useAuthStore((s) => s.user?.username);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [journeyUserId, setJourneyUserId] = useState(null);
  const [journeyDetail, setJourneyDetail] = useState(null);
  const [sharingLink, setSharingLink] = useState(false);
  const [shareLinkUrl, setShareLinkUrl] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const shareCopiedTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (shareCopiedTimerRef.current) clearTimeout(shareCopiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const harvest = await api.getHarvestRewards();
        if (!cancelled) {
          setData(harvest);
          if (harvest.activeShareToken) {
            setShareLinkUrl(`${window.location.origin}/invite/glow/${harvest.activeShareToken}`);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load Harvest Rewards');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const milestones = data?.milestones ?? [];
  const referrals = useMemo(() => {
    const list = [...(data?.referrals ?? [])];
    if (sortBy === 'lifetime') {
      list.sort((a, b) => (b.user.growthCoinsLifetime ?? 0) - (a.user.growthCoinsLifetime ?? 0));
    } else if (sortBy === 'harvest') {
      list.sort((a, b) => (b.harvestCoinsEarned ?? 0) - (a.harvestCoinsEarned ?? 0));
    } else if (sortBy === 'name') {
      list.sort((a, b) => (a.user.username ?? '').localeCompare(b.user.username ?? ''));
    } else {
      list.sort(
        (a, b) =>
          new Date(b.acceptedAt ?? b.user.createdAt ?? 0).getTime() -
          new Date(a.acceptedAt ?? a.user.createdAt ?? 0).getTime(),
      );
    }
    return list;
  }, [data?.referrals, sortBy]);

  async function openJourney(userId) {
    setJourneyUserId(userId);
    setJourneyDetail(null);
    try {
      const detail = await api.getPlantedProgress(userId);
      setJourneyDetail(detail);
    } catch (err) {
      setError(err.message || 'Could not load their journey');
      setJourneyUserId(null);
    }
  }

  async function copyInviteToClipboard(url) {
    const inviteText = buildInviteMessage(url, currentUsername);
    if (!navigator.clipboard?.writeText) return false;
    try {
      await navigator.clipboard.writeText(inviteText);
      return true;
    } catch {
      return false;
    }
  }

  function markShareCopied() {
    setShareCopied(true);
    if (shareCopiedTimerRef.current) clearTimeout(shareCopiedTimerRef.current);
    shareCopiedTimerRef.current = setTimeout(() => setShareCopied(false), 2500);
  }

  async function handleCopyInviteLink() {
    setError('');
    try {
      let url = shareLinkUrl;
      if (!url) {
        setSharingLink(true);
        const result = await api.createGlowShareLink(window.location.origin);
        url = result.shareUrl;
        setShareLinkUrl(url);
        setSharingLink(false);
      }

      const copied = await copyInviteToClipboard(url);
      if (copied) {
        markShareCopied();
        return;
      }

      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Join me on GOFAM GROW',
            text: buildInviteMessage(url, currentUsername),
          });
          markShareCopied();
          return;
        } catch {
          /* user cancelled share sheet */
        }
      }

      setError('Could not copy — try again or use Share if your browser offers it.');
    } catch (err) {
      setError(err.message || 'Could not create share link');
    } finally {
      setSharingLink(false);
    }
  }

  if (loading) {
    return <p className="px-4 py-8 text-sm text-violet-300">Loading Harvest Rewards…</p>;
  }

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-start justify-between gap-2">
        <div>
          <Link
            to="/glow"
            className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-200"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back to GLOW
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">
            Harvest Rewards <Leaf className="inline h-3.5 w-3.5" aria-hidden="true" />
          </p>
          <h1 className="font-display text-lg font-semibold leading-snug text-violet-50">
            Celebrate the growth of those you encouraged
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setHowItWorksOpen(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-violet-500/25 bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-violet-200"
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          How it works
        </button>
      </header>

      {error ? (
        <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
      ) : null}

      {/* Hero banner */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-[#0a1814] via-[#0f1a12] to-[#12121c] p-4 shadow-[0_0_32px_rgba(16,185,129,0.08)]">
        <TreeDeciduous
          className="pointer-events-none absolute -right-2 -top-2 h-28 w-28 text-emerald-500/15"
          aria-hidden="true"
        />
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-400/90">
          Your GLOW is Flourishing <Leaf className="inline h-3 w-3" />
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold leading-snug text-violet-50">
          You planted the seed. They are growing.
        </h2>
        <p className="mt-1 text-sm text-violet-300/85">You are harvesting the joy.</p>
        <p className="mt-2 text-[11px] italic text-emerald-300/75">
          {data?.philosophy ?? 'You didn\u2019t build their life. You helped them begin.'}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-emerald-500/20 bg-[#0a1410]/80 px-1 py-2">
            <p className="font-display text-lg font-semibold tabular-nums text-emerald-100">
              {(data?.totalHarvestCoins ?? 0).toLocaleString()}
            </p>
            <p className="text-[8px] font-bold uppercase tracking-wide text-emerald-400/90">
              Total Harvest
            </p>
            <p className="text-[8px] text-violet-500">All time</p>
          </div>
          <div className="rounded-xl border border-violet-500/20 bg-[#100f18]/80 px-1 py-2">
            <p className="font-display text-lg font-semibold tabular-nums text-violet-100">
              {data?.activeReferrals ?? 0}
            </p>
            <p className="text-[8px] font-bold uppercase tracking-wide text-violet-400/90">
              Active
            </p>
            <p className="text-[8px] text-violet-500">People growing</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-[#141008]/80 px-1 py-2">
            <p className="font-display text-lg font-semibold tabular-nums text-amber-100">
              {data?.milestonesAchieved ?? 0}
            </p>
            <p className="text-[8px] font-bold uppercase tracking-wide text-amber-400/90">
              Milestones
            </p>
            <p className="text-[8px] text-violet-500">Total achieved</p>
          </div>
        </div>
      </section>

      {/* Milestone strip */}
      <section className="gofam-game-card p-3">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
          <Sprout className="h-3.5 w-3.5" aria-hidden="true" />
          Harvest reward milestones
        </p>
        <div className="mt-3 -mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2 px-1">
            {milestones.map((m) => (
              <div
                key={m.threshold}
                className="w-[4.5rem] shrink-0 rounded-xl border border-violet-500/15 bg-[#0f0f18] px-2 py-2 text-center"
              >
                <Coins className="mx-auto h-4 w-4 text-amber-400/80" aria-hidden="true" />
                <p className="mt-1 text-[9px] font-semibold text-violet-300">
                  {(m.threshold / 1000).toFixed(0)}K
                </p>
                <p className="text-[10px] font-bold text-amber-200">+{m.reward.toLocaleString()}</p>
              </div>
            ))}
            <div className="w-36 shrink-0 rounded-xl border border-emerald-500/20 bg-emerald-950/30 px-2 py-2">
              <Gift className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <p className="mt-1 text-[9px] font-semibold text-emerald-200">Total possible</p>
              <p className="text-sm font-bold text-emerald-100">
                {(data?.totalPossiblePerReferral ?? 28500).toLocaleString()}
              </p>
              <p className="text-[8px] leading-snug text-emerald-400/80">
                Per referral up to 1M lifetime coins
              </p>
            </div>
          </div>
        </div>
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-violet-500/10 px-2 py-1.5 text-[10px] leading-snug text-violet-300/90">
          <Heart className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" aria-hidden="true" />
          Only direct referrals are eligible. Harvest rewards are based on their lifetime personal
          growth coins — genuine effort only.
        </p>
      </section>

      {/* Referrals list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-violet-50">Your referrals</h2>
          <label className="flex items-center gap-1.5 text-[10px] text-violet-400">
            Sort by
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-violet-500/20 bg-[#14141f] px-2 py-1 text-[10px] font-semibold text-violet-200"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {referrals.length === 0 ? (
          <div className="gofam-game-card py-10 text-center">
            <Sprout className="mx-auto h-10 w-10 text-emerald-500/50" aria-hidden="true" />
            <p className="mt-3 font-display text-base font-semibold text-violet-100">
              No harvest referrals yet
            </p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-violet-400/90">
              When someone you planted a GLOW Seed for joins and grows, their milestones — and your
              thank-you rewards — appear here.
            </p>
            <button
              type="button"
              disabled={sharingLink}
              onClick={handleCopyInviteLink}
              className={[
                'mt-4 inline-flex w-full max-w-xs items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50',
                shareCopied
                  ? 'border-emerald-400/50 bg-emerald-900/40 text-emerald-100'
                  : 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200 hover:border-emerald-400/50 hover:bg-emerald-900/30',
              ].join(' ')}
            >
              {shareCopied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  {sharingLink ? 'Creating link…' : shareLinkUrl ? 'Copy invite again' : 'Copy invite link'}
                </>
              )}
            </button>
          </div>
        ) : (
          referrals.map((refRow) => (
            <ReferralCard
              key={refRow.user.id}
              refRow={refRow}
              milestones={milestones}
              onViewJourney={openJourney}
            />
          ))
        )}
      </section>

      <HarvestHowItWorksModal open={howItWorksOpen} onClose={() => setHowItWorksOpen(false)} />

      {journeyUserId && journeyDetail ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center">
          <div className="max-h-[85dvh] w-full max-w-app overflow-y-auto rounded-3xl border border-violet-500/20 bg-[#12121c] p-5 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">
              Their journey
            </p>
            <h2 className="font-display text-xl font-semibold text-violet-50">
              @{journeyDetail.user.username}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-xl bg-violet-500/10 px-2 py-2">
                <p className="text-lg font-bold text-violet-50">{journeyDetail.user.flowIndex}%</p>
                <p className="text-[10px] text-violet-400">FLOW Index</p>
              </div>
              <div className="rounded-xl bg-amber-500/10 px-2 py-2">
                <p className="text-lg font-bold text-amber-100">
                  {journeyDetail.user.growthCoinsLifetime.toLocaleString()}
                </p>
                <p className="text-[10px] text-amber-400/80">Lifetime coins</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-violet-300">
              Your harvest from them:{' '}
              <span className="font-bold text-emerald-300">
                {journeyDetail.harvestCoinsEarned.toLocaleString()}
              </span>{' '}
              coins
            </p>
            <ul className="mt-2 space-y-1">
              {journeyDetail.milestones.map((m) => (
                <li
                  key={m.threshold}
                  className={[
                    'flex justify-between rounded-lg px-2 py-1.5 text-[11px]',
                    m.achieved ? 'bg-emerald-500/10 text-emerald-100' : 'bg-violet-500/10 text-violet-500',
                  ].join(' ')}
                >
                  <span>{m.threshold.toLocaleString()} lifetime</span>
                  <span>+{m.reward.toLocaleString()}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setJourneyUserId(null);
                setJourneyDetail(null);
              }}
              className="mt-4 w-full rounded-2xl bg-violet-600 py-2.5 text-sm font-semibold text-white"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
