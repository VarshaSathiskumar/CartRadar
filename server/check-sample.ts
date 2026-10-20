import { readFileSync } from 'node:fs';

/**
 * Sends a saved Bee transcript to the extraction service and prints what it returns.
 * Run (service must be up): npm run check-sample -- data/<file>.txt
 */
const file = process.argv[2];
if (!file) throw new Error('usage: node server/check-sample.ts <transcript.txt>');

const body = readFileSync(file, 'utf8').split('TRANSCRIPT\n----------')[1] ?? '';
const utterances = body
  .split('\n')
  .map((line) => /^(.+?): (.+)$/.exec(line.trim()))
  .filter((m): m is RegExpExecArray => m !== null)
  .map((m) => ({ speaker: m[1], text: m[2] }));

const res = await fetch(`http://127.0.0.1:${process.env.EXTRACT_PORT || 8788}/extract`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ utterances }),
});
const json = (await res.json()) as { items?: { name: string; quantity: string; utterance_index: number; reason: string }[]; error?: string };
if (!res.ok) throw new Error(`${res.status}: ${json.error}`);

console.log(`${utterances.length} utterances -> ${json.items?.length ?? 0} items`);
for (const i of json.items ?? []) console.log(`- ${i.quantity ? `${i.quantity} ` : ''}${i.name}  [${i.utterance_index}] ${i.reason}`);
