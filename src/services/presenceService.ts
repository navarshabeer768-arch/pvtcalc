import { supabase } from '../lib/supabase';

const HEARTBEAT_MS = 60_000;

export async function markOnline(userId: string): Promise<void> {
  await supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', userId);
}

export async function markOffline(userId: string): Promise<void> {
  await supabase.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', userId);
}

export function startPresenceHeartbeat(userId: string): () => void {
  void markOnline(userId);
  const interval = setInterval(() => void markOnline(userId), HEARTBEAT_MS);

  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') void markOffline(userId);
    else void markOnline(userId);
  };
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('pagehide', () => void markOffline(userId));

  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}
