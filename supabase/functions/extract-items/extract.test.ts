import { describe, expect, it } from 'vitest';
import { extract, type ChatClient } from './extract.ts';

const fake = (message: { content?: string | null; refusal?: string | null }): ChatClient & { calls: any[] } => {
  const calls: any[] = [];
  return {
    calls,
    chat: {
      completions: {
        create: async (params) => {
          calls.push(params);
          return { choices: [{ message }] };
        },
      },
    },
  };
};
const reply = (items: unknown[]) => ({ content: JSON.stringify({ items }) });
const item = (name: string, utterance_index: number) => ({ name, quantity: '', utterance_index, reason: 'said so' });

describe('extract', () => {
  it('numbers the lines with their speakers and uses the strict schema', async () => {
    const client = fake(reply([]));
    await extract(client, 'm', [{ speaker: 'Ann', text: 'we need eggs' }, { text: 'ok' }]);
    expect(client.calls[0].messages[1].content).toBe('[0] Ann: we need eggs\n[1] Unknown: ok');
    expect(client.calls[0].response_format.json_schema.strict).toBe(true);
  });

  it('drops items pointing at a missing line, blank names, and repeats', async () => {
    const client = fake(reply([item('eggs', 0), item(' Eggs ', 1), item('milk', 5), item('', 0), item('bread', -1), item('rice', 1)]));
    const out = await extract(client, 'm', [{ text: 'a' }, { text: 'b' }]);
    expect(out.map((i) => i.name)).toEqual(['eggs', 'rice']);
  });

  it('throws on a refusal or an empty reply', async () => {
    await expect(extract(fake({ refusal: 'no' }), 'm', [{ text: 'a' }])).rejects.toThrow('refused');
    await expect(extract(fake({ content: null }), 'm', [{ text: 'a' }])).rejects.toThrow('no content');
  });
});
