import type { Database, MediaMeta, MessageType } from './database';

export type MessageRow = Database['public']['Tables']['messages']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ReactionRow = Database['public']['Tables']['message_reactions']['Row'];

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string | null;
  mediaPath: string | null;
  mediaMeta: MediaMeta | null;
  replyToId: string | null;
  isEdited: boolean;
  editedAt: string | null;
  createdAt: string;
  deletedAt: string | null;
  // Client-only, derived state:
  pending?: boolean;
  failed?: boolean;
}

export function rowToMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    type: row.message_type,
    content: row.content,
    mediaPath: row.media_path,
    mediaMeta: row.media_meta,
    replyToId: row.reply_to_id,
    isEdited: row.is_edited,
    editedAt: row.edited_at,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

export type ReactionEmoji = '❤️' | '😂' | '😭' | '😍' | '👍🏻' | '🥺' | string;
