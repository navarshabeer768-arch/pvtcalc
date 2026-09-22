import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars are not set. Configure .env before running the app for real.');
}

/**
 * Neutral storage key so the auth session in localStorage never says "chat"
 * or "couple" to a casual observer inspecting site data.
 */
export const supabase = createClient<Database>(url ?? '', anonKey ?? '', {
  auth: {
    storageKey: 'calc-state',
    persistSession: true,
    autoRefreshToken: true,
  },
});
