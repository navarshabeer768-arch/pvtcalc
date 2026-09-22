import { useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useChatContext } from '../app/ChatContext';
import { useConversationMessages } from '../hooks/useConversationMessages';
import { useMessageExtras } from '../hooks/useMessageExtras';
import { MessageBubble, replySnippet } from '../components/chat/MessageBubble';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { Composer } from '../components/chat/Composer';
import { ActionSheet } from '../components/sheets/ActionSheet';
import { dateSeparatorLabel } from '../utils/dateGrouping';
import type { ChatView } from './ChatApp';
import type { ChatMessage } from '../types/chat';
import {
  deleteForEveryone,
  deleteForMe,
  editMessage,
  favoriteMessage,
  markRead,
  pinMessage,
  sendMediaMessage,
  toggleReaction,
  unfavoriteMessage,
  unpinMessage,
} from '../services/messageService';
import { assertValidUpload, buildStoragePath, uploadFile, ALLOWED_IMAGE_TYPES, ALLOWED_AUDIO_TYPES } from '../services/storageService';
import { processImageForUpload } from '../utils/imageProcessing';

const REACTIONS = ['❤️', '😂', '😭', '😍', '👍🏻', '🥺'];

interface ChatPageProps {
  onLock: () => void;
  onNavigate: (view: ChatView) => void;
}

type ListItem = { kind: 'separator'; label: string; key: string } | { kind: 'message'; message: ChatMessage };

