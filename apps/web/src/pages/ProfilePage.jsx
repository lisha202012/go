import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Camera,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Coins,
  Flame,
  Flower2,
  Footprints,
  HelpCircle,
  LogOut,
  Mail,
  Monitor,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import { AvatarPickerModal } from '../components/AvatarPickerModal';
import { FamilyDetailsModal } from '../components/FamilyDetailsModal';
import { useDashboard } from '../context/DashboardContext';
import { api } from '../lib/api';
import { formatHillSubtitle, formatHillTitle, hillDomainLabel } from '../lib/hills';
import { HILL_RING_COLORS, HILL_RING_ORDER } from '../lib/hillRingColors';
import { FlowRingDetailCard } from '../components/FlowRingCard';
import { LocationSection } from '../components/LocationSection';
import { BelongingSection } from '../components/BelongingSection';
import { GapHistoryBreakdown, GapHistoryPreview, formatGapDate } from '../components/GapHistoryBreakdown';
import { MyJourneySection } from '../components/MyJourneySection';
import { useAuthStore } from '../store/useAuthStore';

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatLastActive(iso) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Active now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return formatDate(iso);
  } catch {
    return '';
  }
}

function ActiveSessionsSection({ onSignedOutCurrent }) {
  const sessionId = useAuthStore((s) => s.sessionId);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revokingId, setRevokingId] = useState(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const loadSessions = async () => {
    setLoading(true);
    setError('');
    try {
      const { sessions: list } = await api.getSessions();
      setSessions(list ?? []);
    } catch (err) {
      setError(err.message || 'Could not load active sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  async function handleRevokeSession(target) {
    setRevokingId(target.id);
    try {
      await api.revokeSession(target.id);
      if (target.isCurrent || target.id === sessionId) {
        try {
          await api.logout();
        } catch {
          /* local clear below */
        }
        clearAuth();
        onSignedOutCurrent?.();
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== target.id));
    } catch (err) {
      window.alert(err.message || 'Could not sign out that device');
    } finally {
      setRevokingId(null);
    }
  }

  async function handleRevokeOthers() {
    setRevokingOthers(true);
    try {
      await api.revokeOtherSessions();
      setSessions((prev) => prev.filter((s) => s.isCurrent || s.id === sessionId));
    } catch (err) {
      window.alert(err.message || 'Could not sign out other devices');
    } finally {
      setRevokingOthers(false);
    }
  }

  const otherCount = sessions.filter((s) => !s.isCurrent && s.id !== sessionId).length;
  const summary = loading
    ? 'Loading…'
    : sessions.length === 0
      ? 'No active sessions'
      : `${sessions.length} device${sessions.length === 1 ? '' : 's'}`;

  return (
    <CollapsibleSection icon={Monitor} title="Active Sessions" summary={summary}>
      {loading ? (
        <p className="text-sm text-violet-700/75">Loading sessions…</p>
      ) : error ? (
        <div>
          <p className="text-sm text-rose-600">{error}</p>
          <button
            type="button"
            onClick={loadSessions}
            className="mt-2 text-sm font-semibold text-violet-600 hover:text-violet-800"
          >
            Retry
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-violet-700/75">You are not signed in on any devices.</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-violet-600/80">
            Devices where you&apos;re signed in. Sign out on any device you don&apos;t recognize.
          </p>
          <ul className="space-y-2">
            {sessions.map((session) => {
              const isCurrent = session.isCurrent || session.id === sessionId;
              return (
                <li
                  key={session.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-violet-950">
                      {session.deviceName}
                      {isCurrent ? (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          This device
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-violet-600">{session.locationLabel}</p>
                    <p className="text-[11px] text-violet-500">
                      Last active · {formatLastActive(session.lastActiveAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={revokingId === session.id}
                    onClick={() => handleRevokeSession(session)}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    {revokingId === session.id ? '…' : 'Sign out'}
                  </button>
                </li>
              );
            })}
          </ul>
          {otherCount > 0 ? (
            <button
              type="button"
              disabled={revokingOthers}
              onClick={handleRevokeOthers}
              className="mt-3 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-50"
            >
              {revokingOthers ? 'Signing out…' : `Sign out all other devices (${otherCount})`}
            </button>
          ) : null}
        </>
      )}
    </CollapsibleSection>
  );
}

const HILL_CHAKRA_DOT_LABEL = {
  HOOK: 'Time',
  HOPE: 'Fam',
  HONE: 'Health',
  HOLD: 'Money',
  HOOD: 'Self',
  HOST: 'Home',
  HORN: 'Goals',
};

function weeklyChakraHillRef(hill) {
  return { code: hill.hillCode, name: hill.hillName };
}

function activatedChakraLabels(hills) {
  return [...(hills ?? [])]
    .filter((h) => h.activated)
    .sort((a, b) => (a.dayIndex ?? 0) - (b.dayIndex ?? 0))
    .map((h) => formatHillTitle(weeklyChakraHillRef(h)));
}

function WeeklyChakraDots({ hills }) {
  // Keep GAP / FLOW week day order (Day 1 → Day 7), same as Missions → This Week.
  const ordered = (hills ?? []).length
    ? [...hills].sort((a, b) => (a.dayIndex ?? 0) - (b.dayIndex ?? 0))
    : HILL_RING_ORDER.map((code) => ({
        hillCode: code,
        hillName: code,
        dayIndex: HILL_RING_ORDER.indexOf(code) + 1,
        activated: false,
        prescribedCompleted: 0,
        pulses: 0,
      }));

  return (
    <div
      className="flex items-end justify-between gap-0.5"
      role="img"
      aria-label={ordered
        .map((h) => {
          const domain = formatHillTitle(weeklyChakraHillRef(h));
          const pulses = h.pulses ?? (h.activated ? 3 : Math.min(2, h.prescribedCompleted ?? 0));
          const day = h.dayIndex ? `Day ${h.dayIndex} ` : '';
          return `${day}${domain}: ${h.activated ? 'activated' : `${pulses}/3`}`;
        })
        .join(', ')}
    >
      {ordered.map((hill) => {
        const code = hill.hillCode;
        const pulses = hill.pulses ?? (hill.activated ? 3 : Math.min(2, hill.prescribedCompleted ?? 0));
        const color = HILL_RING_COLORS[code] ?? '#7C3AED';
        const domain = hillDomainLabel(code);
        const dayLabel = hill.dayIndex ? `Day ${hill.dayIndex}` : null;
        const dotTitle = `${dayLabel ? `${dayLabel} · ` : ''}${formatHillTitle(weeklyChakraHillRef(hill))} (${formatHillSubtitle(weeklyChakraHillRef(hill))}) — ${
          hill.activated ? 'chakra activated' : `${pulses}/3 missions`
        }`;
        return (
          <div key={`${code}-${hill.dayIndex ?? ''}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            {dayLabel ? (
              <span className="text-[7px] font-bold uppercase tracking-wide text-violet-400">
                D{hill.dayIndex}
              </span>
            ) : null}
            <span
              title={dotTitle}
              className={[
                'h-2.5 w-full rounded-full',
                hill.activated ? 'ring-1 ring-violet-300/80 ring-offset-1' : '',
              ].join(' ')}
              style={{
                backgroundColor: pulses === 0 ? '#EDE9FE' : color,
                opacity: pulses === 0 ? 1 : pulses === 1 ? 0.4 : pulses === 2 ? 0.7 : 1,
              }}
            />
            <span
              className={[
                'w-full truncate text-center text-[8px] font-semibold leading-none',
                hill.activated ? 'text-violet-950' : 'text-violet-400',
              ].join(' ')}
              title={dotTitle}
            >
              {HILL_CHAKRA_DOT_LABEL[code] ?? domain.slice(0, 4)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MetricTile({ icon: Icon, iconBg, title, value, sub, children }) {
  return (
    <div className="flex min-h-[8.25rem] flex-col rounded-2xl border border-violet-100/80 bg-white p-3.5 shadow-sm">
      <div className="flex items-start gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">{title}</p>
          {value != null && value !== '' ? (
            <p className="font-display text-lg font-semibold leading-tight text-violet-950">{value}</p>
          ) : null}
          {sub ? <p className="mt-0.5 text-[11px] text-violet-600/80">{sub}</p> : null}
        </div>
      </div>
      {children ? <div className="mt-auto pt-3">{children}</div> : null}
    </div>
  );
}

function memberInitial(member) {
  const label = member.displayName || member.username || '';
  return (label.trim()[0] || '?').toUpperCase();
}

function CollapsibleSection({
  icon: Icon,
  title,
  summary,
  preview,
  defaultOpen = false,
  contentClassName = 'border-t border-violet-100 px-4 pb-4 pt-3',
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <Icon className="h-5 w-5 shrink-0 text-violet-600" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-violet-950">{title}</span>
          {!open && summary ? (
            <span className="block truncate text-xs text-violet-600">{summary}</span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-violet-400 transition ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {!open && preview ? (
        <div className="border-t border-violet-50 px-4 pb-3 pt-2">{preview}</div>
      ) : null}
      {open ? <div className={contentClassName}>{children}</div> : null}
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-36 rounded-2xl bg-violet-200/60" />
      <div className="h-32 rounded-2xl bg-violet-100" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-violet-100" />
        <div className="h-24 rounded-2xl bg-violet-100" />
        <div className="h-24 rounded-2xl bg-violet-100" />
        <div className="h-24 rounded-2xl bg-violet-100" />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { refresh: refreshDashboard, data: dashboardData } = useDashboard();
  const freeStreaks = dashboardData?.campStreak?.tokensAvailable ?? 0;
  const [profile, setProfile] = useState(null);
  const [journey, setJourney] = useState(null);
  const [journeyLoading, setJourneyLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [familyInvites, setFamilyInvites] = useState([]);
  const [acceptingInviteId, setAcceptingInviteId] = useState(null);
  const [inviteError, setInviteError] = useState('');
  const [familyInviteSuccess, setFamilyInviteSuccess] = useState('');

  const loadFamilyInvites = async () => {
    try {
      const res = await api.getFamilyInvites();
      setFamilyInvites(res.invites ?? []);
    } catch {
      setFamilyInvites([]);
    }
  };

  const loadProfile = async (attempt = 1) => {
    if (attempt === 1) {
      setLoading(true);
      setJourneyLoading(true);
      setError('');
    }
    try {
      const [nextProfile, nextJourney] = await Promise.all([
        api.getProfile({ networkRetries: 3 }),
        api.getTreeJourney().catch(() => null),
      ]);
      setProfile(nextProfile);
      setJourney(nextJourney);
      setError('');
      setLoading(false);
      setJourneyLoading(false);
    } catch (err) {
      const dbOffline =
        err.status === 503 ||
        err.status === 0 ||
        /database is offline|timed out|could not reach the api/i.test(err.message ?? '');
      // One quick retry only — don't keep the skeleton up for minutes.
      if (dbOffline && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return loadProfile(attempt + 1);
      }
      setError(
        dbOffline
          ? 'Database is offline. From the project root run: npm run dev (keep that terminal open).'
          : err.message || 'Could not load profile',
      );
      setLoading(false);
      setJourneyLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
    void loadFamilyInvites();
  }, []);

  async function handleAcceptFamilyInvite(inviteId) {
    setAcceptingInviteId(inviteId);
    setInviteError('');
    setFamilyInviteSuccess('');
    try {
      const result = await api.acceptFamilyInvite(inviteId);
      setFamilyInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      await loadProfile();
      const familyName = result?.family?.name || 'your family';
      setFamilyInviteSuccess(`Joined ${familyName}.`);
    } catch (err) {
      setInviteError(err.message || 'Could not accept family invite');
    } finally {
      setAcceptingInviteId(null);
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      /* clear local session anyway */
    }
    clearAuth();
  }

  async function handleAvatarSave(avatarUrl) {
    setAvatarSaving(true);
    try {
      const { user: updatedUser } = await api.patchAvatar(avatarUrl);
      updateUser(updatedUser);
      setProfile((prev) =>
        prev ? { ...prev, user: { ...prev.user, avatarUrl: updatedUser.avatarUrl } } : prev,
      );
      refreshDashboard();
      setAvatarPickerOpen(false);
    } catch (err) {
      window.alert(err.message || 'Could not update avatar');
    } finally {
      setAvatarSaving(false);
    }
  }

  if (loading) return <ProfileSkeleton />;

  if (error || !profile) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5 text-center">
        <p className="text-sm text-rose-600">{error || 'Could not load profile'}</p>
        <button
          type="button"
          onClick={() => loadProfile(1)}
          className="mt-3 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const {
    user,
    flowRing,
    stats,
    gapHistory,
    coinHistory,
    family,
    weeklyChakras,
    camps,
    hills,
  } = profile;
  const latestGap = gapHistory[0];
  const recentCoins = coinHistory.slice(0, 5);

  return (
    <div className="space-y-3 pb-2">
      {/* Hero — one card, no duplicate FLOW gauge */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-violet-900 px-4 pb-4 pt-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/90">
          Tree of Life
        </p>
        <p className="mt-1 text-xs text-emerald-100/80">Your growth · Your impact · Your legacy</p>

        <div className="mt-4 flex items-center gap-3">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setAvatarPickerOpen(true)}
              className="group relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-white/30 bg-white/10"
              aria-label="Change avatar"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-bold">{(user.username?.[0] ?? '?').toUpperCase()}</span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25">
                <Camera
                  className="h-5 w-5 text-white opacity-0 drop-shadow transition group-hover:opacity-100"
                  aria-hidden="true"
                />
              </span>
            </button>
            <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-emerald-900 bg-white text-emerald-700 shadow-sm">
              <Camera className="h-3 w-3" aria-hidden="true" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-semibold">{user.username}</p>
          </div>
          <div className="shrink-0 rounded-xl bg-white/15 px-3 py-2 text-right backdrop-blur-sm">
            <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-200">CATEGORY RANK</p>
            <p className="text-xl font-bold leading-none">
              {user.categoryRank ? `#${user.categoryRank}` : '—'}
            </p>
            {user.categoryTotal ? (
              <p className="mt-0.5 text-[9px] text-emerald-100/80">of {user.categoryTotal}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
            <Flame className="h-4 w-4 text-orange-300" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold leading-none">{user.currentStreak}</p>
              <p className="text-[10px] text-emerald-100/80">Day streak</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
            <Footprints className="h-4 w-4 text-violet-200" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold leading-none">{user.workingStep ?? user.currentStep + 1}</p>
              <p className="text-[10px] text-emerald-100/80">Current step</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-2.5 py-2">
            <Flame className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-none tabular-nums">{freeStreaks}</p>
              <p className="text-[10px] leading-tight text-emerald-100/80">Free streaks</p>
            </div>
          </div>
        </div>
      </section>

      <FlowRingDetailCard flowRing={flowRing} hills={hills ?? []} />

      <div className="mt-2">
        <Link
          to="/rankings"
          className="inline-block rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50"
        >
          View Rankings
        </Link>
      </div>

      <LocationSection user={user} onSaved={() => loadProfile(1)} />

      <BelongingSection key={user.cityId ?? 'no-city'} user={user} />

      <MyJourneySection
        journey={journey}
        loading={journeyLoading}
        focusHill={dashboardData?.focusHill}
      />

      {/* This week's hill days — 3/3 activates each chakra */}
      <MetricTile
        icon={Flower2}
        iconBg="bg-fuchsia-100 text-fuchsia-600"
        title="This FLOW week"
      >
        <p className="text-lg font-bold tabular-nums text-violet-950">
          {stats.chakrasActive ?? 0} of {stats.chakrasTotal ?? 7} hill days complete
        </p>
        <WeeklyChakraDots hills={weeklyChakras} />
        {(stats.chakrasActive ?? 0) > 0 ? (
          <div className="mt-1.5 space-y-0.5">
            <p className="text-[11px] font-semibold text-fuchsia-800">
              {activatedChakraLabels(weeklyChakras).join(' · ')}
            </p>
            <p className="text-[10px] text-violet-500">
              3/3 missions on each activated day this week
            </p>
          </div>
        ) : (
          <p className="mt-1.5 text-[10px] text-violet-500">
            Finish 3 Home Hill missions on a day to count that hill
          </p>
        )}
      </MetricTile>

      {/* Collapsible detail sections — cuts scroll length */}
      <CollapsibleSection
        icon={Sparkles}
        title="GAP History"
        summary={
          latestGap
            ? `Taken ${formatGapDate(latestGap.completedAt)}`
            : 'No assessments yet'
        }
        preview={latestGap ? <GapHistoryPreview entry={latestGap} /> : null}
        contentClassName="border-t border-violet-100 bg-slate-50 px-3 pb-4 pt-3"
      >
        {gapHistory.length === 0 ? (
          <p className="text-sm text-violet-700/75">Complete your GAP Assessment during onboarding.</p>
        ) : (
          <ul className="space-y-4">
            {gapHistory.map((entry) => (
              <li key={entry.id}>
                <GapHistoryBreakdown entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        icon={Coins}
        title="Coins History"
        summary={
          recentCoins[0]
            ? `${recentCoins[0].description} · ${recentCoins[0].amount >= 0 ? '+' : ''}${recentCoins[0].amount}`
            : 'No transactions yet'
        }
      >
        {coinHistory.length === 0 ? (
          <p className="text-sm text-violet-700/75">Earn coins by completing missions.</p>
        ) : (
          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
            {coinHistory.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-violet-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-violet-900">{entry.description}</p>
                  <p className="text-[10px] text-violet-500">{formatDate(entry.createdAt)}</p>
                </div>
                <span
                  className={`shrink-0 text-sm font-bold ${entry.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                >
                  {entry.amount >= 0 ? '+' : ''}
                  {entry.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        icon={Users}
        title="My Family"
        summary={
          family
            ? family.members.length
              ? `${family.name} · ${family.members.length} member${family.members.length === 1 ? '' : 's'}`
              : `${family.name} · no members yet`
            : 'Not set up yet'
        }
        defaultOpen={Boolean(family || user.familySetupDeferred || familyInvites.length > 0)}
      >
        {familyInvites.length > 0 ? (
          <div className="mb-3 space-y-2">
            {familyInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-emerald-950">
                    {invite.family?.name || 'A family'} invited you as {invite.role}
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    {invite.invitedBy?.username ? `From @${invite.invitedBy.username}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={acceptingInviteId === invite.id}
                  onClick={() => handleAcceptFamilyInvite(invite.id)}
                  className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {acceptingInviteId === invite.id ? 'Joining…' : 'Accept'}
                </button>
              </div>
            ))}
            {inviteError ? (
              <p className="text-[11px] font-medium text-rose-700">{inviteError}</p>
            ) : null}
            {familyInviteSuccess ? (
              <p className="text-[11px] font-medium text-emerald-700">{familyInviteSuccess}</p>
            ) : null}
          </div>
        ) : null}

        {!family ? (
          user.familySetupDeferred ? (
            <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-4">
              <p className="text-sm text-violet-800/80">
                You chose to add family later. Tap below when you are ready.
              </p>
              <button
                type="button"
                onClick={() => setFamilyModalOpen(true)}
                className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                Add family details
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-4">
              <p className="text-sm text-violet-800/80">
                Add your family role and members to unlock family features.
              </p>
              <button
                type="button"
                onClick={() => setFamilyModalOpen(true)}
                className="mt-3 w-full rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-800 transition hover:bg-violet-50"
              >
                Add family details
              </button>
            </div>
          )
        ) : family.members.length === 0 ? (
          <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-4">
            <p className="text-sm text-violet-800/80">
              {family.name} is created, but no members are listed yet. Add your role or invite
              family so they show up here.
            </p>
            <button
              type="button"
              onClick={() => setFamilyModalOpen(true)}
              className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              Add family members
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 flex -space-x-2">
              {family.members.slice(0, 6).map((m) => (
                <div
                  key={m.id}
                  title={m.displayName ?? m.username}
                  className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-violet-200 text-xs font-bold text-violet-800"
                >
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    memberInitial(m)
                  )}
                </div>
              ))}
              {family.members.length > 6 ? (
                <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-violet-100 text-xs font-bold text-violet-600">
                  +{family.members.length - 6}
                </span>
              ) : null}
            </div>
            <ul className="space-y-1.5">
              {family.members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-violet-50/80 px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-200 text-xs font-bold text-violet-800">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        memberInitial(member)
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-violet-900">
                        {member.displayName || member.username || 'Family member'}
                      </span>
                      {member.status === 'pending' ? (
                        <span className="text-[11px] text-amber-700">Invited — waiting to join</span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs capitalize text-violet-600">{member.role}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setFamilyModalOpen(true)}
              className="mt-3 w-full rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-800 transition hover:bg-violet-50"
            >
              Add family members
            </button>
          </>
        )}
      </CollapsibleSection>

      <ActiveSessionsSection onSignedOutCurrent={() => navigate('/login', { replace: true })} />

      {/* Settings + Help — one card */}
      <section className="rounded-2xl border border-violet-100 bg-white shadow-sm">
        <p className="border-b border-violet-100 px-4 py-3 text-sm font-semibold text-violet-950">
          Settings & Support
        </p>
        <ul className="divide-y divide-violet-50">
          <li className="flex items-center justify-between px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-violet-900">
              <Bell className="h-4 w-4 text-violet-500" aria-hidden="true" />
              Notifications
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={notificationsOn}
              onClick={() => setNotificationsOn((v) => !v)}
              className={`relative h-6 w-11 rounded-full ${notificationsOn ? 'bg-violet-600' : 'bg-violet-200'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${notificationsOn ? 'left-[22px]' : 'left-0.5'}`}
              />
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setFamilyModalOpen(true)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-violet-900 hover:bg-violet-50"
            >
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-violet-500" aria-hidden="true" />
                Edit profile & family
              </span>
              <ChevronRight className="h-4 w-4 text-violet-300" aria-hidden="true" />
            </button>
          </li>
          <li>
            <a
              href="mailto:support@gofam.app"
              className="flex items-center gap-2 px-4 py-3 text-sm text-violet-900 hover:bg-violet-50"
            >
              <Mail className="h-4 w-4 text-violet-500" aria-hidden="true" />
              Email support
            </a>
          </li>
          <li>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-violet-900 hover:bg-violet-50"
              onClick={() => window.alert('Help center coming soon.')}
            >
              <CircleHelp className="h-4 w-4 text-violet-500" aria-hidden="true" />
              Help center & FAQ
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Log out
            </button>
          </li>
        </ul>
      </section>

      <AvatarPickerModal
        open={avatarPickerOpen}
        currentUrl={user.avatarUrl}
        saving={avatarSaving}
        onClose={() => !avatarSaving && setAvatarPickerOpen(false)}
        onSave={handleAvatarSave}
      />

      <FamilyDetailsModal
        open={familyModalOpen}
        onClose={() => setFamilyModalOpen(false)}
        onSaved={({ user: updatedUser }) => {
          updateUser(updatedUser);
          void loadProfile();
        }}
      />
    </div>
  );
}
