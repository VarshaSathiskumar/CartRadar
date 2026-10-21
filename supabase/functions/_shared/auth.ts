import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/**
 * Checks the caller before a function does any work: the request must carry a valid Supabase session
 * token (verified with Supabase Auth, not just decoded), and the account's email must be listed in the
 * ALLOWED_EMAILS secret (comma separated). With no list set, nobody is allowed.
 * Returns the user id, or a Response to send back as is.
 */
export async function authorize(req: Request): Promise<{ userId: string } | Response> {
  const token = /^Bearer (.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!token) return json(401, { error: 'Sign in to continue' });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'Your session has expired, sign in again' });

  const allowed = (Deno.env.get('ALLOWED_EMAILS') ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const email = data.user.email?.toLowerCase();
  if (!email || !data.user.email_confirmed_at || !allowed.includes(email)) {
    return json(403, { error: 'This account is not authorized' });
  }
  return { userId: data.user.id };
}
