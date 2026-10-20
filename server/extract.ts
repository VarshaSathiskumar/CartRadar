import { createServer } from 'node:http';
import OpenAI from 'openai';

/**
 * Local extraction service. The app posts recent Bee utterances here and gets back the
 * grocery items the speakers mean to buy. The OpenAI key stays in this process
 * (read from OPENAI_API_KEY), never in the app bundle.
 *
 * Run: npm run extract (reads OPENAI_API_KEY from .env.local)
 */

const PORT = Number(process.env.EXTRACT_PORT || 8788);
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_UTTERANCES = 60;
const MAX_BODY_BYTES = 64_000;

const SYSTEM = `You build a grocery shopping list from transcripts of everyday conversation.
You get numbered utterances, oldest first. Return the grocery items the speakers intend to buy.

Include an item when:
- someone says they need, want, should, or will buy or get it, or that they are out of or running low on it;
- it is clearly part of a meal or plan they are discussing that needs buying (for example, eggs that "will go well with" the ramen they plan to cook);
- they refer back to it with a pronoun ("we can buy it on the way home"): resolve the pronoun to the item, using earlier utterances.

Skip an item when:
- they say they already have it or do not need it;
- it is not something sold at a grocery store (assignments, visits, errands);
- it is only a passing mention with no sign it should be bought.

Rules:
- "name" is the plain singular product name in lower case, without quantities or filler words.
- "quantity" is what was said ("2 dozen", "a gallon"), or an empty string.
- "utterance_index" is the index of the utterance that best shows the item should be bought.
- "reason" is a short phrase quoting or paraphrasing why it was included.
- List each item once. Return an empty list when nothing qualifies.`;

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'string' },
          utterance_index: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: ['name', 'quantity', 'utterance_index', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const;

interface InUtterance {
  text: string;
  speaker?: string;
}

interface OutItem {
  name: string;
  quantity: string;
  utterance_index: number;
  reason: string;
}

const client = new OpenAI();

async function extract(utterances: InUtterance[]): Promise<OutItem[]> {
  const transcript = utterances.map((u, i) => `[${i}] ${u.speaker ?? 'Unknown'}: ${u.text}`).join('\n');

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: transcript },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'grocery_items', strict: true, schema: SCHEMA } },
  });

  const message = response.choices[0]?.message;
  if (message?.refusal) throw new Error('model refused the request');
  if (!message?.content) throw new Error('no content in model response');

  const parsed = JSON.parse(message.content) as { items?: OutItem[] };
  const seen = new Set<string>();
  return (parsed.items ?? []).filter((i) => {
    const key = i.name.trim().toLowerCase();
    const valid = key && Number.isInteger(i.utterance_index) && i.utterance_index >= 0 && i.utterance_index < utterances.length;
    if (!valid || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) reject(new Error('body too large'));
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

createServer(async (req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(body));
  };

  if (req.method === 'OPTIONS') return send(204, {});
  if (req.method !== 'POST' || req.url !== '/extract') return send(404, { error: 'not found' });

  try {
    const body = JSON.parse(await readBody(req)) as { utterances?: InUtterance[] };
    const utterances = (body.utterances ?? []).filter((u) => typeof u.text === 'string' && u.text.trim());
    if (utterances.length === 0) return send(200, { items: [] });
    if (utterances.length > MAX_UTTERANCES) return send(400, { error: `at most ${MAX_UTTERANCES} utterances` });
    return send(200, { items: await extract(utterances) });
  } catch (e) {
    if (e instanceof OpenAI.AuthenticationError) return send(401, { error: 'OpenAI rejected the API key' });
    if (e instanceof OpenAI.RateLimitError) return send(429, { error: 'rate limited' });
    if (e instanceof OpenAI.APIError) return send(502, { error: `OpenAI API error ${e.status}` });
    return send(500, { error: e instanceof Error ? e.message : 'unknown error' });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Extraction service on http://127.0.0.1:${PORT}`));
