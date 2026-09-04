import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

const DashboardContext = createContext(null);

function dashboardCacheKey(user) {
  const identity = user?.id || user?.username;
  return identity ? `gofam_dashboard_${identity}` : null;
}

function readDashboardCache(user) {
  const key = dashboardCacheKey(user);
  if (!key) return null;
  try {
    const cached = JSON.parse(localStorage.getItem(key) || 'null');
    return cached?.data ?? null;
  } catch {
    return null;
  }
}

function writeDashboardCache(user, value) {
  const key = dashboardCacheKey(user);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify({ data: value, cachedAt: Date.now() }));
  } catch {
    /* ignore storage limits or private browsing restrictions */
  }
}

/** @typedef {'loading' | 'error' | 'loaded'} DashboardStatus */

export function DashboardProvider({ children }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const authUser = useAuthStore((s) => s.user);
  const [data, setData] = useState(() => readDashboardCache(authUser));
  /** @type {[DashboardStatus, Function]} */
  const [status, setStatus] = useState(() => (readDashboardCache(authUser) ? 'loaded' : 'loading'));
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!accessToken) {
      const message = 'Not signed in. Please log in again.';
      setError(message);
      setStatus('error');
      return;
    }

    setRetrying(true);
    setError('');

    try {
      const result = await api.getDashboardHome();
      setData(result);
      writeDashboardCache(authUser, result);
      setStatus('loaded');
    } catch (err) {
      console.error('[dashboard] fetch failed', err);
      setError(err.message || "Couldn't load your dashboard");
      setStatus('error');
    } finally {
      setRetrying(false);
    }
  }, [accessToken, authUser]);

  useEffect(() => {
    if (!accessToken) {
      setStatus('error');
      setError('Not signed in. Please log in again.');
      return;
    }

    let ignore = false;
    setStatus((current) => (data ? current : 'loading'));
    setError('');

    (async () => {
      try {
        const result = await api.getDashboardHome();
        if (ignore) return;
        setData(result);
        writeDashboardCache(authUser, result);
        setStatus('loaded');
      } catch (err) {
        if (ignore) return;
        console.error('[dashboard] initial load failed', err);
        setError(err.message || "Couldn't load your dashboard");
        setStatus('error');
      }
    })();

    return () => {
      ignore = true;
    };
  }, [accessToken, authUser]);

  const value = useMemo(
    () => ({
      data,
      status,
      loading: status === 'loading',
      retrying,
      error,
      refresh,
    }),
    [data, status, retrying, error, refresh],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return ctx;
}

export function useUserSummary() {
  const { data, loading, error, refresh } = useDashboard();
  return {
    user: data?.user ?? null,
    notificationCount: data?.notificationCount ?? 0,
    campStreak: data?.campStreak ?? null,
    loading,
    error,
    refresh,
  };
}
