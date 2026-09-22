import { supabase } from '../lib/supabase';
import { rowToMessage, type ChatMessage } from '../types/chat';
import type { MessageType } from '../types/database';

const PAGE_SIZE = 50;

export async function fetchMessages(
  conversationId: string,
  before?: { createdAt: string; id: string }
): Promise<ChatMessage[]> {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);

  if (before) {
    query = query.or(
      `created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToMessage).reverse();
}

export interface SendTextParams {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  replyToId?: string | null;
}

export async function sendTextMessage(params: SendTextParams): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      id: params.id,
      conversation_id: params.conversationId,
      sender_id: params.senderId,
      message_type: 'text',
      content: params.content,
      reply_to_id: params.replyToId ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return rowToMessage(data);
}

export interface SendMediaParams {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  mediaPath: string;
  mediaMeta: Record<string, unknown>;
  content?: string | null;
  replyToId?: string | null;
}

export async function sendMediaMessage(params: SendMediaParams): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      id: params.id,
      conversation_id: params.conversationId,
      sender_id: params.senderId,
      message_type: params.type,
      media_path: params.mediaPath,
      media_meta: params.mediaMeta,
      content: params.content ?? null,
      reply_to_id: params.replyToId ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return rowToMessage(data);
}

export async function editMessage(messageId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ content, is_edited: true, edited_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

export async function deleteForEveryone(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ content: null, deleted_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

export async function deleteForMe(messageId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('message_hidden').insert({ message_id: messageId, user_id: userId });
  if (error) throw error;
}

export async function toggleReaction(messageId: string, userId: string, reaction: string): Promise<void> {
  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id, reaction')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing && existing.reaction === reaction) {
    await supabase.from('message_reactions').delete().eq('id', existing.id);
    return;
  }
  if (existing) {
    await supabase.from('message_reactions').update({ reaction }).eq('id', existing.id);
    return;
  }
  await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, reaction });
}

export async function pinMessage(messageId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('pinned_messages').insert({ message_id: messageId, pinned_by: userId });
  if (error) throw error;
}

export async function unpinMessage(messageId: string): Promise<void> {
  const { error } = await supabase.from('pinned_messages').delete().eq('message_id', messageId);
  if (error) throw error;
}

export async function favoriteMessage(messageId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('favorite_messages').insert({ message_id: messageId, user_id: userId });
  if (error) throw error;
}

export async function unfavoriteMessage(messageId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('favorite_messages')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function markDelivered(messageIds: string[], userId: string): Promise<void> {
  if (messageIds.length === 0) return;
  const rows = messageIds.map((message_id) => ({
    message_id,
    user_id: userId,
    delivered_at: new Date().toISOString(),
  }));
  await supabase.from('message_reads').upsert(rows, { onConflict: 'message_id,user_id', ignoreDuplicates: false });
}

export async function markRead(messageIds: string[], userId: string): Promise<void> {
  if (messageIds.length === 0) return;
  const rows = messageIds.map((message_id) => ({
    message_id,
    user_id: userId,
    read_at: new Date().toISOString(),
  }));
  await supabase.from('message_reads').upsert(rows, { onConflict: 'message_id,user_id', ignoreDuplicates: false });
}

export async function searchMessages(
  conversationId: string,
  queryText: string,
  filters: { pinnedOnly?: boolean; favoritesOnly?: boolean; senderId?: string } = {}
): Promise<ChatMessage[]> {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .textSearch('search_tsv', queryText, { type: 'websearch' })
    .order('created_at', { ascending: false })
    .limit(50);

  if (filters.senderId) query = query.eq('sender_id', filters.senderId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToMessage);
}
