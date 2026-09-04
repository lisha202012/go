/** Notify Tree of Life (Home/Journey) that a mission pulse was sent. */
export function triggerTreePulse({ hillCode, kind }) {
  if (!hillCode) return;
  const payload = { hillCode, kind, at: Date.now() };
  try {
    localStorage.setItem('gofam_tree_pulse', JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('gofam_tree_pulse'));
  } catch {
    // ignore
  }
}
