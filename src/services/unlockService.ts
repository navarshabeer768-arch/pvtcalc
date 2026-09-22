import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';
import type { UnlockResult } from '../app/lockState';

/**
 * Calls the `unlock` Edge Function, which holds the service-role key and
 * does the actual bcrypt comparison server-side. The client never sees any
 * code hash or which user (if any) the code belongs to. When this device
 * has no session yet, a correct code comes back with a `session` — call
 * `applyUnlockSession` with it to finish establishing a real Supabase
 * session without ever asking for an email or password.
 */
export async function checkUnlockCode(code: string): Promise<UnlockResult> {
  const deviceId = getDeviceId();

  const { data, error } = await supabase.functions.invoke<UnlockResult>('unlock', {
    body: { code, deviceId },
  });

  if (error || !data) {
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_UNLOCK_CODE) {
      // Dev-only fallback when the Edge Function is unreachable locally.
      // Tree-shaken out of production builds; the build fails if this var
      // is set for a production build (see vite.config.ts).
      if (code === import.meta.env.VITE_DEV_UNLOCK_CODE) {
        return { status: 'unlocked' };
      }
      return { status: 'no_match' };
    }
    return { status: 'no_match' };
  }

  return data;
}

export async function applyUnlockSession(session: { accessToken: string; refreshToken: string }): Promise<boolean> {
  const { error } = await supabase.auth.setSession({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });
  return !error;
}

export async function changeUnlockCode(currentCode: string, newCode: string): Promise<{ success: boolean; message?: string }> {
  const { data, error } = await supabase.functions.invoke<{ status: string; message?: string }>(
    'set-unlock-code',
    { body: { currentCode, newCode } }
  );

  if (error || !data || data.status !== 'ok') {
    return { success: false, message: data?.message ?? 'Could not update the code.' };
  }
  return { success: true };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
