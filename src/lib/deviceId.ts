const STORAGE_KEY = 'calc-device';

/**
 * A random, non-identifying device id generated once on first launch and
 * reused for unlock-attempt rate limiting when there is no session yet.
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // Private browsing / storage blocked: fall back to a session-only id.
    return crypto.randomUUID();
  }
}
