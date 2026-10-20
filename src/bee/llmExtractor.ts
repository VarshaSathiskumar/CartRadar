import { canonicalName } from '../core/lexicon';
import type { ExtractedItem } from '../core/extractor';
import type { Utterance } from '../core/types';

const TIMEOUT_MS = 20_000;

interface ServerItem {
  name: string;
  quantity: string;
  utterance_index: number;
}

/**
 * Asks the local extraction service (server/extract.ts) which items the speakers mean to buy.
 * Returns items grouped by the id of the utterance that evidences them, or undefined when the
 * service is not configured or fails, so the caller can fall back to the rule-based extractor.
 */
export async function extractWithLlm(utterances: Utterance[]): Promise<Map<string, ExtractedItem[]> | undefined> {
  const url = process.env.EXPO_PUBLIC_EXTRACT_URL;
  if (!url || utterances.length === 0) return undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utterances: utterances.map((u) => ({ text: u.text, speaker: u.speaker })) }),
      signal: controller.signal,
    });
    if (!res.ok) return undefined;

    const { items } = (await res.json()) as { items: ServerItem[] };
    const byUtterance = new Map<string, ExtractedItem[]>();
    for (const item of items) {
      const source = utterances[item.utterance_index];
      if (!source) continue;
      const list = byUtterance.get(source.id) ?? [];
      list.push({
        name: item.name,
        canonical: canonicalName(item.name),
        quantity: item.quantity || undefined,
        sourceText: source.text,
      });
      byUtterance.set(source.id, list);
    }
    return byUtterance;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
