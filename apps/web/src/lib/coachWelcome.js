const STORAGE_KEY = 'gofam_coach_welcome_dismissed';

function readDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function dismissKey(item) {
  if (!item?.seedId) return null;
  if (item.phase) return `${item.phase}:${item.seedId}`;
  if (item.kind === 'monthly_surprise') return `monthly_surprise:${item.seedId}`;
  return null;
}

export function isCoachWelcomeDismissed(welcome) {
  const key = dismissKey(welcome);
  if (!key) return true;
  return Boolean(readDismissed()[key]);
}

export function dismissCoachWelcome(welcome) {
  const key = dismissKey(welcome);
  if (!key) return;
  const next = { ...readDismissed(), [key]: true };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function isCoachMonthlySurpriseDismissed(surprise) {
  const key = dismissKey({ ...surprise, kind: 'monthly_surprise' });
  if (!key) return true;
  return Boolean(readDismissed()[key]);
}

export function dismissCoachMonthlySurprise(surprise) {
  const key = dismissKey({ ...surprise, kind: 'monthly_surprise' });
  if (!key) return;
  const next = { ...readDismissed(), [key]: true };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
