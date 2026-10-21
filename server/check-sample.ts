import { readFileSync } from 'node:fs';
import OpenAI from 'openai';
import { extract } from '../supabase/functions/extract-items/extract.ts';

/**
 * Runs a saved Bee transcript through the same extraction code the extract-items function uses and prints the result.
 * Run: npm run check-sample -- data/<file>.txt (reads OPENAI_API_KEY and OPENAI_MODEL from .env.local)
 */
const file = process.argv[2];
if (!file) throw new Error('usage: node server/check-sample.ts <transcript.txt>');

const body = readFileSync(file, 'utf8').split('TRANSCRIPT\n----------')[1] ?? '';
const utterances = body
  .split('\n')
  .map((line) => /^(.+?): (.+)$/.exec(line.trim()))
  .filter((m): m is RegExpExecArray => m !== null)
  .map((m) => ({ speaker: m[1], text: m[2] }));

const items = await extract(new OpenAI(), process.env.OPENAI_MODEL || 'gpt-4o-mini', utterances);

console.log(`${utterances.length} utterances -> ${items.length} items`);
for (const i of items) console.log(`- ${i.quantity ? `${i.quantity} ` : ''}${i.name}  [${i.utterance_index}] ${i.reason}`);
