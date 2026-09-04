import { useAuthStore } from '../store/useAuthStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

/** Admin ops tool — full page navigation (not SPA partial updates). */
export function buildAdminUrl(path, params = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      qs.set(key, String(value));
    }
  }
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

export function navigateAdminPage(path, params = {}) {
  window.location.assign(buildAdminUrl(path, params));
}

export function readAdminListParams(searchParams, defaults = {}) {
  const num = (key, fallback) => {
    const raw = searchParams.get(key);
    if (raw == null || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    page: num('page', defaults.page ?? 1),
    pageSize: num('pageSize', defaults.pageSize ?? 25),
    search: searchParams.get('search') ?? defaults.search ?? '',
    categoryCode: searchParams.get('categoryCode') ?? '',
    hillCode: searchParams.get('hillCode') ?? '',
    missionGroup: searchParams.get('missionGroup') ?? '',
    campId: searchParams.get('campId') ?? '',
    stepMin: searchParams.get('stepMin') ?? '',
    stepMax: searchParams.get('stepMax') ?? '',
    status: searchParams.get('status') ?? '',
    dateFrom: searchParams.get('dateFrom') ?? '',
    dateTo: searchParams.get('dateTo') ?? '',
    flaggedOnly: searchParams.get('flaggedOnly') === '1',
    module: searchParams.get('module') ?? '',
    action: searchParams.get('action') ?? '',
    minInterest: searchParams.get('minInterest') ?? '',
    demandTier: searchParams.get('demandTier') ?? '',
    orgId: searchParams.get('orgId') ?? '',
  };
}

export async function triggerAdminCsvDownload(basePath, params) {
  const { accessToken, sessionId } = useAuthStore.getState();
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      qs.set(key, String(value));
    }
  }
  const res = await fetch(`${API_URL}${basePath}?${qs.toString()}`, {
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
    },
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? 'export.csv';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
