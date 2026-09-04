import { create } from 'zustand';

const STORAGE_KEY = 'gofam-auth';

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const persisted = loadPersisted();

export const useAuthStore = create((set, get) => ({
  user: persisted?.user ?? null,
  accessToken: persisted?.accessToken ?? null,
  refreshToken: persisted?.refreshToken ?? null,
  sessionId: persisted?.sessionId ?? null,
  adminProfile: persisted?.adminProfile ?? null,

  setAuth({ user, accessToken, refreshToken, sessionId, adminProfile }) {
    const next = {
      user: user ?? get().user,
      accessToken: accessToken ?? get().accessToken,
      refreshToken: refreshToken ?? get().refreshToken,
      sessionId: sessionId ?? get().sessionId,
      adminProfile: adminProfile ?? get().adminProfile,
    };
    set(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  setAdminProfile(adminProfile) {
    const next = {
      user: get().user,
      accessToken: get().accessToken,
      refreshToken: get().refreshToken,
      sessionId: get().sessionId,
      adminProfile,
    };
    set({ adminProfile });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  updateUser(user) {
    const next = {
      user,
      accessToken: get().accessToken,
      refreshToken: get().refreshToken,
      sessionId: get().sessionId,
    };
    set({ user });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  clearAuth() {
    set({ user: null, accessToken: null, refreshToken: null, sessionId: null, adminProfile: null });
    localStorage.removeItem(STORAGE_KEY);
  },

  isAuthenticated() {
    return Boolean(get().accessToken || get().refreshToken);
  },
}));
