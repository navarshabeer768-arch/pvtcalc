export type MessageType = 'text' | 'image' | 'voice';
export type SpecialDateType = 'anniversary' | 'birthday' | 'first_meeting' | 'custom';
export type Theme = 'default' | 'pink' | 'purple' | 'midnight' | 'custom';
export type FontSize = 'small' | 'default' | 'large';

export interface MediaMeta {
  width?: number;
  height?: number;
  duration?: number;
  mime?: string;
  size?: number;
}

export interface ChatBackground {
  kind: 'solid' | 'gradient' | 'pattern' | 'image';
  value: string;
}

interface Table<Row, InsertExtra extends object = object> {
  Row: Row;
  Insert: Partial<Row> & InsertExtra;
  Update: Partial<Row>;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          name: string;
          avatar_path: string | null;
          email: string;
          last_seen: string;
          is_online: boolean;
          pronoun_label: 'She' | 'He';
          created_at: string;
        },
        { id: string }
      >;
      user_settings: Table<
        {
          user_id: string;
          theme: Theme;
          accent_color: string | null;
          chat_background: ChatBackground | null;
          font_size: FontSize;
          show_online: boolean;
          send_read_receipts: boolean;
          auto_lock_seconds: number;
          updated_at: string;
        },
        { user_id: string }
      >;
      conversations: Table<{ id: string; created_at: string }>;
      conversation_members: Table<{ conversation_id: string; user_id: string }, { conversation_id: string; user_id: string }>;
      couple_profile: Table<
        {
          conversation_id: string;
          nickname: string | null;
          relationship_start: string | null;
          background_path: string | null;
          tagline: string | null;
          updated_at: string;
        },
        { conversation_id: string }
      >;
      messages: Table<
        {
          id: string;
          conversation_id: string;
          sender_id: string;
          message_type: MessageType;
          content: string | null;
          media_path: string | null;
          media_meta: MediaMeta | null;
          reply_to_id: string | null;
          is_edited: boolean;
          edited_at: string | null;
          created_at: string;
          deleted_at: string | null;
        },
        { id: string; conversation_id: string; sender_id: string; message_type: MessageType }
      >;
      message_hidden: Table<
        { message_id: string; user_id: string; created_at: string },
        { message_id: string; user_id: string }
      >;
      message_reactions: Table<
        { id: string; message_id: string; user_id: string; reaction: string; created_at: string },
        { message_id: string; user_id: string; reaction: string }
      >;
      message_reads: Table<
        { message_id: string; user_id: string; delivered_at: string | null; read_at: string | null },
        { message_id: string; user_id: string }
      >;
      pinned_messages: Table<
        { message_id: string; pinned_by: string; created_at: string },
        { message_id: string; pinned_by: string }
      >;
      favorite_messages: Table<
        { message_id: string; user_id: string; created_at: string },
        { message_id: string; user_id: string }
      >;
      memories: Table<
        {
          id: string;
          conversation_id: string;
          title: string;
          description: string | null;
          media_path: string | null;
          source_message_id: string | null;
          date: string | null;
          created_by: string;
          created_at: string;
        },
        { conversation_id: string; title: string; created_by: string }
      >;
      special_dates: Table<
        {
          id: string;
          conversation_id: string;
          title: string;
          date: string;
          type: SpecialDateType;
          recurs_yearly: boolean;
          created_by: string;
          created_at: string;
        },
        { conversation_id: string; title: string; date: string; type: SpecialDateType; created_by: string }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
