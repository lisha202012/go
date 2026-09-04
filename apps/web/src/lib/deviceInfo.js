/** Human-readable label for this browser/device (Section 53 Active Sessions). */
export function getDeviceLabel() {
  if (typeof navigator === 'undefined') return 'Web browser';

  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android device';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Macintosh|Mac OS/.test(ua)) return 'Mac';
  if (/CrOS/.test(ua)) return 'Chromebook';
  if (/Linux/.test(ua)) return 'Linux device';
  return 'Web browser';
}

/** Decode JWT exp claim (ms since epoch) without verifying signature. */
export function getAccessTokenExpiryMs(accessToken) {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
