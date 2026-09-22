/**
 * RLS integration tests. These run against a REAL Supabase project (there's
 * no local RLS emulator), so they're skipped unless env vars point at one.
 *
 * This app has no email/password login (see the `unlock` Edge Function),
 * so sessions for the test users are minted directly with the service role
 * — the same magic-link-token approach `unlock` uses — rather than signing
 * in with a password.
 *
 * Setup: seed two conversation members (via scripts/seed-users.ts) and one
 * outsider account not in any conversation, then run:
 *
 *   TEST_SUPABASE_URL=... TEST_SUPABASE_ANON_KEY=... \
 *   TEST_SUPABASE_SERVICE_ROLE_KEY=... \
 *   TEST_MEMBER_A_EMAIL=... TEST_MEMBER_B_EMAIL=... TEST_OUTSIDER_EMAIL=... \
 *   npx vitest run supabase/tests/rls.test.ts
 */
import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.TEST_SUPABASE_URL;
const anonKey = process.env.TEST_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const hasEnv =
  !!url &&
  !!anonKey &&
  !!serviceRoleKey &&
  !!process.env.TEST_MEMBER_A_EMAIL &&
  !!process.env.TEST_MEMBER_B_EMAIL &&
  !!process.env.TEST_OUTSIDER_EMAIL;

const d = hasEnv ? describe : describe.skip;

async function signInAs(email: string): Promise<ReturnType<typeof createClient>> {
  const admin = createClient(url!, serviceRoleKey!, { auth: { persistSession: false } });
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkError || !linkData.properties?.hashed_token) {
    throw linkError ?? new Error(`Could not generate a session for ${email}`);
  }

  const client = createClient(url!, anonKey!);
  const { error: verifyError } = await client.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyError) throw verifyError;

  return client;
}

d('Row Level Security', () => {
  let clientA: ReturnType<typeof createClient>;
  let clientB: ReturnType<typeof createClient>;
  let outsider: ReturnType<typeof createClient>;
  let conversationId: string;
  let userAId: string;
  let messageId: string;

  beforeAll(async () => {
    clientA = await signInAs(process.env.TEST_MEMBER_A_EMAIL!);
    clientB = await signInAs(process.env.TEST_MEMBER_B_EMAIL!);
    outsider = await signInAs(process.env.TEST_OUTSIDER_EMAIL!);

    const { data: a } = await clientA.auth.getUser();
    userAId = a.user!.id;
    const { data: membership } = await clientA
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', userAId)
      .limit(1)
      .single();
    conversationId = membership!.conversation_id as string;

    messageId = crypto.randomUUID();
    await clientA.from('messages').insert({
      id: messageId,
      conversation_id: conversationId,
      sender_id: userAId,
      message_type: 'text',
      content: 'RLS test message',
    });
  });

  it('outsider cannot read messages in a conversation they are not a member of', async () => {
    const { data } = await outsider.from('messages').select('*').eq('id', messageId);
    expect(data ?? []).toHaveLength(0);
  });

  it('outsider cannot insert a message into a conversation they are not a member of', async () => {
    const { error } = await outsider.from('messages').insert({
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      sender_id: (await outsider.auth.getUser()).data.user!.id,
      message_type: 'text',
      content: 'should fail',
    });
    expect(error).not.toBeNull();
  });

  it('member B cannot edit member A\'s message', async () => {
    const { error, data } = await clientB.from('messages').update({ content: 'hacked' }).eq('id', messageId).select();
    // Either an error, or (more likely, since RLS silently filters rows)
    // zero rows affected.
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it('member B cannot edit member A\'s profile', async () => {
    const { data, error } = await clientB.from('profiles').update({ name: 'Hacked' }).eq('id', userAId).select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it('outsider cannot read either member\'s profile', async () => {
    const { data } = await outsider.from('profiles').select('*').eq('id', userAId);
    expect(data ?? []).toHaveLength(0);
  });

  it('unlock_codes is inaccessible to any authenticated client', async () => {
    const { data: dataA, error: errorA } = await clientA.from('unlock_codes').select('*');
    expect(errorA !== null || (dataA ?? []).length === 0).toBe(true);

    const { data: dataOutsider, error: errorOutsider } = await outsider.from('unlock_codes').select('*');
    expect(errorOutsider !== null || (dataOutsider ?? []).length === 0).toBe(true);
  });

  it('unlock_attempts is inaccessible to any authenticated client', async () => {
    const { data, error } = await clientA.from('unlock_attempts').select('*');
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it('outsider cannot write to chat-media storage under the conversation prefix', async () => {
    const path = `${conversationId}/${userAId}/outsider-attempt.webp`;
    const { error } = await outsider.storage
      .from('chat-media')
      .upload(path, new Blob(['x'], { type: 'image/webp' }));
    expect(error).not.toBeNull();
  });
});
