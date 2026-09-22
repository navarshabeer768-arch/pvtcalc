import { supabase } from '../lib/supabase';

export interface ReactionSummary {
  [messageId: string]: Array<{ userId: string; reaction: string }>;
}

export interface ReadSummary {
  [messageId: string]: { deliveredAt: string | null; readAt: string | null; userId: string }[];
}

// Note: message_reactions/message_reads/pinned_messages/message_hidden rows
// are already scoped to messages the caller can see via RLS (see
// supabase/migrations), and this app has exactly one conversation per user
// pair, so these queries don't need to re-filter by conversation_id.
// `conversationId` is accepted for a future multi-conversation version and
// to keep call sites explicit about what's being fetched.

export async function fetchReactions(_conversationId: string): Promise<ReactionSummary> {
  const { data, error } = await supabase.from('message_reactions').select('message_id, user_id, reaction');
  if (error) throw error;

  const map: ReactionSummary = {};
  for (const row of data ?? []) {
    const list = map[row.message_id] ?? (map[row.message_id] = []);
    list.push({ userId: row.user_id, reaction: row.reaction });
  }
  return map;
}

export async function fetchReads(_conversationId: string): Promise<ReadSummary> {
  const { data, error } = await supabase.from('message_reads').select('message_id, user_id, delivered_at, read_at');
  if (error) throw error;

  const map: ReadSummary = {};
  for (const row of data ?? []) {
    const list = map[row.message_id] ?? (map[row.message_id] = []);
    list.push({ userId: row.user_id, deliveredAt: row.delivered_at, readAt: row.read_at });
  }
  return map;
}

export async function fetchPinnedIds(_conversationId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('pinned_messages').select('message_id');
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.message_id));
}

export async function fetchHiddenIds(_conversationId: string, userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('message_hidden').select('message_id').eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.message_id));
}

export async function fetchFavoriteIds(_conversationId: string, userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('favorite_messages').select('message_id').eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.message_id));
}
