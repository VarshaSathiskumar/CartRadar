import * as Crypto from 'expo-crypto';
import { extractItems } from '../core/extractor';
import { markSeen, mergeExtracted, recordHeard } from '../core/listLogic';
import type { ListItem } from '../core/types';
import { getBeeToken } from '../services/secrets';
import { mutate, readState } from '../services/store';
import { DemoBeeClient, HttpBeeClient, type BeeClient } from './client';

export class NotConnectedError extends Error {}

// Kept at module level so the demo script advances across syncs within one app session.
const demoClient = new DemoBeeClient();

async function pickClient(): Promise<BeeClient> {
  const { settings } = await readState();
  if (settings.demoMode) return demoClient;
  const token = await getBeeToken();
  if (!token) throw new NotConnectedError('Add your Bee access token in Settings');
  return new HttpBeeClient(token);
}

export interface SyncResult {
  processed: number;
  added: ListItem[];
}

/** Pulls new Bee transcripts, extracts grocery items, and merges them into the list. */
export async function syncFromBee(): Promise<SyncResult> {
  const client = await pickClient();
  const utterances = await client.fetchRecentUtterances();

  const result = await mutate<SyncResult>((state) => {
    const seen = new Set(state.seenUtteranceIds);
    const fresh = utterances.filter((u) => !seen.has(u.id));
    let next = state;
    const added: ListItem[] = [];

    for (const u of fresh) {
      const extracted = extractItems(u.text);
      if (extracted.length) {
        const merged = mergeExtracted(next, extracted, 'bee', u.at, () => Crypto.randomUUID());
        next = merged.state;
        added.push(...merged.added);
        // Only utterances that produced items are kept, so ordinary conversation is never stored.
        next = recordHeard(next, { id: u.id, text: u.text, at: u.at, found: extracted.map((e) => e.name) });
      } else {
        next = markSeen(next, [u.id]);
      }
    }
    return { state: { ...next, lastSyncAt: Date.now() }, result: { processed: fresh.length, added } };
  });
  return result ?? { processed: 0, added: [] };
}
