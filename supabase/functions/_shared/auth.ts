import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

/** Every header the Supabase SDK can send (the list in @supabase/supabase-js/cors), so a preflight never rejects one. */
const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage';

/**
 * CORS headers for this request. Any origin is allowed unless the ALLOWED_ORIGINS secret (comma separated, for
 * example https://cartradar-five.vercel.app) is set, in which case only those origins are echoed back.
 * The Bearer token, not the origin, is what protects the functions.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const listed = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
  const origin = req.headers.get('Origin') ?? '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
  if (listed.length === 0) headers['Access-Control-Allow-Origin'] = '*';
  else {
    headers['Vary'] = 'Origin';
    if (listed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

/** Every response goes through here, errors included, so the browser can always read it. */
export const json = (req: Request, status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } });

export const preflight = (req: Request): Response => new Response(null, { status: 204, headers: corsHeaders(req) });

/**
 * Checks the caller before a function does any work: the request must carry a valid Supabase session
 * token (verified with Supabase Auth, not just decoded), and the account's email must be listed in the
 * ALLOWED_EMAILS secret (comma separated). With no list set, nobody is allowed.
 * Returns the user id, or a Response to send back as is.
 */
export async function authorize(req: Request): Promise<{ userId: string } | Response> {
  const token = /^Bearer (.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!token) return json(req, 401, { error: 'Sign in to continue' });

  // The app's own key comes with the request; the project's key is the fallback for other callers.
  const apiKey = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, apiKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    console.error('auth check failed:', error?.message ?? 'no user');
    return json(req, 401, { error: 'Your session has expired, sign in again' });
  }

  const allowed = (Deno.env.get('ALLOWED_EMAILS') ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const email = data.user.email?.toLowerCase();
  if (!email || !data.user.email_confirmed_at || !allowed.includes(email)) {
    return json(req, 403, { error: 'This account is not authorized' });
  }
  return { userId: data.user.id };
}
