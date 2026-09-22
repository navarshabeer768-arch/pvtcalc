-- Helper functions and triggers.

-- security definer with a fixed search_path so it can't be tricked by a
-- caller-controlled search_path, and so RLS policies can call it cheaply.
create or replace function is_conversation_member(conv uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from conversation_members
    where conversation_id = conv and user_id = auth.uid()
  );
$$;

-- Restricts UPDATE on messages to sender_id = auth.uid() (enforced by RLS),
-- and further restricts *which columns* may change: only content,
-- is_edited, edited_at, deleted_at. Also blocks editing non-text or
-- already-deleted messages.
create or replace function enforce_message_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.message_type is distinct from old.message_type
     or new.media_path is distinct from old.media_path
     or new.media_meta is distinct from old.media_meta
     or new.reply_to_id is distinct from old.reply_to_id
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Only content, is_edited, edited_at, and deleted_at may be changed';
  end if;

  -- A "delete for everyone" update (setting deleted_at) is always allowed
  -- regardless of message type. A content edit is text-only and blocked
  -- once the message is deleted.
  if new.content is distinct from old.content or new.is_edited is distinct from old.is_edited then
    if old.message_type <> 'text' then
      raise exception 'Only text messages can be edited';
    end if;
    if old.deleted_at is not null then
      raise exception 'Deleted messages cannot be edited';
    end if;
  end if;

  return new;
end;
$$;

create trigger messages_enforce_update_rules
  before update on messages
  for each row
  execute function enforce_message_update_rules();

-- Keeps profiles.id and profiles.email immutable from the client (RLS also
-- restricts updates to the owner; this belt-and-suspenders trigger blocks
-- those two columns specifically even for the owner).
create or replace function enforce_profile_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id or new.email is distinct from old.email then
    raise exception 'id and email cannot be changed';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_update_rules
  before update on profiles
  for each row
  execute function enforce_profile_update_rules();
