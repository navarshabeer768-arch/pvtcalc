-- Core schema: extensions, tables, indexes.
-- See 0002_functions_triggers.sql for helper functions and triggers,
-- 0003_rls.sql for Row Level Security, 0004_storage.sql for buckets/policies,
-- 0005_realtime.sql for the Realtime publication.

create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_path text,
  email text not null,
  last_seen timestamptz not null default now(),
  is_online boolean not null default false,
  pronoun_label text not null default 'She' check (pronoun_label in ('She', 'He')),
  created_at timestamptz not null default now()
);

create table user_settings (
  user_id uuid primary key references profiles(id) on delete cascade,
  theme text not null default 'default' check (theme in ('default', 'pink', 'purple', 'midnight', 'custom')),
  accent_color text,
  chat_background jsonb,
  font_size text not null default 'default' check (font_size in ('small', 'default', 'large')),
  show_online boolean not null default true,
  send_read_receipts boolean not null default true,
  auto_lock_seconds integer not null default 120 check (auto_lock_seconds > 0),
  updated_at timestamptz not null default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);
create index conversation_members_user_id_idx on conversation_members(user_id);

create table couple_profile (
  conversation_id uuid primary key references conversations(id) on delete cascade,
  nickname text,
  relationship_start date,
  background_path text,
  tagline text,
  updated_at timestamptz not null default now()
);

create table messages (
  id uuid primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  message_type text not null check (message_type in ('text', 'image', 'voice')),
  content text,
  media_path text,
  media_meta jsonb,
  reply_to_id uuid references messages(id) on delete set null,
  is_edited boolean not null default false,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  search_tsv tsvector generated always as (to_tsvector('english', coalesce(content, ''))) stored
);
create index messages_conversation_created_idx on messages(conversation_id, created_at desc, id desc);
create index messages_sender_idx on messages(sender_id);
create index messages_reply_to_idx on messages(reply_to_id);
create index messages_search_tsv_idx on messages using gin(search_tsv);

create table message_hidden (
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index message_hidden_user_idx on message_hidden(user_id);

create table message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);
create index message_reactions_message_idx on message_reactions(message_id);

create table message_reads (
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);
create index message_reads_user_read_idx on message_reads(user_id, read_at);

create table pinned_messages (
  message_id uuid primary key references messages(id) on delete cascade,
  pinned_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table favorite_messages (
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index favorite_messages_user_idx on favorite_messages(user_id);

create table memories (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  title text not null,
  description text,
  media_path text,
  source_message_id uuid references messages(id) on delete set null,
  date date,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index memories_conversation_idx on memories(conversation_id);

create table special_dates (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  title text not null,
  date date not null,
  type text not null check (type in ('anniversary', 'birthday', 'first_meeting', 'custom')),
  recurs_yearly boolean not null default false,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index special_dates_conversation_idx on special_dates(conversation_id);

-- No client access whatsoever: read/written only by Edge Functions using
-- the service role. RLS is enabled with zero policies in 0003_rls.sql.
create table unlock_codes (
  user_id uuid primary key references profiles(id) on delete cascade,
  code_hash text not null,
  updated_at timestamptz not null default now()
);

create table unlock_attempts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
create index unlock_attempts_subject_created_idx on unlock_attempts(subject, created_at desc);
