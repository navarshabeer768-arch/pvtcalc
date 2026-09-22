// Supabase Edge Function: unlock
//
// Checks a code entered on the calculator against unlock_codes using the
// service role (never exposed to the client). Enforces the escalating
// lockout schedule from unlock_attempts. Always performs a bcrypt
// comparison (even for a placeholder hash) so timing doesn't leak whether
// a session/user/lockout state matched.
//
// There is no password anywhere in this app. When a device has no session
// yet and the code matches a user, this function mints a real Supabase
// session for that user server-side (via a one-time magic-link token,
// generated and immediately redeemed using the service role) and returns
// the resulting access/refresh tokens. The client just calls
// supabase.auth.setSession(...) with them. This keeps Row Level Security
// fully intact (auth.uid() is populated normally) while the human only
// ever types the 4-8 digit code — never an email or password, and no
// password ever touches Supabase Auth's public password-grant endpoint.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ATTEMPT_HASH_SALT = Deno.env.get('ATTEMPT_HASH_SALT') ?? 'dev-only-salt-change-me';

const LOCKOUT_SCHEDULE_SECONDS = [30, 60, 300, 900];
const ATTEMPTS_BEFORE_LOCKOUT = 5;
const LOOKBACK_WINDOW_MINUTES = 30;

// A hash of a code that can never match anything, used to keep the bcrypt
// comparison cost constant whether or not a real hash exists to compare
// against.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8rmljP4qcQ4hd5xUvvhyfC5A5VaFXG';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  let body: { code?: unknown; deviceId?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ status: 'no_match' }, 200);
  }

  const code = typeof body.code === 'string' ? body.code : '';
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId : 'unknown-device';

  if (!/^\d{4,8}$/.test(code)) {
    return json({ status: 'no_match' }, 200);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Determine subject for rate limiting: the authenticated user id if a
  // session is present, else a salted hash of device id + caller IP.
  const authHeader = req.headers.get('Authorization');
  let userId: string | null = null;
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data } = await supabase.auth.getUser(token);
    userId = data.user?.id ?? null;
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown-ip';
  const subject = userId ?? (await sha256Hex(`${ATTEMPT_HASH_SALT}:${deviceId}:${ip}`));

  // Check lockout schedule based on recent failed attempts for this subject.
  const since = new Date(Date.now() - LOOKBACK_WINDOW_MINUTES * 60_000).toISOString();
  const { data: recentAttempts } = await supabase
    .from('unlock_attempts')
    .select('succeeded, created_at')
    .eq('subject', subject)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50);

  const attempts = recentAttempts ?? [];
  let consecutiveFailures = 0;
  for (const a of attempts) {
    if (a.succeeded) break;
    consecutiveFailures++;
  }

  if (consecutiveFailures >= ATTEMPTS_BEFORE_LOCKOUT) {
    const lastFailure = attempts[0];
    const escalationIndex = Math.min(
      consecutiveFailures - ATTEMPTS_BEFORE_LOCKOUT,
      LOCKOUT_SCHEDULE_SECONDS.length - 1
    );
    const lockoutSeconds = LOCKOUT_SCHEDULE_SECONDS[escalationIndex];
    const lockedUntil = new Date(lastFailure.created_at).getTime() + lockoutSeconds * 1000;
    const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);

    if (remaining > 0) {
      // Still perform a dummy hash comparison for constant-time-ish behavior.
      await comparePassword(code, DUMMY_HASH, supabase);
      return json({ status: 'locked', retryAfter: remaining }, 200);
    }
  }

  let result: { status: 'unlocked'; session?: { accessToken: string; refreshToken: string } } | { status: 'no_match' };

  if (userId) {
    const { data: row } = await supabase
      .from('unlock_codes')
      .select('code_hash')
      .eq('user_id', userId)
      .maybeSingle();

    const hash = row?.code_hash ?? DUMMY_HASH;
    const matched = (await comparePassword(code, hash, supabase)) && !!row;
    result = { status: matched ? 'unlocked' : 'no_match' };
  } else {
    const { data: rows } = await supabase.from('unlock_codes').select('user_id, code_hash');
    let matchedUserId: string | null = null;
    for (const row of rows ?? []) {
      const ok = await comparePassword(code, row.code_hash, supabase);
      if (ok) matchedUserId = row.user_id;
    }
    if ((rows ?? []).length === 0) {
      await comparePassword(code, DUMMY_HASH, supabase);
    }

    if (matchedUserId) {
      const session = await mintSession(supabase, matchedUserId);
      result = session
        ? { status: 'unlocked', session }
        : { status: 'no_match' }; // fail closed if session minting breaks
    } else {
      result = { status: 'no_match' };
    }
  }

  await supabase.from('unlock_attempts').insert({
    subject,
    succeeded: result.status === 'unlocked',
  });

  return json(result, 200);
});

async function comparePassword(
  plain: string,
  hash: string,
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  const { data, error } = await supabase.rpc('crypt_compare', { plain, hash });
  if (error) {
    console.error('crypt_compare failed', error);
    return false;
  }
  return !!data;
}

/**
 * Mints a real Supabase session for `userId` using only the service role —
 * no password involved. Generates a one-time magic-link token and redeems
 * it immediately, server-side, to get access/refresh tokens for the client.
 */
async function mintSession(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !userData.user?.email) {
    console.error('mintSession: could not load user', userError);
    return null;
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: userData.user.email,
  });
  if (linkError || !linkData.properties?.hashed_token) {
    console.error('mintSession: generateLink failed', linkError);
    return null;
  }

  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyError || !verifyData.session) {
    console.error('mintSession: verifyOtp failed', verifyError);
    return null;
  }

  return {
    accessToken: verifyData.session.access_token,
    refreshToken: verifyData.session.refresh_token,
  };
}
