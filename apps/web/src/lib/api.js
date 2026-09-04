import { useAuthStore } from '../store/useAuthStore';
import { getAccessTokenExpiryMs, getDeviceLabel } from './deviceInfo';

function resolveApiUrl() {
  const explicit = String(import.meta.env.VITE_API_URL || '')
    .trim()
    .replace(/\/$/, '');

  // Vite proxies /api → 127.0.0.1:4000. Always use same-origin in local dev so
  // localhost vs 127.0.0.1 never causes "Could not reach the API".
  if (import.meta.env.DEV) {
    if (!explicit || /localhost|127\.0\.0\.1/.test(explicit)) {
      return '/api/v1';
    }
  }

  if (explicit) return explicit;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';
    return `http://${host}:4000/api/v1`;
  }

  return 'http://localhost:4000/api/v1';
}

const API_URL = resolveApiUrl();
/** Local dev DB can be slow on mission/journey queries — allow extra time before aborting. */
const DEFAULT_REQUEST_TIMEOUT_MS = import.meta.env.DEV ? 60_000 : 30_000;
const NETWORK_RETRY_ATTEMPTS = import.meta.env.DEV ? 5 : 1;

let refreshInFlight = null;
let proactiveRefreshTimer = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authHeaders(extra = {}) {
  const { accessToken, sessionId } = useAuthStore.getState();
  const headers = { ...extra };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (sessionId) headers['X-Session-Id'] = sessionId;
  return headers;
}

function scheduleProactiveRefresh() {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }

  const { accessToken, refreshToken } = useAuthStore.getState();
  if (!accessToken || !refreshToken) return;

  const expMs = getAccessTokenExpiryMs(accessToken);
  if (!expMs) return;

  const refreshAt = expMs - 2 * 60 * 1000;
  const delay = Math.max(5_000, refreshAt - Date.now());
  proactiveRefreshTimer = setTimeout(() => {
    void tryRefreshAccessToken();
  }, delay);
}

async function tryRefreshAccessToken() {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8_000);
    refreshInFlight = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return false;

        const current = useAuthStore.getState();
        useAuthStore.getState().setAuth({
          user: current.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          sessionId: data.sessionId ?? current.sessionId,
        });
        scheduleProactiveRefresh();
        return true;
      })
      .catch(() => false)
      .finally(() => {
        clearTimeout(timeoutId);
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

function handleSessionExpired() {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
  useAuthStore.getState().clearAuth();
  const path = window.location.pathname;
  if (path.startsWith('/admin')) {
    window.location.replace('/admin/login');
    return;
  }
  if (!path.startsWith('/login')) {
    window.location.replace('/login');
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
    this.status = 401;
  }
}

function withDeviceName(body) {
  if (!body || typeof body !== 'object') return body;
  return { ...body, deviceName: body.deviceName ?? getDeviceLabel() };
}

async function request(path, { method = 'GET', body, auth = true, retry = true, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, sessionRecovery = false, networkRetries = NETWORK_RETRY_ATTEMPTS } = {}) {
  const headers = authHeaders({ 'Content-Type': 'application/json' });

  const url = `${API_URL}${path}`;
  const maxAttempts = Math.max(1, networkRetries);

  let res;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const transient =
        res.status === 502 ||
        res.status === 503 ||
        (import.meta.env.DEV && res.status === 500);
      if (transient && attempt < maxAttempts) {
        await sleep(700 * attempt);
        continue;
      }
      break;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('Request timed out. Is the API running?');
        timeoutErr.status = 0;
        throw timeoutErr;
      }
      if (attempt >= maxAttempts) {
        const networkErr = new Error(
          err.message?.includes('Failed to fetch')
            ? 'Could not reach the API. From the project root run: npm run dev (starts API + database + web — keep that terminal open).'
            : err.message || 'Network error',
        );
        networkErr.status = 0;
        throw networkErr;
      }
      await sleep(400 * attempt);
    }
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && auth && retry) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return request(path, { method, body, auth, retry: false, timeoutMs, sessionRecovery });
    }
    if (!sessionRecovery) {
      handleSessionExpired();
    }
    throw new SessionExpiredError();
  }

  if (!res.ok) {
    if (import.meta.env.DEV) {
      console.error('[api]', method, url, res.status, data);
    }
    const message = data.error || data.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.details = data.details;
    err.url = url;
    err.method = method;
    throw err;
  }

  return data;
}

function persistAuthResponse(data) {
  if (!data?.accessToken) return;
  useAuthStore.getState().setAuth({
    user: data.user ?? useAuthStore.getState().user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    sessionId: data.sessionId,
  });
  scheduleProactiveRefresh();
}

