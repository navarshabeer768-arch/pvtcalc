export type LockView = 'calculator' | 'unlocked';

export interface UnlockSession {
  accessToken: string;
  refreshToken: string;
}

export type UnlockResult =
  // `session` is present when this device had no prior Supabase session for
  // that user: the code alone re-establishes one, minted server-side via a
  // one-time magic-link token (never a password — see the `unlock` Edge
  // Function). The client just calls supabase.auth.setSession(session).
  | { status: 'unlocked'; session?: UnlockSession }
  | { status: 'no_match' }
  | { status: 'locked'; retryAfter: number };

export interface LockoutState {
  lockedUntil: number | null; // epoch ms
  failedAttempts: number;
}

const LOCKOUT_SCHEDULE_SECONDS = [30, 60, 300, 900]; // 30s, 1m, 5m, 15m
const ATTEMPTS_BEFORE_LOCKOUT = 5;

/**
 * Pure function mirroring the server-side lockout schedule, used only to
 * drive the disabled-keypad UI optimistically. The Edge Function is the
 * source of truth and is re-checked on every attempt.
 */
export function nextLockoutSeconds(failedAttemptsSoFar: number): number | null {
  if (failedAttemptsSoFar < ATTEMPTS_BEFORE_LOCKOUT) return null;
  const escalationIndex = Math.min(
    failedAttemptsSoFar - ATTEMPTS_BEFORE_LOCKOUT,
    LOCKOUT_SCHEDULE_SECONDS.length - 1
  );
  return LOCKOUT_SCHEDULE_SECONDS[escalationIndex];
}

export function isCodeShaped(input: string): boolean {
  return /^\d{4,8}$/.test(input);
}
