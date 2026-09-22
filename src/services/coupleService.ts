import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

export type CoupleProfile = Database['public']['Tables']['couple_profile']['Row'];

export async function getCoupleProfile(conversationId: string): Promise<CoupleProfile | null> {
  const { data, error } = await supabase
    .from('couple_profile')
    .select('*')
    .eq('conversation_id', conversationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertCoupleProfile(
  conversationId: string,
  patch: Partial<Omit<CoupleProfile, 'conversation_id' | 'updated_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('couple_profile')
    .upsert({ conversation_id: conversationId, ...patch, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export function daysTogether(relationshipStart: string | null): number | null {
  if (!relationshipStart) return null;
  const start = new Date(relationshipStart);
  const diffMs = Date.now() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
