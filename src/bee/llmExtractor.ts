import { canonicalName } from '../core/lexicon';
import type { ExtractedItem } from '../core/extractor';
import type { Utterance } from '../core/types';
import { callFunction } from '../services/functions';
import { supabaseEnabled } from '../services/supabase';

/** The function accepts at most 60 lines per request, so longer backlogs are sent in batches. */
const BATCH_SIZE = 50;

interface ServerItem {
  name: string;
  quantity: string;
  utterance_index: number;
  action?: 'add' | 'not_needed';
}

/**
 * Asks the extract-items Edge Function which items the speakers mean to buy.
 * Returns items grouped by the id of the utterance that evidences them, or undefined when there is
 * nothing to ask or no cloud account, so the caller can fall back to the rule-based extractor.
 * Throws when the function itself fails, so a sync can report it instead of silently reading worse.
 */
export async function extractWithLlm(utterances: Utterance[]): Promise<Map<string, ExtractedItem[]> | undefined> {
  if (!supabaseEnabled || utterances.length === 0) return undefined;

  const byUtterance = new Map<string, ExtractedItem[]>();
  for (let i = 0; i < utterances.length; i += BATCH_SIZE) {
    const batch = utterances.slice(i, i + BATCH_SIZE);
    const { items } = await callFunction<{ items: ServerItem[] }>('extract-items', {
      utterances: batch.map((u) => ({ text: u.text, speaker: u.speaker })),
    });
    for (const item of items) {
      const source = batch[item.utterance_index];
      if (!source) continue;
      const list = byUtterance.get(source.id) ?? [];
      list.push({
        name: item.name,
        canonical: canonicalName(item.name),
        quantity: item.quantity || undefined,
        sourceText: source.text,
        ...(item.action === 'not_needed' ? { notNeeded: true } : {}),
      });
      byUtterance.set(source.id, list);
    }
  }
  return byUtterance;
}