export function ChatPage({ onLock, onNavigate }: ChatPageProps) {
  const { conversationId, me, partner, settings } = useChatContext();
  const {
    messages,
    loadOlder,
    send,
    notifyTyping,
    partnerTyping,
    onlineUserIds,
    extrasVersion,
  } = useConversationMessages(conversationId, me.id);
  const { reactions, reads, pinnedIds, favoriteIds, hiddenIds } = useMessageExtras(conversationId, me.id, extrasVersion);

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [actionsFor, setActionsFor] = useState<ChatMessage | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [reactingTo, setReactingTo] = useState<ChatMessage | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  // Approximates "viewed in the open chat": while this screen is mounted,
  // mark incoming partner messages as read, unless the user disabled receipts.
  useEffect(() => {
    if (!settings.send_read_receipts) return;
    const unreadFromPartner = messages
      .filter((m) => m.senderId === partner.id && !reads[m.id]?.some((r) => r.userId === me.id && r.readAt))
      .map((m) => m.id);
    if (unreadFromPartner.length > 0) void markRead(unreadFromPartner, me.id);
  }, [messages, reads, settings.send_read_receipts, partner.id, me.id]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !hiddenIds.has(m.id)),
    [messages, hiddenIds]
  );

  const items = useMemo<ListItem[]>(() => {
    const result: ListItem[] = [];
    let lastLabel = '';
    for (const m of visibleMessages) {
      const label = dateSeparatorLabel(m.createdAt);
      if (label !== lastLabel) {
        result.push({ kind: 'separator', label, key: `sep-${m.id}` });
        lastLabel = label;
      }
      result.push({ kind: 'message', message: m });
    }
    return result;
  }, [visibleMessages]);

  const isPartnerOnline = settings.show_online && onlineUserIds.has(partner.id);

  const readStateFor = (message: ChatMessage): 'sent' | 'delivered' | 'read' => {
    if (message.senderId !== me.id) return 'sent';
    const partnerRead = reads[message.id]?.find((r) => r.userId === partner.id);
    if (partnerRead?.readAt) return 'read';
    if (partnerRead?.deliveredAt) return 'delivered';
    return 'sent';
  };

  const jumpTo = (id: string) => {
    const idx = items.findIndex((it) => it.kind === 'message' && it.message.id === id);
    if (idx >= 0) {
      virtuosoRef.current?.scrollToIndex({ index: idx, align: 'center', behavior: 'smooth' });
      setHighlightedId(id);
      setTimeout(() => setHighlightedId(null), 1500);
    }
  };

  const handleSendImage = async (file: File, caption: string) => {
    try {
      assertValidUpload(file, ALLOWED_IMAGE_TYPES);
      const processed = await processImageForUpload(file);
      const path = buildStoragePath(conversationId, me.id, 'photo.webp');
      await uploadFile('chat-media', path, processed.blob, 'image/webp');
      await sendMediaMessage({
        id: crypto.randomUUID(),
        conversationId,
        senderId: me.id,
        type: 'image',
        mediaPath: path,
        mediaMeta: { width: processed.width, height: processed.height, mime: 'image/webp', size: processed.blob.size },
        content: caption || null,
        replyToId: replyTo?.id ?? null,
      });
      setReplyTo(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed. Try again.');
    }
  };

  const handleSendVoice = async (blob: Blob, mimeType: string, durationMs: number) => {
    try {
      assertValidUpload(blob, ALLOWED_AUDIO_TYPES);
      const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
      const path = buildStoragePath(conversationId, me.id, `voice.${ext}`);
      await uploadFile('chat-media', path, blob, mimeType);
      await sendMediaMessage({
        id: crypto.randomUUID(),
        conversationId,
        senderId: me.id,
        type: 'voice',
        mediaPath: path,
        mediaMeta: { duration: durationMs, mime: mimeType, size: blob.size },
        replyToId: replyTo?.id ?? null,
      });
      setReplyTo(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed. Try again.');
    }
  };

  const openActionsFor = (message: ChatMessage) => setActionsFor(message);

  const actionOptions = actionsFor
    ? (() => {
        const mine = actionsFor.id && actionsFor.senderId === me.id;
        const opts = [
          { label: 'Reply', onSelect: () => setReplyTo(actionsFor) },
          { label: 'React', onSelect: () => setReactingTo(actionsFor) },
          {
            label: 'Copy',
            onSelect: () => actionsFor.content && void navigator.clipboard.writeText(actionsFor.content),
          },
          ...(mine && actionsFor.type === 'text'
            ? [{ label: 'Edit', onSelect: () => setEditingMessage(actionsFor) }]
            : []),
          {
            label: pinnedIds.has(actionsFor.id) ? 'Unpin' : 'Pin',
            onSelect: () =>
              void (pinnedIds.has(actionsFor.id)
                ? unpinMessage(actionsFor.id)
                : pinMessage(actionsFor.id, me.id)),
          },
          {
            label: favoriteIds.has(actionsFor.id) ? 'Unfavorite' : 'Favorite',
            onSelect: () =>
              void (favoriteIds.has(actionsFor.id)
                ? unfavoriteMessage(actionsFor.id, me.id)
                : favoriteMessage(actionsFor.id, me.id)),
          },
          ...(mine
            ? [{ label: 'Delete', onSelect: () => void deleteForEveryone(actionsFor.id), destructive: true }]
            : [{ label: 'Delete for me', onSelect: () => void deleteForMe(actionsFor.id, me.id), destructive: true }]),
        ];
        return opts;
      })()
    : [];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-black/5 px-3 py-2">
        <button onClick={onLock} aria-label="Back to calculator" className="text-xl">
          ←
        </button>
        <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--surface)]" aria-hidden />
        <button className="flex-1 text-left" onClick={() => onNavigate('couple')}>
          <div className="font-semibold leading-tight">{partner.name}</div>
          <div className="text-xs text-[var(--text-muted)]">
            {partnerTyping ? `${partner.pronoun_label} is typing…` : isPartnerOnline ? 'Online' : 'Last seen recently'}
          </div>
        </button>
        <button onClick={() => onNavigate('search')} aria-label="Search" className="text-xl">
          🔍
        </button>
        <button onClick={() => onNavigate('settings')} aria-label="Menu" className="text-xl">
          ⋮
        </button>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center text-[var(--text-muted)]">
          <span className="text-2xl">❤️</span>
          <span>This is where your story begins.</span>
        </div>
      ) : (
        <Virtuoso
          ref={virtuosoRef}
          className="flex-1"
          data={items}
          initialTopMostItemIndex={items.length - 1}
          startReached={() => void loadOlder()}
          followOutput="smooth"
          itemContent={(_, item) => {
            if (item.kind === 'separator') {
              return (
                <div className="my-2 flex justify-center">
                  <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-muted)]">
                    {item.label}
                  </span>
                </div>
              );
            }
            const m = item.message;
            const replyOriginal = m.replyToId ? messagesById.get(m.replyToId) : null;
            return (
              <MessageBubble
                message={m}
                isMine={m.senderId === me.id}
                reactions={reactions[m.id] ?? []}
                isPinned={pinnedIds.has(m.id)}
                isFavorite={favoriteIds.has(m.id)}
                readState={readStateFor(m)}
                highlighted={highlightedId === m.id}
                replyPreview={
                  m.replyToId
                    ? {
                        senderLabel: replyOriginal
                          ? replyOriginal.senderId === me.id
                            ? 'You'
                            : partner.name
                          : 'Deleted message',
                        snippet: replyOriginal ? replySnippet(replyOriginal) : 'Deleted message',
                      }
                    : null
                }
                onOpenActions={() => openActionsFor(m)}
                onTapReply={() => m.replyToId && jumpTo(m.replyToId)}
                onOpenMedia={() => {}}
              />
            );
          }}
        />
      )}

      {partnerTyping && <TypingIndicator label={`${partner.pronoun_label} is typing…`} />}

      <Composer
        replyPreview={
          replyTo ? { senderLabel: replyTo.senderId === me.id ? 'You' : partner.name, snippet: replySnippet(replyTo) } : null
        }
        onCancelReply={() => setReplyTo(null)}
        onSendText={(text) => {
          if (editingMessage) {
            void editMessage(editingMessage.id, text);
            setEditingMessage(null);
            return;
          }
          void send(text, replyTo?.id);
          setReplyTo(null);
        }}
        onSendImage={(file, caption) => void handleSendImage(file, caption)}
        onSendVoice={(blob, mime, dur) => void handleSendVoice(blob, mime, dur)}
        onTyping={notifyTyping}
      />

      {actionsFor && <ActionSheet options={actionOptions} onClose={() => setActionsFor(null)} />}

      {reactingTo && (
        <ActionSheet
          options={REACTIONS.map((r) => ({
            label: r,
            onSelect: () => void toggleReaction(reactingTo.id, me.id, r),
          }))}
          onClose={() => setReactingTo(null)}
        />
      )}
    </div>
  );
}
