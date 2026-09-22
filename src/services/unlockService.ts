import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';
import type { UnlockResult } from '../app/lockState';

/**
 * Calls the `unlock` Edge Function, which holds the service-role key and
 * does the actual bcrypt comparison server-side. The client never sees any
 * code hash or which user (if any) the code belongs to.
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

export interface SignInResult {
  success: boolean;
  message?: string;
}

export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, message: error.message };
  return { success: true };
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
