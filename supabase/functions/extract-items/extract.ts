/**
 * Grocery extraction. The app posts recent Bee utterances to the extract-items function and gets back
 * the grocery items the speakers mean to buy. Kept free of imports so the Node check scripts in server/
 * can run the same prompt and validation against a local OpenAI client.
 */

export const MAX_UTTERANCES = 60;

export const SYSTEM = `You build a grocery shopping list from transcripts of everyday conversation.
You get numbered utterances, oldest first. Return the grocery items the speakers intend to buy.

Include an item when:
- someone says they need, want, should, or will buy or get it, or that they are out of or running low on it;
- it is clearly part of a meal or plan they are discussing that needs buying (for example, eggs that "will go well with" the ramen they plan to cook);
- they refer back to it with a pronoun ("we can buy it on the way home"): resolve the pronoun to the item, using earlier utterances.

Skip an item when:
- they say they already have it or do not need it;
- it is not something sold at a grocery store (assignments, visits, errands);
- it is only a passing mention with no sign it should be bought.

Also return an item with action "not_needed" whenever a speaker says it does not need to be bought (now or soon), even if it is not mentioned anywhere else in the transcript. Typical phrasings: "the eggs will last another week", "we're fine on milk", "no need to buy the butter", "I found more butter in the fridge", "never mind the bread". The word "buy" does not have to appear. You do not see the shopping list: report every such item, the app ignores ones that are not on it. A later utterance overrides an earlier one, so never return the same item as both "add" and "not_needed".

Rules:
- "action" is "add" for items to buy and "not_needed" for items that no longer need buying.
- "name" is the plain singular product name in lower case, without quantities or filler words.
- "quantity" is what was said ("2 dozen", "a gallon"), or an empty string.
- "utterance_index" is the index of the utterance that best shows the item should be bought.
- "reason" is a short phrase quoting or paraphrasing why it was included.
- List each item once. Return an empty list when nothing qualifies.`;

export const SCHEMA = {
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
          action: { type: 'string', enum: ['add', 'not_needed'] },
          reason: { type: 'string' },
        },
        required: ['name', 'quantity', 'utterance_index', 'action', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const;

export interface InUtterance {
  text: string;
  speaker?: string;
}

export interface OutItem {
  name: string;
  quantity: string;
  utterance_index: number;
  action: 'add' | 'not_needed';
  reason: string;
}

/** The part of the OpenAI client this needs, so tests can pass a fake. */
export interface ChatClient {
  chat: { completions: { create(params: any): Promise<any> } };
}

export async function extract(client: ChatClient, model: string, utterances: InUtterance[]): Promise<OutItem[]> {
  const transcript = utterances.map((u, i) => `[${i}] ${u.speaker ?? 'Unknown'}: ${u.text}`).join('\n');

  const response = await client.chat.completions.create({
    model,
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
  return (parsed.items ?? []).map((i) => ({ ...i, action: i.action === 'not_needed' ? ('not_needed' as const) : ('add' as const) })).filter((i) => {
    const key = `${i.action}:${i.name.trim().toLowerCase()}`;
    const valid = i.name.trim() && Number.isInteger(i.utterance_index) && i.utterance_index >= 0 && i.utterance_index < utterances.length;
    if (!valid || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
