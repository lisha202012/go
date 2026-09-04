import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  Heart,
  Link2,
  MessageCircle,
  Send,
  Sparkles,
  Sprout,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { useDashboard } from '../context/DashboardContext';
import { HILL_DOMAINS } from '../lib/hills';
import { buildInviteMessage } from '../lib/glowInvite';
import { GrowChallengeProgress } from '../components/GrowChallengeProgress';

const VIRTUE_EMOJI = {
  Kindness: '❤️',
  Responsibility: '🧡',
  Discipline: '💛',
  Integrity: '💚',
  HardWork: '💙',
  Courage: '🔷',
  Patience: '🟣',
};

const VIRTUE_HILL = {
  Kindness: HILL_DOMAINS.HOPE,
  Responsibility: HILL_DOMAINS.HONE,
  Discipline: HILL_DOMAINS.HOLD,
  Integrity: HILL_DOMAINS.HOOD,
  HardWork: HILL_DOMAINS.HOST,
  Courage: HILL_DOMAINS.HORN,
  Patience: HILL_DOMAINS.HOOK,
};

function InstagramIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const OUTCOME_COPY = {
  both: 'This seed activated the virtue for both of you — mission coins on that hill are ×2 until month-end.',
  receiver: 'This seed activated the virtue for you — mission coins on that hill are ×2 until month-end.',
  giver: 'This seed activated the virtue for the giver — their hill coins are ×2 until month-end.',
  neither: 'That hill was already boosted this month for both of you. ×2 does not stack.',
  coachGift:
    'GoFam Coach Bala shared this virtue with you — it’s now in your collection.',
  coachGiftNoBoost: 'You already had this virtue in your collection.',
};

