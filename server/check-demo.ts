import OpenAI from 'openai';
import { DEMO_CONVERSATIONS } from '../src/core/demoConversations.ts';
import { extract } from '../supabase/functions/extract-items/extract.ts';

/**
 * Runs each demo conversation through the same extraction code the extract-items function uses and checks
 * the model finds the expected items and skips the ones that were ruled out.
 * Run: npm run check-demo (reads OPENAI_API_KEY and OPENAI_MODEL from .env.local)
 */
const client = new OpenAI();
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

let found = 0;
let missed = 0;
let wrong = 0;

const results = await Promise.all(
  DEMO_CONVERSATIONS.map(async (c) => ({ c, items: await extract(client, model, c.lines.map(([speaker, text]) => ({ speaker, text }))) })),
);

for (const { c, items } of results) {
  const names = items.filter((i) => i.action === 'add').map((i) => i.name.toLowerCase());
  const dropped = items.filter((i) => i.action === 'not_needed').map((i) => i.name.toLowerCase());
  const wantedDrops = c.notNeeded ?? [];
  const missing = [
    ...c.expect.filter((e) => !names.some((n) => n.includes(e))),
    ...wantedDrops.filter((e) => !dropped.some((n) => n.includes(e))).map((e) => `${e} (not needed)`),
  ];
  const unwanted = c.avoid.filter((a) => names.some((n) => n.includes(a)));
  found += c.expect.length + wantedDrops.length - missing.length;
  missed += missing.length;
  wrong += unwanted.length;
  console.log(`${c.id}: ${items.map((i) => (i.action === 'not_needed' ? `${i.name} (not needed)` : i.quantity ? `${i.quantity} ${i.name}` : i.name)).join(', ')}`);
  if (missing.length) console.log(`  MISSING: ${missing.join(', ')}`);
  if (unwanted.length) console.log(`  SHOULD NOT BE THERE: ${unwanted.join(', ')}`);
}

console.log(`\nfound ${found} of ${found + missed} expected items, ${wrong} unwanted`);
process.exitCode = missed || wrong ? 1 : 0;
