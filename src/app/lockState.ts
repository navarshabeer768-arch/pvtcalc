export type LockView =
  | 'calculator'
  | 'locked-out'
  | 'sign-in-required'
  | 'unlocked';

export type UnlockResult =
  | { status: 'unlocked' }
  | { status: 'login_required' }
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
