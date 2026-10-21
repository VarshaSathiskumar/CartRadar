import OpenAI from 'npm:openai@7.39.0';
import { authorize, corsHeaders, json } from '../_shared/auth.ts';
import { extract, MAX_UTTERANCES, type InUtterance } from './extract.ts';

/**
 * POST { utterances: [{ text, speaker? }] } -> { items: [{ name, quantity, utterance_index, reason }] }
 * The OpenAI key lives in the OPENAI_API_KEY secret, never in the app.
 */

const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
const client = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const auth = await authorize(req);
  if (auth instanceof Response) return auth;

  try {
    const body = (await req.json()) as { utterances?: InUtterance[] };
    const utterances = (body.utterances ?? []).filter((u) => typeof u?.text === 'string' && u.text.trim());
    if (utterances.length === 0) return json(200, { items: [] });
    if (utterances.length > MAX_UTTERANCES) return json(400, { error: `at most ${MAX_UTTERANCES} utterances` });
    return json(200, { items: await extract(client, MODEL, utterances) });
  } catch (e) {
    if (e instanceof OpenAI.AuthenticationError) return json(502, { error: 'OpenAI rejected the API key' });
    if (e instanceof OpenAI.RateLimitError) return json(429, { error: 'OpenAI rate limit reached, try again shortly' });
    if (e instanceof OpenAI.APIError) return json(502, { error: `OpenAI API error ${e.status}` });
    return json(500, { error: e instanceof Error ? e.message : 'unknown error' });
  }
});
