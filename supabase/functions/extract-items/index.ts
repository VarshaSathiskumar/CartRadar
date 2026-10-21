import { authorize, json, preflight } from '../_shared/auth.ts';
import { extract, MAX_UTTERANCES, type InUtterance } from './extract.ts';

/**
 * POST { utterances: [{ text, speaker? }] } -> { items: [{ name, quantity, utterance_index, reason }] }
 * The OpenAI key lives in the OPENAI_API_KEY secret, never in the app.
 */

const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';

class ConfigError extends Error {}

/** Loaded on first use, so a missing key is reported to the caller instead of crashing the function at startup. */
async function loadOpenAI() {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new ConfigError('OPENAI_API_KEY is not set on the server');
  const { default: OpenAI } = await import('npm:openai@7.39.0');
  return { OpenAI, client: new OpenAI({ apiKey }) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  try {
    if (req.method !== 'POST') return json(req, 405, { error: 'method not allowed' });

    const auth = await authorize(req);
    if (auth instanceof Response) return auth;

    const body = (await req.json()) as { utterances?: InUtterance[] };
    const utterances = (body.utterances ?? []).filter((u) => typeof u?.text === 'string' && u.text.trim());
    if (utterances.length === 0) return json(req, 200, { items: [] });
    if (utterances.length > MAX_UTTERANCES) return json(req, 400, { error: `at most ${MAX_UTTERANCES} utterances` });

    const { OpenAI, client } = await loadOpenAI();
    try {
      return json(req, 200, { items: await extract(client, MODEL, utterances) });
    } catch (e) {
      if (e instanceof OpenAI.AuthenticationError) return json(req, 502, { error: 'OpenAI rejected the API key' });
      if (e instanceof OpenAI.RateLimitError) return json(req, 429, { error: 'OpenAI rate limit reached, try again shortly' });
      if (e instanceof OpenAI.APIError) return json(req, 502, { error: `OpenAI API error ${e.status}` });
      throw e;
    }
  } catch (e) {
    console.error('extract-items failed:', e instanceof Error ? e.message : e);
    return json(req, 500, { error: e instanceof Error ? e.message : 'unknown error' });
  }
});
