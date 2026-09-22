/**
 * Sets (or replaces) a user's unlock code. Uses the service role directly,
 * bypassing the Edge Function's "must know the current code" requirement,
 * which makes this the right tool for initial setup or account recovery.
 *
 *   npx tsx scripts/set-unlock-code.ts --email you@example.com --code 4821
 */
import { adminClient } from './env';

function parseArgs(): { email: string; code: string } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const email = get('--email');
  const code = get('--code');

  if (!email || !code) {
    console.error('Usage: npx tsx scripts/set-unlock-code.ts --email you@example.com --code 4821');
    process.exit(1);
  }
  if (!/^\d{4,8}$/.test(code)) {
    console.error('The code must be 4-8 digits.');
    process.exit(1);
  }
  return { email, code };
}

async function main() {
  const { email, code } = parseArgs();

  const { data: users, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) throw listError;
  const user = users.users.find((u) => u.email === email);
  if (!user) {
    console.error(`No user found with email ${email}. Run scripts/seed-users.ts first.`);
    process.exit(1);
  }

  const { data: hash, error: hashError } = await adminClient.rpc('hash_code', { plain: code });
  if (hashError || !hash) throw hashError ?? new Error('Could not hash code');

  const { error: upsertError } = await adminClient
    .from('unlock_codes')
    .upsert({ user_id: user.id, code_hash: hash, updated_at: new Date().toISOString() });
  if (upsertError) throw upsertError;

  console.log(`Unlock code set for ${email}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
