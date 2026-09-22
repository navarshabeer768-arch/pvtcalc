import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

export type Memory = Database['public']['Tables']['memories']['Row'];
export type SpecialDate = Database['public']['Tables']['special_dates']['Row'];

export async function listMemories(conversationId: string): Promise<Memory[]> {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('date', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function addMemory(memory: Omit<Memory, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('memories').insert(memory);
  if (error) throw error;
}

export async function deleteMemory(id: string): Promise<void> {
  const { error } = await supabase.from('memories').delete().eq('id', id);
  if (error) throw error;
}

export async function listSpecialDates(conversationId: string): Promise<SpecialDate[]> {
  const { data, error } = await supabase
    .from('special_dates')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addSpecialDate(date: Omit<SpecialDate, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('special_dates').insert(date);
  if (error) throw error;
}

export async function deleteSpecialDate(id: string): Promise<void> {
  const { error } = await supabase.from('special_dates').delete().eq('id', id);
  if (error) throw error;
}

/** Days remaining until the next occurrence of a (possibly yearly-recurring) date. */
export function daysUntilNextOccurrence(date: string, recursYearly: boolean): number {
  const now = new Date();
  const target = new Date(date);

  if (recursYearly) {
    target.setFullYear(now.getFullYear());
    if (target.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
      target.setFullYear(now.getFullYear() + 1);
    }
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
}
