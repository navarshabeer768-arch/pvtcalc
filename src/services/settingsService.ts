import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

export type UserSettings = Database['public']['Tables']['user_settings']['Row'];

const DEFAULTS: Omit<UserSettings, 'user_id' | 'updated_at'> = {
  theme: 'default',
  accent_color: null,
  chat_background: null,
  font_size: 'default',
  show_online: true,
  send_read_receipts: true,
  auto_lock_seconds: 120,
};

export async function getSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: created, error: createError } = await supabase
    .from('user_settings')
    .insert({ user_id: userId, ...DEFAULTS })
    .select('*')
    .single();
  if (createError) throw createError;
  return created;
}

export async function updateSettings(userId: string, patch: Partial<UserSettings>): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw error;
}
