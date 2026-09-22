import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { fetchMessages, markDelivered, sendTextMessage } from '../services/messageService';
import { openConversationChannel, sendTyping } from '../services/realtimeService';
import { cacheMessages, loadCachedMessages } from '../lib/idbCache';
import { queueTextMessage } from '../services/outboxService';
import type { ChatMessage } from '../types/chat';

const TYPING_EXPIRY_MS = 4000;

export function useConversationMessages(conversationId: string, userId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [extrasVersion, setExtrasVersion] = useState(0);
  const bumpExtras = useCallback(() => setExtrasVersion((v) => v + 1), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const upsertMessage = useCallback((incoming: ChatMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === incoming.id);
      if (idx === -1) return [...prev, incoming].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const next = [...prev];
      next[idx] = incoming;
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await loadCachedMessages(conversationId);
      if (!cancelled && cached.length > 0) setMessages(cached);

      try {
        const fresh = await fetchMessages(conversationId);
        if (cancelled) return;
        setMessages(fresh);
        setHasMore(fresh.length > 0);
        void cacheMessages(conversationId, fresh);
        void markDelivered(
          fresh.filter((m) => m.senderId !== userId).map((m) => m.id),
          userId
        );
      } catch {
        // Offline: keep showing cached messages.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, userId]);

  useEffect(() => {
    const channel = openConversationChannel(conversationId, userId, {
      onMessageInsert: (m) => {
        upsertMessage(m);
        if (m.senderId !== userId) void markDelivered([m.id], userId);
      },
      onMessageUpdate: upsertMessage,
      onReactionChange: bumpExtras,
      onReadChange: bumpExtras,
      onPinChange: bumpExtras,
      onTyping: () => {
        setPartnerTyping(true);
        if (typingExpiryRef.current) clearTimeout(typingExpiryRef.current);
        typingExpiryRef.current = setTimeout(() => setPartnerTyping(false), TYPING_EXPIRY_MS);
      },
      onPresenceSync: setOnlineUserIds,
    });
    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      if (typingExpiryRef.current) clearTimeout(typingExpiryRef.current);
    };
  }, [conversationId, userId, upsertMessage, bumpExtras]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || messages.length === 0 || !hasMore) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[0];
      const older = await fetchMessages(conversationId, { createdAt: oldest.createdAt, id: oldest.id });
      if (older.length === 0) setHasMore(false);
      setMessages((prev) => [...older, ...prev]);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, messages, loadingOlder, hasMore]);

  const send = useCallback(
    async (content: string, replyToId?: string | null) => {
      const id = crypto.randomUUID();
      const optimistic: ChatMessage = {
        id,
        conversationId,
        senderId: userId,
        type: 'text',
        content,
        mediaPath: null,
        mediaMeta: null,
        replyToId: replyToId ?? null,
        isEdited: false,
        editedAt: null,
        createdAt: new Date().toISOString(),
        deletedAt: null,
        pending: true,
      };
      upsertMessage(optimistic);

      if (!navigator.onLine) {
        await queueTextMessage({
          id,
          conversationId,
          senderId: userId,
          content,
          replyToId: replyToId ?? null,
          createdAt: optimistic.createdAt,
        });
        return;
      }

      try {
        const saved = await sendTextMessage({ id, conversationId, senderId: userId, content, replyToId });
        upsertMessage(saved);
      } catch {
        upsertMessage({ ...optimistic, pending: false, failed: true });
      }
    },
    [conversationId, userId, upsertMessage]
  );

  const notifyTyping = useCallback(() => {
    if (channelRef.current) sendTyping(channelRef.current, userId);
  }, [userId]);

  return {
    messages,
    setMessages,
    loadOlder,
    loadingOlder,
    hasMore,
    send,
    notifyTyping,
    partnerTyping,
    onlineUserIds,
    extrasVersion,
  };
}
