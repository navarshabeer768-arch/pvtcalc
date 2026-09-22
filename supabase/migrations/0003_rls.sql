-- Row Level Security. Enabled on every table; no table is readable by anon.

alter table profiles enable row level security;
alter table user_settings enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table couple_profile enable row level security;
alter table messages enable row level security;
alter table message_hidden enable row level security;
alter table message_reactions enable row level security;
alter table message_reads enable row level security;
alter table pinned_messages enable row level security;
alter table favorite_messages enable row level security;
alter table memories enable row level security;
alter table special_dates enable row level security;
alter table unlock_codes enable row level security;
alter table unlock_attempts enable row level security;

-- unlock_codes / unlock_attempts: RLS enabled, zero policies for anon and
-- authenticated. Only the service role (used exclusively inside Edge
-- Functions) can read or write these tables.

-- profiles: members of a shared conversation can read each other; each
-- user can update only their own row (id/email additionally locked by a
-- trigger in 0002).
create policy profiles_select_conversation_members on profiles
  for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from conversation_members my_membership
      join conversation_members their_membership
        on my_membership.conversation_id = their_membership.conversation_id
      where my_membership.user_id = auth.uid()
        and their_membership.user_id = profiles.id
    )
  );

create policy profiles_update_own on profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- user_settings: own rows only.
create policy user_settings_own on user_settings
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- conversations: members only.
create policy conversations_select_member on conversations
  for select
  using (is_conversation_member(id));

-- conversation_members: a member can see the membership rows of their own
-- conversation(s).
create policy conversation_members_select on conversation_members
  for select
  using (is_conversation_member(conversation_id));

-- couple_profile / memories / special_dates: conversation members only.
create policy couple_profile_all_members on couple_profile
  for all
  using (is_conversation_member(conversation_id))
  with check (is_conversation_member(conversation_id));

create policy memories_all_members on memories
  for all
  using (is_conversation_member(conversation_id))
  with check (is_conversation_member(conversation_id));

create policy special_dates_all_members on special_dates
  for all
  using (is_conversation_member(conversation_id))
  with check (is_conversation_member(conversation_id));

-- messages: members can select; insert only as themselves; update only
-- their own messages (column restrictions enforced by trigger).
create policy messages_select_members on messages
  for select
  using (is_conversation_member(conversation_id));

create policy messages_insert_own on messages
  for insert
  with check (sender_id = auth.uid() and is_conversation_member(conversation_id));

create policy messages_update_own on messages
  for update
  using (sender_id = auth.uid() and is_conversation_member(conversation_id))
  with check (sender_id = auth.uid() and is_conversation_member(conversation_id));

-- message_hidden / favorite_messages: own rows only.
create policy message_hidden_own on message_hidden
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from messages m where m.id = message_id and is_conversation_member(m.conversation_id))
  );

create policy favorite_messages_own on favorite_messages
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from messages m where m.id = message_id and is_conversation_member(m.conversation_id))
  );

-- message_reactions: read within conversation; write only own rows.
create policy message_reactions_select_members on message_reactions
  for select
  using (exists (select 1 from messages m where m.id = message_id and is_conversation_member(m.conversation_id)));

create policy message_reactions_write_own on message_reactions
  for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from messages m where m.id = message_id and is_conversation_member(m.conversation_id))
  );

create policy message_reactions_update_own on message_reactions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy message_reactions_delete_own on message_reactions
  for delete
  using (user_id = auth.uid());

-- message_reads: read within conversation; write only own rows.
create policy message_reads_select_members on message_reads
  for select
  using (exists (select 1 from messages m where m.id = message_id and is_conversation_member(m.conversation_id)));

create policy message_reads_write_own on message_reads
  for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from messages m where m.id = message_id and is_conversation_member(m.conversation_id))
  );

create policy message_reads_update_own on message_reads
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- pinned_messages: conversation members only (shared pins).
create policy pinned_messages_select_members on pinned_messages
  for select
  using (exists (select 1 from messages m where m.id = message_id and is_conversation_member(m.conversation_id)));

create policy pinned_messages_insert_members on pinned_messages
  for insert
  with check (
    pinned_by = auth.uid()
    and exists (select 1 from messages m where m.id = message_id and is_conversation_member(m.conversation_id))
  );

create policy pinned_messages_delete_members on pinned_messages
  for delete
  using (exists (select 1 from messages m where m.id = message_id and is_conversation_member(m.conversation_id)));
