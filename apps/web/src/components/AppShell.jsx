import { Component, useEffect, useState, lazy, Suspense } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import {
  Bell,
  Coins,
  Home,
  Mountain,
  Sparkles,
  Sprout,
  Target,
  User,
} from 'lucide-react';
import { DashboardProvider, useUserSummary } from '../context/DashboardContext';
import { useAuthStore } from '../store/useAuthStore';

const HomePage = lazy(() => import('../pages/HomePage'));
const MissionsPage = lazy(() => import('../pages/MissionsPage'));
const JourneyPage = lazy(() => import('../pages/JourneyPage'));
const GlowPage = lazy(() => import('../pages/GlowPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));

class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[TabErrorBoundary]', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-rose-900/50 bg-rose-950/20 p-6 text-center">
          <p className="font-semibold text-rose-300">Something went wrong loading this page</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function TabPageFallback() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-violet-900/50" />
      <div className="h-44 rounded-2xl bg-violet-900/40" />
      <div className="h-28 rounded-2xl bg-violet-900/30" />
    </div>
  );
}

const NAV_ITEMS = [
  { to: '/home', label: 'Home', Icon: Home },
  { to: '/missions', label: 'Missions', Icon: Target },
  { to: '/journey', label: 'Tree of Life', Icon: Mountain },
  { to: '/glow', label: 'GLOW', Icon: Sparkles },
  { to: '/profile', label: 'Profile', Icon: User },
];

const TAB_PAGES = [
  { path: '/home', Page: HomePage },
  { path: '/missions', Page: MissionsPage },
  { path: '/journey', Page: JourneyPage },
  { path: '/glow', Page: GlowPage },
  { path: '/profile', Page: ProfilePage },
];

/** Mount each tab on first visit, then hide it. Never stack visible pages. */
function TabKeepAlive() {
  const { pathname } = useLocation();
  const active = TAB_PAGES.find((tab) => tab.path === pathname)?.path ?? null;
  const [mounted, setMounted] = useState(() => new Set(active ? [active] : []));

  useEffect(() => {
    if (!active) return;
    setMounted((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev);
      next.add(active);
      return next;
    });
    window.scrollTo(0, 0);
  }, [active]);

  if (!active) return <Outlet />;

  return (
    <>
      {TAB_PAGES.map(({ path, Page }) => {
        if (!mounted.has(path)) return null;
        const isActive = path === active;
        return (
          <div
            key={path}
            hidden={!isActive}
            aria-hidden={!isActive}
            {...(!isActive ? { inert: '' } : {})}
            className={isActive ? undefined : 'hidden'}
          >
            <TabErrorBoundary>
              <Suspense fallback={<TabPageFallback />}>
                <Page />
              </Suspense>
            </TabErrorBoundary>
          </div>
        );
      })}
    </>
  );
}

function TopBar() {
  const authUser = useAuthStore((s) => s.user);
  const { user, notificationCount, loading } = useUserSummary();
  // Auth store updates immediately after mission complete; dashboard loads once on mount.
  const walletCoins = authUser?.walletCoins ?? user?.walletCoins ?? 0;
  const seedCount = user?.seedInventoryCount ?? authUser?.seedInventoryCount ?? 0;
  const treeStars = user?.treeStars ?? authUser?.treeStars ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-violet-500/25 bg-[#0c0c14]/95 shadow-[0_4px_24px_rgba(124,58,237,0.12)] backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="font-display text-sm font-semibold tracking-[0.14em] text-violet-200 uppercase drop-shadow-[0_0_12px_rgba(167,139,250,0.45)]">
          GOFAM GROW
        </p>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-[#1a1520] px-2.5 py-1.5 text-xs font-semibold text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
            title="Coins"
          >
            <Coins className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
            <span className="min-w-[1.25rem] tabular-nums">
              {loading ? '…' : walletCoins.toLocaleString()}
            </span>
          </div>
          <div
            className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-[#101a16] px-2.5 py-1.5 text-xs font-semibold text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
            title="Glow Seeds in your inventory (send or plant)"
          >
            <Sprout className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
            <span className="min-w-[1.25rem] tabular-nums">
              {loading ? '…' : seedCount}
            </span>
          </div>
          <div
            className="flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-[#171425] px-2.5 py-1.5 text-xs font-semibold text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
            title="Tree stars"
            aria-label={`Tree stars: ${treeStars}`}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-300" aria-hidden="true" />
            <span className="min-w-[1.25rem] tabular-nums">{loading ? '…' : treeStars}</span>
          </div>
          <Link
            to="/glow"
            className="relative rounded-full border border-violet-500/30 bg-[#14141f] p-2 text-violet-300 transition hover:border-violet-400/50 hover:bg-[#1c1c2a]"
            aria-label={
              notificationCount > 0
                ? `${notificationCount} request${notificationCount === 1 ? '' : 's'} waiting`
                : 'Requests'
            }
          >
            <Bell className="h-4 w-4" />
            {notificationCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            ) : null}
          </Link>
          <Link
            to="/profile"
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-violet-500/40 bg-[#1c1630] text-sm font-bold text-violet-200 transition hover:border-violet-400"
            aria-label="Profile"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (user?.username?.[0] ?? '?').toUpperCase()
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const { notificationCount } = useUserSummary();
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-violet-500/25 bg-[#0c0c14]/96 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <div className="flex justify-around px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'relative flex min-w-[4rem] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-semibold transition',
                isActive
                  ? 'bg-violet-600/20 text-violet-200 shadow-[0_0_16px_rgba(124,58,237,0.35)]'
                  : 'text-violet-400 hover:text-violet-200',
              ].join(' ')
            }
          >
            <span className="relative">
              <Icon className="h-5 w-5" aria-hidden="true" />
              {to === '/glow' && notificationCount > 0 ? (
                <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[8px] font-bold text-white">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              ) : null}
            </span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function AppShellLayout() {
  return (
    <div className="gofam-app flex min-h-dvh flex-col">
      <TopBar />
      <main className="flex-1 px-4 py-4 pb-24">
        <TabKeepAlive />
      </main>
      <BottomNav />
    </div>
  );
}

export function AppShell() {
  return (
    <DashboardProvider>
      <AppShellLayout />
    </DashboardProvider>
  );
}
