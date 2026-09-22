-- Private storage buckets and policies.
-- Path convention: {conversation_id}/{user_id}/{uuid}.{ext}
-- storage.objects.name is the full path; split_part(name, '/', 1) is the
-- conversation id, split_part(name, '/', 2) is the owning user id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('chat-media', 'chat-media', false, 10485760, array[
    'image/jpeg', 'image/png', 'image/webp',
    'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'
  ]),
  ('avatars', 'avatars', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('memories', 'memories', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('backgrounds', 'backgrounds', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function storage_path_conversation_id(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid;
$$;

create or replace function storage_path_owner_id(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 2), '')::uuid;
$$;

-- Read: any conversation member can read files under their conversation's
-- prefix, across all four buckets.
create policy storage_read_conversation_members on storage.objects
  for select
  using (
    bucket_id in ('chat-media', 'avatars', 'memories', 'backgrounds')
    and is_conversation_member(storage_path_conversation_id(name))
  );

-- Write (insert/update/delete): only the owner (second path segment),
-- and only within a conversation they belong to.
create policy storage_write_own on storage.objects
  for insert
  with check (
    bucket_id in ('chat-media', 'avatars', 'memories', 'backgrounds')
    and storage_path_owner_id(name) = auth.uid()
    and is_conversation_member(storage_path_conversation_id(name))
  );

create policy storage_update_own on storage.objects
  for update
  using (
    bucket_id in ('chat-media', 'avatars', 'memories', 'backgrounds')
    and storage_path_owner_id(name) = auth.uid()
  )
  with check (
    bucket_id in ('chat-media', 'avatars', 'memories', 'backgrounds')
    and storage_path_owner_id(name) = auth.uid()
  );

create policy storage_delete_own on storage.objects
  for delete
  using (
    bucket_id in ('chat-media', 'avatars', 'memories', 'backgrounds')
    and storage_path_owner_id(name) = auth.uid()
  );