/** Validate session on app load — keeps local session if API is temporarily down. */
export async function bootstrapSession() {
  const { accessToken, refreshToken, user: cachedUser } = useAuthStore.getState();
  if (!accessToken && !refreshToken) {
    return { ok: false, reason: 'no_token' };
  }

  const expMs = getAccessTokenExpiryMs(accessToken);
  if (refreshToken && expMs && expMs <= Date.now() + 60_000) {
    const refreshed = await tryRefreshAccessToken();
    if (!refreshed) {
      return { ok: false, reason: 'expired' };
    }
  } else {
    scheduleProactiveRefresh();
  }

  try {
    const { user } = await request('/auth/me', {
      sessionRecovery: true,
      timeoutMs: 8_000,
      networkRetries: 1,
    });
    return { ok: true, user };
  } catch (err) {
    if (err instanceof SessionExpiredError || err.status === 401 || err.status === 404) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: true, user: cachedUser, offline: true };
  }
}

export const api = {
  register: async (body) => {
    const data = await request('/auth/register', { method: 'POST', body: withDeviceName(body), auth: false });
    persistAuthResponse(data);
    return data;
  },
  login: async (body) => {
    const data = await request('/auth/login', { method: 'POST', body: withDeviceName(body), auth: false });
    persistAuthResponse(data);
    return data;
  },
  claimSchoolRegistrationLink: (schoolLinkToken) =>
    request('/auth/school-link/claim', {
      method: 'POST',
      body: { schoolLinkToken },
    }),
  googleAuth: async (body) => {
    const data = await request('/auth/google', { method: 'POST', body: withDeviceName(body), auth: false });
    persistAuthResponse(data);
    return data;
  },
  googleAuthCode: async (body) => {
    const data = await request('/auth/google/code', { method: 'POST', body: withDeviceName(body), auth: false });
    persistAuthResponse(data);
    return data;
  },
  logout: () => {
    const { refreshToken } = useAuthStore.getState();
    return request('/auth/logout', {
      method: 'POST',
      body: refreshToken ? { refreshToken } : undefined,
    }).finally(() => {
      if (proactiveRefreshTimer) clearTimeout(proactiveRefreshTimer);
    });
  },
  getSessions: () => request('/auth/sessions'),
  revokeSession: (sessionId) => request(`/auth/sessions/${sessionId}`, { method: 'DELETE' }),
  revokeOtherSessions: () => request('/auth/sessions', { method: 'DELETE' }),
  me: () => request('/auth/me'),
  checkUsername: (username) =>
    request(`/users/check-username?username=${encodeURIComponent(username)}`),
  patchUsername: (username) => request('/users/me/username', { method: 'PATCH', body: { username } }),
  patchMe: (body) => request('/users/me', { method: 'PATCH', body }),
  patchProfile: (body) => request('/users/me/profile', { method: 'PATCH', body }),
  patchSproutGuardian: (body) => request('/users/me/sprout-guardian', { method: 'PATCH', body }),
  patchJourneyRole: (body) => request('/users/me/journey-role', { method: 'PATCH', body }),
  patchLocation: (body) => request('/users/me/location', { method: 'PATCH', body }),
  deferLocation: () => request('/users/me/location/defer', { method: 'POST' }),
  getGeoCountries: () => request('/geo/countries'),
  getGeoStates: (countryName) =>
    request(`/geo/states?countryName=${encodeURIComponent(countryName)}`),
  getGeoCities: (countryName, stateName) =>
    request(
      `/geo/cities?countryName=${encodeURIComponent(countryName)}&stateName=${encodeURIComponent(stateName)}`,
    ),
  addCity: (stateId, name) =>
    request('/geo/cities', { method: 'POST', body: { stateId, name } }),
  searchOrganizations: (q, cityId) => {
    const params = new URLSearchParams({ q });
    if (cityId) params.set('cityId', cityId);
    return request(`/organizations/search?${params.toString()}`);
  },
  getSchoolOptions: ({ countryName, stateName, cityName, standard, section } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ countryName, stateName, cityName, standard, section })) {
      if (value && value !== 'Any') params.set(key, value);
    }
    return request(`/organizations/school-options?${params}`);
  },
  expressOrganizationInterest: (body) =>
    request('/organizations/interest', { method: 'POST', body }),
  getBelongingOverview: () => request('/organizations/belonging/me'),
  deferBelonging: () => request('/organizations/belonging/defer', { method: 'POST' }),
  requestOrganizationMembership: (body) =>
    request('/organizations/membership/request', { method: 'POST', body }),
  acknowledgeOrgVerifiedPrompt: (organizationId) =>
    request('/organizations/prompts/org-verified/ack', {
      method: 'POST',
      body: { organizationId },
    }),
  getFlowLeadership: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.who) params.set('who', opts.who);
    if (opts.where) params.set('where', opts.where);
    if (opts.ageGroup) params.set('ageGroup', opts.ageGroup);
    if (opts.countryId) params.set('countryId', opts.countryId);
    if (opts.stateId) params.set('stateId', opts.stateId);
    if (opts.cityId) params.set('cityId', opts.cityId);
    if (opts.countryName) params.set('countryName', opts.countryName);
    if (opts.stateName) params.set('stateName', opts.stateName);
    if (opts.cityName) params.set('cityName', opts.cityName);
    if (opts.organizationId) params.set('organizationId', opts.organizationId);
    if (opts.schoolStandard) params.set('schoolStandard', opts.schoolStandard);
    if (opts.schoolSection) params.set('schoolSection', opts.schoolSection);
    const qs = params.toString();
    return request(`/leadership/me${qs ? `?${qs}` : ''}`);
  },
  getLeadershipLeaderboard: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.who) params.set('who', opts.who);
    if (opts.where) params.set('where', opts.where);
    if (opts.ageGroup) params.set('ageGroup', opts.ageGroup);
    if (opts.countryId) params.set('countryId', opts.countryId);
    if (opts.stateId) params.set('stateId', opts.stateId);
    if (opts.cityId) params.set('cityId', opts.cityId);
    if (opts.countryName) params.set('countryName', opts.countryName);
    if (opts.stateName) params.set('stateName', opts.stateName);
    if (opts.cityName) params.set('cityName', opts.cityName);
    if (opts.organizationId) params.set('organizationId', opts.organizationId);
    if (opts.schoolStandard) params.set('schoolStandard', opts.schoolStandard);
    if (opts.schoolSection) params.set('schoolSection', opts.schoolSection);
    const qs = params.toString();
    return request(`/leadership/list${qs ? `?${qs}` : ''}`);
  },
  patchAvatar: (avatarUrl) => request('/users/me/avatar', { method: 'PATCH', body: { avatarUrl } }),
  patchAgeCategory: (ageCategory) =>
    request('/users/me/age-category', { method: 'PATCH', body: { ageCategory } }),
  patchFamily: (body) => request('/users/me/family', { method: 'PATCH', body }),
  skipFamily: (body) => request('/users/me/family/skip', { method: 'POST', body }),
  patchGofamWeekStart: (gofamWeekStartDay) =>
    request('/users/me/gofam-week-start', { method: 'PATCH', body: { gofamWeekStartDay } }),
  getFlowWeek: () => request('/flow-week/me'),
  getFlowWeekStreak: () => request('/flow-week/streak'),
  resolveMissedDayWithStreak: (dayAssignmentId) =>
    request(`/flow-week/missed-days/${dayAssignmentId}/resolve-with-streak`, { method: 'POST' }),
  getFlowWeekChakras: () => request('/flow-week/chakras'),
  getFlowWeekDayMissionPreview: (dayIndex) =>
    request(`/flow-week/days/${dayIndex}/mission-preview`),
  getFlowWeekDayMissionOptions: (dayIndex) =>
    request(`/flow-week/days/${dayIndex}/mission-options`),
  confirmFlowWeekDayMissions: (dayIndex, missionIds) =>
    request(`/flow-week/days/${dayIndex}/confirm-missions`, {
      method: 'POST',
      body: { missionIds },
    }),
  getFlowWeekTodayMissionOptions: () => request('/flow-week/today/mission-options'),
  getFlowWeekTodayOptionalMissions: () => request('/flow-week/today/optional-missions'),
  confirmFlowWeekTodayMissions: (missionIds) =>
    request('/flow-week/today/confirm-missions', { method: 'POST', body: { missionIds } }),
  startFlowWeekMission: (missionId, { dayAssignmentId } = {}) =>
    request(`/flow-week/missions/${missionId}/start`, {
      method: 'POST',
      body: dayAssignmentId ? { dayAssignmentId } : {},
    }),
  completeFlowWeekMission: (missionId, { dayAssignmentId } = {}) =>
    request(`/flow-week/missions/${missionId}/complete`, {
      method: 'POST',
      body: dayAssignmentId ? { dayAssignmentId } : {},
    }),
  getFamilyMembers: () => request('/families/me/members'),
  getFamilyInvites: () => request('/families/me/invites'),
  acceptFamilyInvite: (inviteId) =>
    request(`/families/invites/${inviteId}/accept`, { method: 'POST' }),
  inviteFamilyMember: (body) =>
    request('/families/me/invites', { method: 'POST', body }),
  getAvatarOptions: () => request('/avatar-assets/options'),
  getHills: () => request('/hills'),
  getHarvestRewards: () => request('/glow-seeds/harvest'),
  getGlowHub: () => request('/glow-seeds/me'),
  searchGlowPeople: (q) => request(`/glow-seeds/people?q=${encodeURIComponent(q)}`),
  sendGlowSeed: (username) => request('/glow-seeds/send', { method: 'POST', body: { username } }),
  createGlowShareLink: (origin) =>
    request('/glow-seeds/share-link', { method: 'POST', body: origin ? { origin } : {} }),
  previewGlowInvite: (token) => request(`/glow-seeds/invite/${encodeURIComponent(token)}`, { auth: false }),
  claimGlowInvite: (token) =>
    request(`/glow-seeds/invite/${encodeURIComponent(token)}/claim`, { method: 'POST' }),
  getGlowFriends: () => request('/glow-seeds/friends'),
  getPlantedProgress: (userId) => request(`/glow-seeds/planted/${encodeURIComponent(userId)}`),
  acceptGlowSeed: (seedId) => request(`/glow-seeds/${seedId}/accept`, { method: 'POST' }),
  getGlowSeed: (seedId) => request(`/glow-seeds/${seedId}`),
  getPendingGlowSeed: () => request('/glow-seeds/pending/me'),
  plantDevGlowSeed: () => request('/glow-seeds/dev/plant-for-me', { method: 'POST' }),
  submitGapAssessment: (responses) =>
    request('/gap-assessment', { method: 'POST', body: { responses } }),
  getGapQuestions: () => request('/gap-assessment/questions'),
  getMyGapAssessment: () => request('/gap-assessment/me'),
  getMyJourney: () => request('/journey/me', { sessionRecovery: true }),
  getFocusHillMissionOptions: () => request('/journey/me/focus-hill/options'),
  getBlockSelectionOptions: () => request('/journey/me/block-selection/options'),
  selectFocusHillMissions: (missionIds) =>
    request('/journey/me/select-focus-missions', { method: 'POST', body: { missionIds } }),
  selectBlockMissions: (missionIds) =>
    request('/journey/me/select-block-missions', { method: 'POST', body: { missionIds } }),
  startMission: (missionId) =>
    request(`/journey/me/missions/${missionId}/start`, { method: 'POST' }),
  completeMission: (missionId) =>
    request(`/journey/me/missions/${missionId}/complete`, { method: 'POST' }),
  getMissionAlternates: ({ hillId, slotMissionId, selectedMissionIds, context }) => {
    const params = new URLSearchParams({
      hillId,
      slotMissionId,
      selectedMissionIds: selectedMissionIds.join(','),
      context,
    });
    return request(`/journey/me/mission-alternates?${params.toString()}`);
  },
  recordMissionSwap: (body) =>
    request('/journey/me/mission-swaps', { method: 'POST', body }),
  completeOnboarding: () => request('/users/me/onboarding-complete', { method: 'PATCH' }),
  getDashboardHome: () =>
    request('/dashboard/home', { timeoutMs: 20_000, networkRetries: 1 }),
  getProfile: ({ timeoutMs, networkRetries } = {}) =>
    request('/profile/me', { timeoutMs, networkRetries }),
  getTreeProgress: () => request('/tree/me'),
  getTreeJourney: () => request('/tree/journey'),

  adminLogin: (body) => request('/auth/admin/login', { method: 'POST', body, auth: false }),
  adminPasswordReset: (body) =>
    request('/auth/admin/password/reset', { method: 'POST', body, auth: false }),
  adminMe: () => request('/auth/admin/me'),
  adminRoles: () => request('/auth/admin/roles', { auth: false }),

  admin: {
    getOverview: () => request('/admin/overview'),
    getMissionEngineOverview: () => request('/admin/mission-engine/overview'),
    getMissions: ({ page = 1, pageSize = 25, categoryCode, hillCode, missionGroup, search } = {}) => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (categoryCode) params.set('categoryCode', categoryCode);
      if (hillCode) params.set('hillCode', hillCode);
      if (missionGroup) params.set('missionGroup', String(missionGroup));
      if (search) params.set('search', search);
      return request(`/admin/mission-engine/missions?${params.toString()}`);
    },
    getMission: (id) => request(`/admin/mission-engine/missions/${id}`),
    patchMission: (id, body) =>
      request(`/admin/mission-engine/missions/${id}`, { method: 'PATCH', body }),
    getJourneyOverview: () => request('/admin/journey/overview'),
    getJourneyAnalytics: () => request('/admin/journey/analytics'),
    getJourneyUsers: ({
      page = 1,
      pageSize = 25,
      search,
      hillCode,
      campId,
      stepMin,
      stepMax,
    } = {}) => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      if (hillCode) params.set('hillCode', hillCode);
      if (campId) params.set('campId', campId);
      if (stepMin !== '' && stepMin != null) params.set('stepMin', String(stepMin));
      if (stepMax !== '' && stepMax != null) params.set('stepMax', String(stepMax));
      return request(`/admin/journey/users?${params.toString()}`);
    },
    patchCamp: (id, body) => request(`/admin/journey/camps/${id}`, { method: 'PATCH', body }),
    getGlowOverview: () => request('/admin/glow/overview'),
    getGlowAnalytics: () => request('/admin/glow/analytics'),
    getGlowSeeds: ({
      page = 1,
      pageSize = 25,
      search,
      status,
      dateFrom,
      dateTo,
      flaggedOnly,
    } = {}) => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (flaggedOnly) params.set('flaggedOnly', '1');
      return request(`/admin/glow/seeds?${params.toString()}`);
    },
    getTrustSafetyOverview: ({ page = 1, pageSize = 25, search } = {}) => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      return request(`/admin/trust-safety/overview?${params.toString()}`);
    },
    listAvatarAssets: ({ page = 1, pageSize = 25, search = '', status = '' } = {}) => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      return request(`/admin/avatar-assets?${params.toString()}`);
    },
    createAvatarAsset: (body) => request('/admin/avatar-assets', { method: 'POST', body }),
    updateAvatarAsset: (id, body) => request(`/admin/avatar-assets/${id}`, { method: 'PATCH', body }),
    deleteAvatarAsset: (id) => request(`/admin/avatar-assets/${id}`, { method: 'DELETE' }),
    patchUserStatus: (id, body) =>
      request(`/admin/trust-safety/users/${id}/status`, { method: 'PATCH', body }),
    getUserDetail: (id) => request(`/admin/trust-safety/users/${id}`),
    deleteUser: (id) => request(`/admin/trust-safety/users/${id}`, { method: 'DELETE' }),
    getAuditLogs: ({
      page = 1,
      pageSize = 50,
      search,
      module,
      action,
      dateFrom,
      dateTo,
    } = {}) => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      if (module) params.set('module', module);
      if (action) params.set('action', action);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      return request(`/admin/audit/logs?${params.toString()}`);
    },
    clearAuditLogs: () => request('/admin/audit/logs', { method: 'DELETE' }),
    getOrganizationsOverview: ({
      page = 1,
      pageSize = 25,
      search,
      status,
      minInterest,
      demandTier,
    } = {}) => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (minInterest != null && minInterest !== '') params.set('minInterest', String(minInterest));
      if (demandTier) params.set('demandTier', demandTier);
      return request(`/admin/organizations/overview?${params.toString()}`);
    },
    getOrganization: (id) => request(`/admin/organizations/${id}`),
    getOrganizationPendingMemberships: (id) =>
      request(`/admin/organizations/${id}/memberships/pending`),
    verifyOrganization: (id) => request(`/admin/organizations/${id}/verify`, { method: 'POST' }),
    createSchoolRegistrationLink: (body) =>
      request('/admin/organizations/registration-links', { method: 'POST', body }),
    createSchoolRegistrationLinks: (body) =>
      request('/admin/organizations/registration-links/bulk', { method: 'POST', body }),
    listSchoolRegistrationLinks: ({ page = 1, pageSize = 25, search } = {}) => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      return request(`/admin/organizations/registration-links?${params}`);
    },
    getSchoolRegistrationLinksForExport: (organizationId) =>
      request(`/admin/organizations/registration-links/school/${encodeURIComponent(organizationId)}/export`),
    getSchoolLinkStudents: (linkId, { page = 1, pageSize = 25, search } = {}) => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      return request(`/admin/organizations/registration-links/${linkId}/students?${params}`);
    },
    patchOrganizationMembership: (orgId, membershipId, body) =>
      request(`/admin/organizations/${orgId}/memberships/${membershipId}`, {
        method: 'PATCH',
        body,
      }),
  },
};
