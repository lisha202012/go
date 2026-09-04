import { useEffect, useMemo, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import {
  Building2,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  ScrollText,
  Sparkles,
  Target,
  Users,
  X,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';

const SIDEBAR_COLLAPSED_KEY = 'gofam-admin-sidebar-collapsed';

const ALL_MODULES = [
  { key: 'overview', to: '/admin', label: 'Overview', end: true, module: null, icon: LayoutDashboard },
  { key: 'users', to: '/admin/users', label: 'Users', module: 'trust_safety', icon: Users },
  { key: 'avatar-assets', to: '/admin/avatar-assets', label: 'Avatar Library', module: 'trust_safety', icon: Sparkles },
  { key: 'organizations', to: '/admin/organizations', label: 'Organisations', module: 'organizations', icon: Building2 },
  { key: 'school-links', to: '/admin/school-links', label: 'School Links', module: 'organizations', icon: Building2 },
  { key: 'mission_engine', to: '/admin/mission-engine', label: 'Missions', module: 'mission_engine', icon: Target },
  { key: 'journey', to: '/admin/journey', label: 'Journey', module: 'journey', icon: Map },
  { key: 'glow', to: '/admin/glow', label: 'GLOW', module: 'glow', icon: Sparkles },
  { key: 'audit', to: '/admin/audit', label: 'Audit Log', module: 'audit', permission: 'audit.read', icon: ScrollText },
];

function navLinkClass(active, collapsed) {
  return [
    'flex items-center rounded-lg text-sm transition-colors',
    collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
    active
      ? 'bg-amber-950/60 font-semibold text-amber-400 ring-1 ring-amber-700/40'
      : 'font-medium text-slate-200 hover:bg-slate-800/80 hover:text-white',
  ].join(' ');
}

function SidebarNav({
  visibleModules,
  user,
  adminProfile,
  clearAuth,
  onNavigate,
  pathname,
  collapsed,
  modulesExpanded,
  onToggleModules,
}) {
  const overviewMod = visibleModules.find((mod) => mod.key === 'overview');
  const moduleLinks = visibleModules.filter((mod) => mod.key !== 'overview');
  const overviewActive = pathname === '/admin' || pathname === '/admin/';
  const moduleSectionActive = moduleLinks.some((mod) => pathname.startsWith(mod.to));
  const showModules = modulesExpanded || moduleSectionActive;

  return (
    <>
      <div className={`border-b border-slate-800 ${collapsed ? 'px-2 py-4' : 'px-4 py-5'}`}>
        {!collapsed ? (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">Staff console</p>
            <a
              href="/admin"
              className="mt-1 block font-display text-xl font-semibold text-white hover:text-amber-100"
              title="GOFAM Admin"
            >
              GOFAM Admin
            </a>
          </>
        ) : (
          <a
            href="/admin"
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 ring-1 ring-amber-700/30"
            title="GOFAM Admin"
          >
            <LayoutDashboard className="h-5 w-5" />
          </a>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {overviewMod ? (
          <a
            href={overviewMod.to}
            className={navLinkClass(overviewActive, collapsed)}
            onClick={onNavigate}
            title={collapsed ? overviewMod.label : undefined}
          >
            <overviewMod.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
            {!collapsed ? <span>{overviewMod.label}</span> : null}
          </a>
        ) : null}

        {moduleLinks.length ? (
          <div className={collapsed ? 'mt-2 space-y-1' : 'mt-4'}>
            {!collapsed ? (
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-800/50 hover:text-slate-300"
                onClick={onToggleModules}
                aria-expanded={showModules}
              >
                <span>Modules</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showModules ? 'rotate-0' : '-rotate-90'}`}
                />
              </button>
            ) : null}

            {showModules ? (
              <ul className={collapsed ? 'space-y-1' : 'mt-1 space-y-1'}>
                {moduleLinks.map((mod) => {
                  const active = pathname.startsWith(mod.to);
                  const Icon = mod.icon;
                  return (
                    <li key={mod.to}>
                      <a
                        href={mod.to}
                        className={navLinkClass(active, collapsed)}
                        onClick={onNavigate}
                        title={collapsed ? mod.label : undefined}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                        {!collapsed ? <span>{mod.label}</span> : null}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </nav>

      <div className={`border-t border-slate-800 ${collapsed ? 'p-2' : 'p-4'} text-xs text-slate-500`}>
        {!collapsed ? (
          <>
            <p className="truncate text-slate-300">{user.email ?? user.username}</p>
            <p className="mt-1 text-slate-400">{adminProfile.roleLabels?.join(', ') || 'Staff'}</p>
          </>
        ) : null}
        <div className={`flex flex-col gap-2 ${collapsed ? '' : 'mt-3'}`}>
          <a
            href="/home"
            className={`inline-flex items-center gap-2 text-amber-400/90 hover:text-amber-300 ${collapsed ? 'justify-center py-2' : ''}`}
            onClick={onNavigate}
            title={collapsed ? 'Member app' : undefined}
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>Member app</span> : null}
          </a>
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              clearAuth();
            }}
            className={`inline-flex items-center gap-2 text-left text-slate-400 hover:text-slate-200 ${collapsed ? 'justify-center py-2' : ''}`}
            title={collapsed ? 'Sign out' : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>Sign out</span> : null}
          </button>
        </div>
      </div>
    </>
  );
}

export function AdminShell() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const adminProfile = useAuthStore((s) => s.adminProfile);
  const setAdminProfile = useAuthStore((s) => s.setAdminProfile);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [navOpen, setNavOpen] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(!adminProfile);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [modulesExpanded, setModulesExpanded] = useState(true);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (moduleLinksActive(location.pathname)) {
      setModulesExpanded(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    if (adminProfile?.modules?.length) {
      setProfileLoading(false);
      setProfileError('');
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    setProfileError('');
    (async () => {
      try {
        const me = await api.adminMe();
        if (cancelled) return;
        setAdminProfile(me.admin);
        setProfileLoading(false);
      } catch (err) {
        if (cancelled) return;
        setProfileLoading(false);
        setProfileError(
          err.message?.includes('reach the API')
            ? 'API is offline. Start the dev server and try again.'
            : err.message || 'Could not load staff profile. Sign in again.',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, adminProfile, setAdminProfile]);

  const visibleModules = useMemo(() => {
    const allowed = new Set(adminProfile?.modules ?? []);
    const permissions = new Set(adminProfile?.permissions ?? []);
    return ALL_MODULES.filter((mod) => {
      if (mod.permission) return permissions.has(mod.permission);
      if (!mod.module) return true;
      return allowed.has(mod.module);
    });
  }, [adminProfile]);

  if (!user || user.role !== 'admin') {
    return <Navigate to="/admin/login?error=staff_only" replace />;
  }

  if (!adminProfile) {
    if (profileLoading) {
      return (
        <div className="flex min-h-dvh w-full items-center justify-center bg-slate-950 text-slate-300">
          Loading staff profile…
        </div>
      );
    }
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <p className="text-sm text-red-200">{profileError || 'Staff session expired.'}</p>
          <button
            type="button"
            className="mt-4 w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-950"
            onClick={() => {
              clearAuth();
              window.location.replace('/admin/login');
            }}
          >
            Sign in again
          </button>
        </div>
      </div>
    );
  }

  const closeNav = () => setNavOpen(false);

  return (
    <div className="min-h-screen bg-slate-100 font-body">
      {navOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
          onClick={closeNav}
        />
      ) : null}

      <div className="flex min-h-screen">
        <aside
          className={[
            'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-slate-950 text-slate-100',
            'transition-all duration-200 ease-out lg:static lg:z-auto lg:shrink-0 lg:translate-x-0',
            sidebarCollapsed ? 'lg:w-[4.5rem]' : 'lg:w-64',
            navOpen ? 'translate-x-0 w-[min(100vw-3rem,17rem)]' : '-translate-x-full lg:translate-x-0',
          ].join(' ')}
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-2 py-2">
            <div className="lg:hidden">
              <button
                type="button"
                aria-label="Close menu"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                onClick={closeNav}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="ml-auto hidden rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:block"
              onClick={() => setSidebarCollapsed((v) => !v)}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <SidebarNav
            visibleModules={visibleModules}
            user={user}
            adminProfile={adminProfile}
            clearAuth={clearAuth}
            onNavigate={closeNav}
            pathname={location.pathname}
            collapsed={sidebarCollapsed}
            modulesExpanded={modulesExpanded}
            onToggleModules={() => setModulesExpanded((v) => !v)}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col lg:min-h-screen">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                aria-label="Open navigation"
                aria-expanded={navOpen}
                className="mt-0.5 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
                onClick={() => setNavOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  GOFAM staff console
                </p>
                <p className="mt-0.5 truncate text-sm text-slate-600 sm:whitespace-normal">
                  Signed in as {user.email ?? user.username}
                </p>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-7xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function moduleLinksActive(pathname) {
  return ALL_MODULES.some(
    (mod) => mod.key !== 'overview' && mod.to !== '/admin' && pathname.startsWith(mod.to),
  );
}
