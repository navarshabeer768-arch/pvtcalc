// Supabase Edge Function: set-unlock-code
//
// Requires a valid session AND the user's current unlock code. Used by
// Settings -> Privacy -> "Change unlock code". Initial setup instead uses
// the local scripts/set-unlock-code.ts admin script.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ status: 'error', message: 'Sign-in required.' }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ status: 'error', message: 'Sign-in required.' }, 401);

  const userId = userData.user.id;

  let body: { currentCode?: unknown; newCode?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ status: 'error', message: 'Malformed request.' }, 400);
  }

  const currentCode = typeof body.currentCode === 'string' ? body.currentCode : '';
  const newCode = typeof body.newCode === 'string' ? body.newCode : '';

  if (!/^\d{4,8}$/.test(newCode)) {
    return json({ status: 'error', message: 'The new code must be 4-8 digits.' }, 400);
  }

  const { data: row } = await supabase.from('unlock_codes').select('code_hash').eq('user_id', userId).maybeSingle();
  if (!row) return json({ status: 'error', message: 'No unlock code is set for this account yet.' }, 400);

  const { data: matched } = await supabase.rpc('crypt_compare', { plain: currentCode, hash: row.code_hash });
  if (!matched) return json({ status: 'error', message: 'Current code is incorrect.' }, 400);

  const { data: newHash, error: hashError } = await supabase.rpc('hash_code', { plain: newCode });
  if (hashError || !newHash) return json({ status: 'error', message: 'Could not update the code.' }, 500);

  const { error: updateError } = await supabase
    .from('unlock_codes')
    .update({ code_hash: newHash, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (updateError) return json({ status: 'error', message: 'Could not update the code.' }, 500);

  return json({ status: 'ok' }, 200);
});
