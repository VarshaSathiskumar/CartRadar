import { DEMO_CONVERSATIONS } from '../src/core/demoConversations.ts';

/**
 * Sends each demo conversation to the extraction service and checks the model finds the expected
 * items and skips the ones that were ruled out.
 * Run (service must be up): npm run check-demo
 */
const url = `http://127.0.0.1:${process.env.EXTRACT_PORT || 8788}/extract`;

let found = 0;
let missed = 0;
let wrong = 0;

const results = await Promise.all(
  DEMO_CONVERSATIONS.map(async (c) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utterances: c.lines.map(([speaker, text]) => ({ speaker, text })) }),
    });
    const json = (await res.json()) as { items?: { name: string; quantity: string }[]; error?: string };
    if (!res.ok) throw new Error(`${c.id}: ${res.status} ${json.error}`);
    return { c, items: json.items ?? [] };
  }),
);

for (const { c, items } of results) {
  const names = items.map((i) => i.name.toLowerCase());
  const missing = c.expect.filter((e) => !names.some((n) => n.includes(e)));
  const unwanted = c.avoid.filter((a) => names.some((n) => n.includes(a)));
  found += c.expect.length - missing.length;
  missed += missing.length;
  wrong += unwanted.length;
  console.log(`${c.id}: ${items.map((i) => (i.quantity ? `${i.quantity} ${i.name}` : i.name)).join(', ')}`);
  if (missing.length) console.log(`  MISSING: ${missing.join(', ')}`);
  if (unwanted.length) console.log(`  SHOULD NOT BE THERE: ${unwanted.join(', ')}`);
}

console.log(`\nfound ${found} of ${found + missed} expected items, ${wrong} unwanted`);
process.exitCode = missed || wrong ? 1 : 0;
