import { authorize, corsHeaders, json } from '../_shared/auth.ts';
import { changedSince, toUtterances, type BeeConversation, type BeeConversationSummary, type Utterance } from './bee.ts';

/**
 * POST { since?: epochMs, limit?: number } -> { utterances: Utterance[], conversations: number }
 * Reads the owner's recent Bee conversations with the BEE_TOKEN secret and returns their lines, oldest first.
 * The app then sends the lines it has not read yet to extract-items.
 *
 * Bee API facts (docs.bee.computer/docs/api): Bearer auth, base https://api.developer.bee.amazon.dev,
 * GET /v1/conversations lists (newest first, with next_cursor) and GET /v1/conversations/:id has the transcript.
 * There is no documented endpoint for getting a token; see README.
 */

const BEE_URL = (Deno.env.get('BEE_API_URL') || 'https://api.developer.bee.amazon.dev').replace(/\/$/, '');
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

class BeeError extends Error {}

async function bee<T>(path: string): Promise<T> {
  const token = Deno.env.get('BEE_TOKEN');
  if (!token) throw new BeeError('BEE_TOKEN is not set on the server');
  const res = await fetch(`${BEE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401 || res.status === 403) throw new BeeError('Bee rejected the server token; it may have expired, set BEE_TOKEN again');
  if (!res.ok) throw new BeeError(`Bee request failed (${res.status})`);
  return (await res.json()) as T;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const auth = await authorize(req);
  if (auth instanceof Response) return auth;

  try {
    const body = (await req.json().catch(() => ({}))) as { since?: number; limit?: number };
    const limit = Math.min(Math.max(Math.trunc(Number(body.limit)) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const since = Number.isFinite(body.since) ? body.since : undefined;

    const list = await bee<{ conversations?: BeeConversationSummary[] }>(`/v1/conversations?limit=${limit}`);
    const wanted = changedSince(list.conversations ?? [], since);

    const details = await Promise.all(wanted.map((c) => bee<{ conversation: BeeConversation }>(`/v1/conversations/${encodeURIComponent(String(c.id))}`)));
    const utterances: Utterance[] = details.flatMap((d) => toUtterances(d.conversation)).sort((a, b) => a.at - b.at);
    return json(200, { utterances, conversations: wanted.length });
  } catch (e) {
    if (e instanceof BeeError) return json(502, { error: e.message });
    return json(500, { error: e instanceof Error ? e.message : 'unknown error' });
  }
});
