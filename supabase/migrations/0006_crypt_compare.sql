-- RPC used only by the `unlock` and `set-unlock-code` Edge Functions
-- (called with the service-role key) to bcrypt-compare a plaintext code
-- against a stored hash without ever returning the hash itself.

create or replace function crypt_compare(plain text, hash text)
returns boolean
language sql
security definer
set search_path = public, extensions
stable
as $$
  select crypt(plain, hash) = hash;
$$;

revoke execute on function crypt_compare(text, text) from public, anon, authenticated;
grant execute on function crypt_compare(text, text) to service_role;

create or replace function hash_code(plain text)
returns text
language sql
security definer
set search_path = public, extensions
stable
as $$
  select crypt(plain, gen_salt('bf', 10));
$$;

revoke execute on function hash_code(text) from public, anon, authenticated;
grant execute on function hash_code(text) to service_role;