export default function GlowPage() {
  const updateUser = useAuthStore((s) => s.updateUser);
  const currentUsername = useAuthStore((s) => s.user?.username);
  const { refresh: refreshDashboard, data: dashboardData } = useDashboard();
  const growChallenge = dashboardData?.growChallenge ?? null;
  const [hub, setHub] = useState(null);
  const [pendingFamilySent, setPendingFamilySent] = useState([]);
  const [familyJoined, setFamilyJoined] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [sendError, setSendError] = useState('');
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState([]);
  const [friendsView, setFriendsView] = useState('friends');
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [bloom, setBloom] = useState(null);
  const [coachBloomPhase, setCoachBloomPhase] = useState(0);
  const [openingId, setOpeningId] = useState(null);
  const [acceptingInviteId, setAcceptingInviteId] = useState(null);
  const [sharingLink, setSharingLink] = useState(false);
  const [shareLinkUrl, setShareLinkUrl] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const shareCopiedTimerRef = useRef(null);
  const [viewingSprout, setViewingSprout] = useState(null);
  const [sproutDetail, setSproutDetail] = useState(null);
  const [seedActivityOpen, setSeedActivityOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const autoOpenSeedRef = useRef(null);

  async function load() {
    setLoadError('');
    try {
      const [data, familyRes] = await Promise.all([
        api.getGlowHub(),
        api.getFamilyMembers().catch(() => ({ members: [] })),
      ]);
      setHub(data);
      if (data.activeShareToken) {
        setShareLinkUrl(`${window.location.origin}/invite/glow/${data.activeShareToken}`);
      }
      const members = familyRes.members ?? [];
      const meName = (useAuthStore.getState().user?.username || '').toLowerCase();
      const meId = useAuthStore.getState().user?.id;
      setFamilyJoined(
        members.filter((m) => {
          if (m.status !== 'active') return false;
          const username = (m.user?.username || m.inviteUsername || '').toLowerCase();
          if (meName && username === meName) return false;
          if (meId && m.user?.id === meId) return false;
          return true;
        }),
      );
      setPendingFamilySent(
        members.filter((m) => {
          if (m.status !== 'pending') return false;
          const invitedName = (m.inviteUsername || m.user?.username || '').toLowerCase();
          if (meName && invitedName === meName) return false;
          const byId = m.invitedBy?.id && meId && m.invitedBy.id === meId;
          const byName =
            m.invitedBy?.username &&
            meName &&
            m.invitedBy.username.toLowerCase() === meName;
          return Boolean(byId || byName);
        }),
      );
      const current = useAuthStore.getState().user;
      if (current) updateUser({ ...current, seedInventoryCount: data.inventoryCount });
    } catch (err) {
      setLoadError(err.message || 'Could not load GLOW');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => {
      if (shareCopiedTimerRef.current) clearTimeout(shareCopiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const q = query.trim().replace(/^@/, '');
    setSendError('');

    if (!q) {
      setPeople([]);
      setSearchError('');
      return;
    }

    const selfName = currentUsername?.toLowerCase() ?? '';
    if (selfName && (q.toLowerCase() === selfName || `@${q.toLowerCase()}` === `@${selfName}`)) {
      setPeople([]);
      setSearchError('That’s you — type another member’s username.');
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await api.searchGlowPeople(q);
        if (cancelled) return;
        const matches = result.people ?? [];
        const others = matches.filter(
          (p) => p.username.toLowerCase() !== currentUsername?.toLowerCase(),
        );
        setPeople(others);
        const self = currentUsername?.toLowerCase() ?? '';
        const lookingAtSelf = Boolean(self) && self.includes(q.toLowerCase());
        if (others.length === 0 && lookingAtSelf) {
          setSearchError('That’s you — type another member’s username.');
        } else if (others.length === 0) {
          setSearchError(`No members match “${q}”.`);
        } else {
          setSearchError('');
        }
      } catch (err) {
        if (cancelled) return;
        setPeople([]);
        setSearchError(err.message || 'Search failed. Try again.');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, currentUsername]);

  const collectedCount = hub?.collectedCount ?? 0;
  const sevenComplete = hub?.sevenVirtuesComplete;
  const pendingInbox = hub?.pendingReceived ?? [];
  const pendingGlowSent = hub?.pendingSent ?? [];
  const recentBlooms = hub?.recentBlooms ?? [];
  const inventoryCount = hub?.inventoryCount ?? 0;
  const inventoryMax = hub?.inventoryMax ?? 49;
  const sentThisMonth = hub?.sentThisMonth ?? 0;
  const usedThisMonth = hub?.usedThisMonth ?? 0;
  const notUsedThisMonth = hub?.notUsedThisMonth ?? 0;
  const monthlyLimit = hub?.monthlyLimit ?? 49;
  const inventoryFree = hub?.inventoryFree ?? Math.max(0, monthlyLimit - sentThisMonth);
  const sentEmpty = pendingGlowSent.length === 0 && pendingFamilySent.length === 0;
  const hasActivity = !sentEmpty || pendingInbox.length > 0 || recentBlooms.length > 0;
  const friendsList = hub?.friends ?? [];
  const familyList = familyJoined ?? [];
  const activeFriendsList = friendsView === 'family' ? familyList : friendsList;

  async function handleSend(toUsername) {
    setSending(true);
    setSendError('');
    setSearchError('');
    try {
      const result = await api.sendGlowSeed(toUsername);
      setQuery('');
      setPeople([]);
      await load();
      if (result.autoBloom) {
        setCoachBloomPhase(0);
        setBloom({
          kind: 'coachAutoBloom',
          virtue: result.autoBloom.virtue,
          virtueLabel: result.autoBloom.virtueLabel,
          outcome: result.autoBloom.outcome ?? (result.autoBloom.senderActivated ? 'giver' : 'neither'),
          qualifying: result.autoBloom.qualifying,
        });
        await refreshDashboard();
      } else {
        setBloom({ kind: 'sent', message: result.message });
      }
    } catch (err) {
      setSendError(err.message || 'Could not send Glow Seed');
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (bloom?.kind !== 'coachAutoBloom') {
      setCoachBloomPhase(0);
      return undefined;
    }
    if (coachBloomPhase >= 2) return undefined;
    const delay = coachBloomPhase === 0 ? 900 : 1100;
    const timer = window.setTimeout(() => {
      setCoachBloomPhase((p) => p + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [bloom?.kind, coachBloomPhase]);

  async function handleOpen(seedId) {
    setOpeningId(seedId);
    setSendError('');
    try {
      const result = await api.acceptGlowSeed(seedId);
      setBloom({
        kind: 'bloom',
        virtue: result.virtue,
        virtueLabel: result.virtueLabel,
        outcome: result.outcome,
        coachGift: result.coachGift,
        sevenVirtuesJustCompleted: result.sevenVirtuesJustCompleted,
        sender: result.sender,
      });
      await load();
      await refreshDashboard();
    } catch (err) {
      setSendError(err.message || 'Could not open Glow Seed');
    } finally {
      setOpeningId(null);
    }
  }

  useEffect(() => {
    const seedId = searchParams.get('openSeed');
    if (!seedId || loading || !hub) return;
    if (autoOpenSeedRef.current === seedId) return;

    const isPending = (hub.pendingReceived ?? []).some((s) => s.id === seedId);
    autoOpenSeedRef.current = seedId;
    setSearchParams({}, { replace: true });

    if (isPending) {
      void handleOpen(seedId);
    }
  }, [loading, hub, searchParams, setSearchParams]);

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

  async function handleShareOutside() {
    setSendError('');
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
        setBloom({
          kind: 'linkCopied',
          message: 'Invite copied — paste it in WhatsApp, SMS, or email.',
        });
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

      setSendError('Could not copy — try again or use Share if your browser offers it.');
    } catch (err) {
      setSendError(err.message || 'Could not create share link');
    } finally {
      setSharingLink(false);
    }
  }

  function openSocialShare(channel) {
    if (!shareLinkUrl) return;
    const text = buildInviteMessage(shareLinkUrl, currentUsername);
    const shareUrls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLinkUrl)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareLinkUrl)}`,
    };
    const target = shareUrls[channel];
    if (target) window.open(target, '_blank', 'noopener,noreferrer');
  }

  async function shareToInstagram() {
    if (!shareLinkUrl) return;
    const copied = await copyInviteToClipboard(shareLinkUrl);
    if (copied) markShareCopied();
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
  }

  async function openSproutJourney(userId) {
    setViewingSprout(userId);
    setSproutDetail(null);
    try {
      const detail = await api.getPlantedProgress(userId);
      setSproutDetail(detail);
    } catch (err) {
      setSendError(err.message || 'Could not load their journey');
      setViewingSprout(null);
    }
  }

  if (loading && !hub) {
    return <p className="px-4 py-8 text-sm text-violet-700">Loading GLOW…</p>;
  }

  return (
    <div className="space-y-4 pb-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">Share the GLOW</p>
        <h1 className="font-display text-2xl font-semibold text-violet-50">Glow Seeds</h1>
      </header>

      {loadError ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>
      ) : null}
      {sendError ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{sendError}</p>
      ) : null}

      {growChallenge ? (
        <section className="gofam-game-card border-violet-500/25 bg-gradient-to-br from-[#101018] to-[#12121c] px-3 py-3">
          <GrowChallengeProgress challenge={growChallenge} size="compact" />
          <p className="mt-2 text-[10px] leading-snug text-violet-400/90">
            Seeds earned toward your 30-day challenge — separate from inventory below (sending seeds
            does not reduce this count).
          </p>
        </section>
      ) : null}

      <section className="gofam-game-card border-emerald-500/25 bg-gradient-to-br from-[#0a1814] to-[#12121c] px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
            <Sprout className="h-4 w-4" aria-hidden="true" />
            Inventory
          </p>
          <p className="font-display text-xl font-semibold tabular-nums text-emerald-200">
            {inventoryCount}
            <span className="text-sm font-medium text-emerald-400/80"> / {inventoryMax}</span>
          </p>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-lg border border-emerald-500/15 bg-[#0f1412] px-1.5 py-1.5">
              <p className="text-sm font-bold tabular-nums text-emerald-200">{sentThisMonth}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-400/90">Sent</p>
          </div>
          <div className="rounded-lg border border-amber-500/15 bg-[#141008] px-1.5 py-1.5">
              <p className="text-sm font-bold tabular-nums text-amber-200">{usedThisMonth}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-amber-400/90">Used</p>
          </div>
          <div className="rounded-lg border border-violet-500/15 bg-[#100f18] px-1.5 py-1.5">
              <p className="text-sm font-bold tabular-nums text-violet-200">{notUsedThisMonth}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-violet-400/90">Not Used</p>
          </div>
        </div>
        <button
          type="button"
          disabled={sharingLink}
          onClick={handleShareOutside}
          className={[
            'mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-50',
            shareCopied
              ? 'border-emerald-400/50 bg-emerald-900/40 text-emerald-100'
              : 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200 hover:border-emerald-400/50 hover:bg-emerald-900/30',
          ].join(' ')}
        >
          {shareCopied ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              {sharingLink ? 'Creating link…' : shareLinkUrl ? 'Copy invite again' : 'Share link outside the app'}
            </>
          )}
        </button>
        {shareLinkUrl ? (
          <div className="mt-2 grid grid-cols-4 gap-1.5" aria-label="Share invite options">
            <button
              type="button"
              onClick={shareToInstagram}
              className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-pink-400/25 bg-pink-950/30 px-1.5 text-[10px] font-semibold text-pink-200 transition hover:border-pink-300/50 hover:bg-pink-900/40"
              title="Copy the invite and open Instagram"
            >
              <InstagramIcon />
              Instagram
            </button>
            <button
              type="button"
              onClick={() => openSocialShare('whatsapp')}
              className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-950/30 px-1.5 text-[10px] font-semibold text-emerald-200 transition hover:border-emerald-300/50 hover:bg-emerald-900/40"
              title="Share on WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => openSocialShare('facebook')}
              className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-blue-400/25 bg-blue-950/30 px-1.5 text-[10px] font-semibold text-blue-200 transition hover:border-blue-300/50 hover:bg-blue-900/40"
              title="Share on Facebook"
            >
              <span className="text-sm font-bold leading-none" aria-hidden="true">f</span>
              Facebook
            </button>
            <button
              type="button"
              onClick={() => openSocialShare('x')}
              className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-slate-400/25 bg-slate-950/30 px-1.5 text-[10px] font-semibold text-slate-200 transition hover:border-slate-300/50 hover:bg-slate-900/40"
              title="Share on X"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              X
            </button>
          </div>
        ) : null}
      </section>

      {hub?.harvest ? (
        <section className="gofam-game-card border-emerald-500/20 bg-gradient-to-br from-[#0a1814] to-[#12121c] p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-emerald-200">Harvest Rewards</h2>
              <p className="text-[10px] text-violet-300/80">
                Thank you for planting seeds that help others begin.
              </p>
            </div>
            <Sprout className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded-lg border border-emerald-500/15 bg-[#0f1412] px-1.5 py-1.5">
              <p className="text-sm font-bold tabular-nums text-emerald-200">
                {hub.harvest.activeReferrals}
              </p>
              <p className="text-[9px] font-semibold uppercase text-emerald-400/90">People Growing</p>
            </div>
            <div className="rounded-lg border border-violet-500/15 bg-[#100f18] px-1.5 py-1.5">
              <p className="text-sm font-bold tabular-nums text-violet-200">
                {hub.harvest.activeReferrals}
              </p>
              <p className="text-[9px] font-semibold uppercase text-violet-400/90">Active</p>
            </div>
            <div className="rounded-lg border border-amber-500/15 bg-[#141008] px-1.5 py-1.5">
              <p className="text-sm font-bold tabular-nums text-amber-200">
                {hub.harvest.milestonesAchieved}
              </p>
              <p className="text-[9px] font-semibold uppercase text-amber-400/90">Milestones</p>
            </div>
          </div>
          <Link
            to="/harvest"
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-950/40 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400/50"
          >
            Open Harvest Rewards
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      {(friendsList.length > 0 || familyList.length > 0) ? (
        <section className="rounded-2xl border border-violet-100 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-950">
              <Users className="h-4 w-4" aria-hidden="true" />
              {friendsView === 'family' ? 'Family' : 'Friends'}
            </h2>
            <select
              value={friendsView}
              onChange={(e) => setFriendsView(e.target.value)}
              className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-800 outline-none focus:border-violet-400"
              aria-label="Choose friends or family list"
            >
              <option value="friends">Friends</option>
              <option value="family">Family</option>
            </select>
          </div>
          {friendsView === 'family' && familyList.length === 0 ? (
            <p className="mt-2 text-xs text-violet-600">No family members added yet.</p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {friendsView === 'family'
                ? familyList.map((member) => {
                    const username = member.user?.username || member.inviteUsername || '';
                    const display = member.displayName || username || 'Family member';
                    return (
                      <li key={member.id} className="flex items-center justify-between gap-2 text-xs text-violet-800">
                        <span className="min-w-0 truncate font-semibold">
                          {display}
                          {username ? <span className="ml-1 text-violet-500">@{username}</span> : null}
                        </span>
                      </li>
                    );
                  })
                : friendsList.map((row) => {
                    const friend = row.friend;
                    const displayName = friend.displayName || friend.username;
                    return (
                      <li key={row.friendshipId} className="flex items-center justify-between gap-2 text-xs text-violet-800">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-violet-200 bg-violet-100 text-[10px] font-bold text-violet-700">
                            {friend.avatarUrl ? (
                              <img src={friend.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center">
                                {(friend.username?.[0] ?? '?').toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-violet-900">{displayName}</p>
                            <p className="truncate text-[11px] text-violet-500">@{friend.username}</p>
                          </div>
                        </div>
                        {row.friend.officialAccount ? (
                          <span className="shrink-0 font-medium text-emerald-700">✓ Official</span>
                        ) : null}
                      </li>
                    );
                  })}
            </ul>
          )}
        </section>
      ) : null}

      {hasActivity ? (
        <>
          <section className="rounded-2xl border border-violet-100 bg-white p-3 shadow-sm">
            <button
              type="button"
              onClick={() => setSeedActivityOpen(true)}
              className="w-full text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-violet-950">Seed activity</h2>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                  View
                </span>
              </div>
              <p className="mt-2 text-xs text-violet-600">
                {pendingInbox.length > 0
                  ? `${pendingInbox.length} seed${pendingInbox.length === 1 ? '' : 's'} waiting to bloom`
                  : recentBlooms.length > 0
                    ? `${recentBlooms.length} recent bloom${recentBlooms.length === 1 ? '' : 's'}`
                    : 'Recent seed updates'}
              </p>
            </button>
          </section>

          {seedActivityOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-violet-950/50 p-4 backdrop-blur-[1px]">
              <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-violet-200 bg-white p-4 shadow-2xl">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-violet-950">Seed activity</h2>
                  <button
                    type="button"
                    onClick={() => setSeedActivityOpen(false)}
                    className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700"
                  >
                    Close
                  </button>
                </div>

                {pendingInbox.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      Received · open to bloom
                    </p>
                    <ul className="mt-1 divide-y divide-amber-50">
                      {pendingInbox.map((seed) => (
                        <li key={seed.id} className="flex items-center justify-between gap-2 py-1.5">
                          <p className="min-w-0 text-xs text-violet-900">
                            {seed.coachGift && seed.seedKind === 'welcome_coach' ? (
                              <>
                                <span className="block font-semibold text-emerald-800">
                                  {seed.sender.displayName || 'GoFam Coach Bala'} sent your welcome seed
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-snug text-violet-600">
                                  Open it to bloom your first virtue on the Tree of Life.
                                </span>
                              </>
                            ) : seed.coachGift && seed.seedKind === 'monthly_coach' ? (
                              <>
                                <span className="block font-semibold text-amber-800">
                                  Surprise from {seed.sender.displayName || 'GoFam Coach Bala'}
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-snug text-amber-700/90">
                                  A spontaneous monthly gift — open to add a virtue to your collection.
                                </span>
                              </>
                            ) : seed.coachGift ? (
                              <>
                                <span className="block font-semibold">
                                  From {seed.sender.displayName || `@${seed.sender.username}`}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-violet-500">
                                  Coach gift · adds a virtue to your collection
                                </span>
                              </>
                            ) : (
                              <>
                                From <span className="font-semibold">@{seed.sender.username}</span>
                                <span className="text-violet-500"> · waiting to bloom</span>
                              </>
                            )}
                          </p>
                          <button
                            type="button"
                            disabled={openingId === seed.id}
                            onClick={() => handleOpen(seed.id)}
                            className="shrink-0 rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                          >
                            {openingId === seed.id ? '…' : 'Open'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {(pendingGlowSent.length > 0 || pendingFamilySent.length > 0) ? (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">
                      You sent · waiting
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {pendingFamilySent.map((member) => {
                        const name = member.displayName || member.inviteUsername || 'Family member';
                        const username = member.inviteUsername || member.user?.username;
                        return (
                          <li key={member.id} className="truncate text-xs text-violet-800">
                            To <span className="font-semibold">{username ? `@${username}` : name}</span>
                            <span className="text-violet-500"> · join pending</span>
                          </li>
                        );
                      })}
                      {pendingGlowSent.map((seed) => (
                        <li key={seed.id} className="truncate text-xs text-violet-800">
                          To <span className="font-semibold">@{seed.receiver.username}</span>
                          <span className="text-violet-500">
                            {seed.channel === 'external' ? ' · signed up, waiting to bloom' : ' · waiting to bloom'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {recentBlooms.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      Bloomed
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {recentBlooms.map((b) => (
                        <li key={b.id} className="py-1 text-xs text-violet-800">
                          {b.welcomeCoach && b.role === 'received' ? (
                            <>
                              <span className="block font-semibold text-emerald-800">
                                {b.withDisplayName || 'GoFam Coach Bala'} welcomed you
                              </span>
                              <span className="mt-0.5 block text-[11px] leading-snug text-emerald-700">
                                {VIRTUE_EMOJI[b.virtue] ?? '🌸'} {b.virtueLabel || b.virtue} added to
                                your virtue collection
                                {b.bloomedAt
                                  ? ` · ${new Date(b.bloomedAt).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                    })}`
                                  : ''}
                              </span>
                            </>
                          ) : b.monthlyCoach && b.role === 'received' ? (
                            <>
                              <span className="block font-semibold text-amber-800">
                                {b.withDisplayName || 'GoFam Coach Bala'} sent a surprise gift
                              </span>
                              <span className="mt-0.5 block text-[11px] leading-snug text-amber-700">
                                {VIRTUE_EMOJI[b.virtue] ?? '🌸'} {b.virtueLabel || b.virtue} added to
                                your virtue collection
                                {b.bloomedAt
                                  ? ` · ${new Date(b.bloomedAt).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                    })}`
                                  : ''}
                              </span>
                            </>
                          ) : b.coachGift && b.role === 'received' ? (
                            <>
                              <span className="block font-semibold text-emerald-800">
                                {b.withDisplayName || `@${b.with}`} shared a virtue with you
                              </span>
                              <span className="mt-0.5 block text-[11px] text-emerald-700">
                                {VIRTUE_EMOJI[b.virtue] ?? '🌸'} {b.virtueLabel || b.virtue}
                                {b.bloomedAt
                                  ? ` · ${new Date(b.bloomedAt).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                    })}`
                                  : ''}
                              </span>
                            </>
                          ) : (
                            <span className="block truncate">
                              {b.role === 'gave' ? (
                                <>
                                  You → <span className="font-semibold">@{b.with}</span>
                                </>
                              ) : (
                                <>
                                  <span className="font-semibold">@{b.with}</span> → you
                                </>
                              )}
                              <span className="text-emerald-700">
                                {' · '}
                                {VIRTUE_EMOJI[b.virtue] ?? '🌸'} {b.virtueLabel || b.virtue}
                                {b.bloomedAt
                                  ? ` · ${new Date(b.bloomedAt).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                    })}`
                                  : ''}
                              </span>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {familyJoined.length > 0 ? (
        <section className="rounded-2xl border border-emerald-100 bg-white p-3">
          <h2 className="text-sm font-semibold text-violet-950">Your family</h2>
          <ul className="mt-1.5 space-y-1">
            {familyJoined.map((member) => {
              const name =
                member.displayName || member.user?.username || member.inviteUsername || 'Family member';
              const username = member.user?.username || member.inviteUsername;
              return (
                <li key={member.id} className="truncate text-xs text-violet-800">
                  <span className="font-semibold">{name}</span>
                  {username ? ` · @${username}` : ''}
                  {member.role ? ` · ${member.role}` : ''}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-violet-100 bg-white p-3 shadow-sm">
        <h2 className="text-sm font-semibold text-violet-950">Send a Glow Seed</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search username"
          className="mt-2 w-full rounded-xl border border-violet-200 px-3 py-2.5 text-sm text-violet-900 outline-none focus:border-violet-400"
          autoComplete="off"
        />

        {searching ? (
          <p className="mt-2 text-xs text-violet-500">Searching…</p>
        ) : null}
        {searchError ? (
          <p className="mt-2 text-xs font-medium text-amber-800">{searchError}</p>
        ) : null}

        {people.length > 0 ? (
          <ul className="mt-2 divide-y divide-violet-100 overflow-hidden rounded-xl border border-violet-100">
            {people.map((p) => {
              const noInventory = inventoryCount < 1;
              const monthlyCap = sentThisMonth >= monthlyLimit;
              const peerNoSeed = p.hasGlowSeedInventory === false;
              const disabled =
                sending || p.alreadyHasGlowSeed || noInventory || monthlyCap || peerNoSeed;
              const actionLabel = sending
                ? 'Sending…'
                : p.alreadyHasGlowSeed
                  ? 'Has seed'
                  : peerNoSeed
                    ? 'Needs a seed'
                    : monthlyCap
                      ? 'Monthly limit'
                      : noInventory
                        ? 'Need a seed'
                        : 'Tap to send';
              return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSend(p.username)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-emerald-50 disabled:opacity-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (p.username?.[0] ?? '?').toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-violet-900">@{p.username}</span>
                    <span className="mt-0.5 block text-[11px] text-violet-600">
                      {peerNoSeed
                        ? 'No Glow Seed yet — cannot receive'
                        : p.alreadyHasGlowSeed && p.referredBy?.username
                          ? `Has a seed from @${p.referredBy.username}`
                          : `FLOW ${p.flowIndex ?? 0}% · can receive`}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-emerald-700">
                    {actionLabel}
                  </span>
                </button>
              </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section className="rounded-2xl border border-violet-100 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-violet-950">Virtue collection</h2>
          <p className="text-xs font-semibold text-violet-600">{collectedCount} / 7</p>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          {(hub?.collection ?? []).map((item) => {
            const hill = VIRTUE_HILL[item.virtue];
            return (
            <div
              key={item.virtue}
              className={[
                'flex items-center justify-between rounded-xl px-3 py-2 text-sm',
                item.collected ? 'bg-emerald-50 text-emerald-900' : 'bg-violet-50 text-violet-500',
              ].join(' ')}
            >
              <span className="min-w-0">
                <span className="font-medium">
                  {VIRTUE_EMOJI[item.virtue] ?? '🌸'} {item.label}
                </span>
                {hill ? (
                  <span className="ml-1.5 text-[10px] font-medium text-violet-400">
                    {hill.hill}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-[11px] font-semibold uppercase">
                {item.collected ? (item.monthlyActive ? 'Active ×2' : 'Collected') : 'Locked'}
              </span>
            </div>
            );
          })}
        </div>
      </section>

      {sevenComplete ? (
        <section className="rounded-2xl bg-gradient-to-br from-amber-100 via-white to-violet-100 p-5 text-center shadow-sm">
          <Sparkles className="mx-auto h-8 w-8 text-amber-500" />
          <h2 className="mt-2 font-display text-xl font-semibold text-violet-950">
            Seven Virtues Activated
          </h2>
          <p className="mt-1 text-sm text-violet-700">All seven hills can earn double coins this month.</p>
          <p className="mt-3 text-lg tracking-widest">🔴 🟠 🟡 🟢 🔵 🔷 🟣</p>
        </section>
      ) : null}

      {bloom ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="w-full max-w-app rounded-3xl bg-white p-6 text-center shadow-2xl">
            {bloom.kind === 'coachAutoBloom' ? (
              <>
                <div className="space-y-3 text-sm text-violet-700">
                  <p
                    className={`transition-opacity duration-500 ${coachBloomPhase >= 0 ? 'opacity-100' : 'opacity-0'}`}
                  >
                    🌱 Glow Seed sent…
                  </p>
                  <p
                    className={`font-medium transition-opacity duration-500 ${coachBloomPhase >= 1 ? 'opacity-100' : 'opacity-0'}`}
                  >
                    ✨ Coach Bala opened your Glow Seed!
                  </p>
                  {coachBloomPhase >= 2 ? (
                    <>
                      <p className="text-xs font-bold uppercase tracking-wide text-violet-500">
                        🌸 IT BLOOMED
                      </p>
                      <h2 className="font-display text-2xl font-semibold text-violet-950">
                        {VIRTUE_EMOJI[bloom.virtue]} {bloom.virtueLabel}
                      </h2>
                      <p className="text-sm text-violet-700">
                        {bloom.qualifying === false
                          ? 'Coach Bala opened your seed — your monthly virtue boost from Coach was already used.'
                          : bloom.outcome === 'giver'
                            ? OUTCOME_COPY.giver
                            : OUTCOME_COPY.neither}
                      </p>
                    </>
                  ) : null}
                </div>
              </>
            ) : bloom.kind === 'sent' ? (
              <>
                <Sprout className="mx-auto h-10 w-10 text-emerald-600" />
                <h2 className="mt-3 font-display text-xl font-semibold text-violet-950">
                  Waiting to bloom…
                </h2>
                <p className="mt-2 text-sm text-violet-700">{bloom.message}</p>
              </>
            ) : bloom.kind === 'linkCopied' ? (
              <>
                <Check className="mx-auto h-10 w-10 text-emerald-600" />
                <h2 className="mt-3 font-display text-xl font-semibold text-violet-950">Copied</h2>
                <p className="mt-2 text-sm text-violet-700">{bloom.message}</p>
              </>
            ) : bloom.kind === 'joined' ? (
              <>
                <Sparkles className="mx-auto h-10 w-10 text-emerald-600" />
                <h2 className="mt-3 font-display text-xl font-semibold text-violet-950">
                  You’re in the family
                </h2>
                <p className="mt-2 text-sm text-violet-700">{bloom.message}</p>
              </>
            ) : (
              <>
                <Heart className="mx-auto h-10 w-10 text-rose-500" />
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-violet-500">
                  🌱 → 🌸 Bloomed
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-violet-950">
                  {VIRTUE_EMOJI[bloom.virtue]} {bloom.virtueLabel}
                </h2>
                <p className="mt-2 text-sm text-violet-700">
                  {bloom.coachGift
                    ? bloom.outcome === 'neither'
                      ? OUTCOME_COPY.coachGiftNoBoost
                      : OUTCOME_COPY.coachGift
                    : OUTCOME_COPY[bloom.outcome] ?? OUTCOME_COPY.neither}
                </p>
                {bloom.sevenVirtuesJustCompleted ? (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                    ✨ Seven Virtues Activated
                  </p>
                ) : null}
              </>
            )}
            <button
              type="button"
              onClick={() => setBloom(null)}
              disabled={bloom.kind === 'coachAutoBloom' && coachBloomPhase < 2}
              className="mt-5 w-full rounded-2xl bg-violet-600 py-3 text-sm font-semibold text-white disabled:bg-violet-300"
            >
              {bloom.kind === 'coachAutoBloom' && coachBloomPhase < 2 ? '…' : 'Continue'}
            </button>
          </div>
        </div>
      ) : null}

      {viewingSprout && sproutDetail ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="max-h-[85dvh] w-full max-w-app overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              Their journey
            </p>
            <h2 className="font-display text-xl font-semibold text-violet-950">
              @{sproutDetail.user.username}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-xl bg-violet-50 px-2 py-2">
                <p className="text-lg font-bold text-violet-950">{sproutDetail.user.flowIndex}%</p>
                <p className="text-[10px] text-violet-500">FLOW Index</p>
              </div>
              <div className="rounded-xl bg-amber-50 px-2 py-2">
                <p className="text-lg font-bold text-amber-900">
                  {sproutDetail.user.growthCoinsLifetime.toLocaleString()}
                </p>
                <p className="text-[10px] text-amber-700">Lifetime coins</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-violet-700">
              Your harvest from them:{' '}
              <span className="font-bold">{sproutDetail.harvestCoinsEarned.toLocaleString()}</span>{' '}
              coins
            </p>
            <ul className="mt-2 space-y-1">
              {sproutDetail.milestones.map((m) => (
                <li
                  key={m.threshold}
                  className={[
                    'flex justify-between rounded-lg px-2 py-1.5 text-[11px]',
                    m.achieved ? 'bg-emerald-50 text-emerald-900' : 'bg-violet-50 text-violet-400',
                  ].join(' ')}
                >
                  <span>{m.threshold.toLocaleString()} lifetime</span>
                  <span>{m.achieved ? `+${m.reward.toLocaleString()}` : `+${m.reward.toLocaleString()}`}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setViewingSprout(null);
                setSproutDetail(null);
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
