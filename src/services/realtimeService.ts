import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { rowToMessage, type ChatMessage } from '../types/chat';
import type { MessageRow, ReactionRow } from '../types/chat';

export interface ConversationChannelHandlers {
  onMessageInsert: (message: ChatMessage) => void;
  onMessageUpdate: (message: ChatMessage) => void;
  onReactionChange: () => void;
  onReadChange: () => void;
  onPinChange: () => void;
  onTyping: (userId: string) => void;
  onPresenceSync: (onlineUserIds: Set<string>) => void;
}

/**
 * Opens exactly one Realtime channel per conversation, carrying Postgres
 * Changes (messages/reactions/reads/pins), typing Broadcast, and Presence.
 */
export function openConversationChannel(
  conversationId: string,
  userId: string,
  handlers: ConversationChannelHandlers
): RealtimeChannel {
  const channel = supabase.channel(`conversation:${conversationId}`, {
    config: { presence: { key: userId }, broadcast: { self: false } },
  });

  channel
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => handlers.onMessageInsert(rowToMessage(payload.new as MessageRow))
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => handlers.onMessageUpdate(rowToMessage(payload.new as MessageRow))
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'message_reactions' },
      () => handlers.onReactionChange()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'message_reads' },
      () => handlers.onReadChange()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pinned_messages' },
      () => handlers.onPinChange()
    )
    .on('broadcast', { event: 'typing' }, (payload) => {
      const from = (payload.payload as { userId?: string }).userId;
      if (from && from !== userId) handlers.onTyping(from);
    })
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      handlers.onPresenceSync(new Set(Object.keys(state)));
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

  return channel;
}

let lastTypingSentAt = 0;
const TYPING_THROTTLE_MS = 2000;

export function sendTyping(channel: RealtimeChannel, userId: string): void {
  const now = Date.now();
  if (now - lastTypingSentAt < TYPING_THROTTLE_MS) return;
  lastTypingSentAt = now;
  void channel.send({ type: 'broadcast', event: 'typing', payload: { userId } });
}

export type { ReactionRow };
