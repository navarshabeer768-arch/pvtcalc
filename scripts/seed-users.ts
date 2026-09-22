/**
 * Creates the two users this app is built for, their profiles, a shared
 * conversation, and default settings rows. Run once during setup:
 *
 *   npx tsx scripts/seed-users.ts \
 *     --me-email you@example.com --me-name "Your Name" --me-pronoun He \
 *     --partner-email her@example.com --partner-name "Her Name" --partner-pronoun She
 *
 * There's no password to set here: this app has no email/password login at
 * all. Each user's Supabase Auth account is created with a random,
 * never-used password (Supabase requires one to exist, but nothing ever
 * signs in with it) — the only credential either person ever types is
 * their unlock code, set next with scripts/set-unlock-code.ts. The `unlock`
 * Edge Function mints a real session from the code alone, server-side.
 */
import { adminClient } from './env';

interface Args {
  meEmail: string;
  meName: string;
  mePronoun: 'She' | 'He';
  partnerEmail: string;
  partnerName: string;
  partnerPronoun: 'She' | 'He';
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const meEmail = get('--me-email');
  const meName = get('--me-name');
  const mePronoun = get('--me-pronoun') as 'She' | 'He' | undefined;
  const partnerEmail = get('--partner-email');
  const partnerName = get('--partner-name');
  const partnerPronoun = get('--partner-pronoun') as 'She' | 'He' | undefined;

  if (!meEmail || !meName || !mePronoun || !partnerEmail || !partnerName || !partnerPronoun) {
    console.error('Missing required arguments. See the header comment in this file for usage.');
    process.exit(1);
  }

  return { meEmail, meName, mePronoun, partnerEmail, partnerName, partnerPronoun };
}

async function createUser(email: string, name: string, pronoun: 'She' | 'He') {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: crypto.randomUUID() + crypto.randomUUID(), // never used to sign in
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error(`Could not create user ${email}`);

  const { error: profileError } = await adminClient.from('profiles').insert({
    id: data.user.id,
    name,
    email,
    pronoun_label: pronoun,
  });
  if (profileError) throw profileError;

  const { error: settingsError } = await adminClient.from('user_settings').insert({ user_id: data.user.id });
  if (settingsError) throw settingsError;

  return data.user.id;
}

async function main() {
  const args = parseArgs();

  console.log('Creating users...');
  const meId = await createUser(args.meEmail, args.meName, args.mePronoun);
  const partnerId = await createUser(args.partnerEmail, args.partnerName, args.partnerPronoun);

  console.log('Creating conversation...');
  const { data: conversation, error: convError } = await adminClient
    .from('conversations')
    .insert({})
    .select('id')
    .single();
  if (convError || !conversation) throw convError ?? new Error('Could not create conversation');

  const { error: membersError } = await adminClient.from('conversation_members').insert([
    { conversation_id: conversation.id, user_id: meId },
    { conversation_id: conversation.id, user_id: partnerId },
  ]);
  if (membersError) throw membersError;

  console.log('\nDone.');
  console.log(`Conversation id: ${conversation.id}`);
  console.log(`${args.meName}: ${meId}`);
  console.log(`${args.partnerName}: ${partnerId}`);
  console.log('\nNext: set each person\'s unlock code with scripts/set-unlock-code.ts');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
