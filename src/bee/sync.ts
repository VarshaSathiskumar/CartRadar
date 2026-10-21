import * as Crypto from 'expo-crypto';
import { extractItems } from '../core/extractor';
import { markSeen, mergeExtracted, recordHeard } from '../core/listLogic';
import type { ListItem } from '../core/types';
import { mutate, readState } from '../services/store';
import { supabaseEnabled } from '../services/supabase';
import { FunctionBeeClient } from './client';
import { extractWithLlm } from './llmExtractor';
import { setSyncStatus } from './syncStatus';

export class NotConnectedError extends Error {}

/** Conversations untouched since shortly before the last successful sync were already read; the margin covers clock drift. */
const SINCE_MARGIN_MS = 10 * 60_000;

export interface SyncResult {
  processed: number;
  added: ListItem[];
}

let running: Promise<SyncResult> | undefined;

/**
 * Pulls new Bee transcripts, extracts grocery items, and merges them into the list.
 * One sync at a time: a second request while one is running shares its result, so the same
 * lines are never sent to the model twice. `full` forgets which lines were read and re-reads recent conversations.
 */
export async function syncFromBee(opts: { full?: boolean } = {}): Promise<SyncResult> {
  if (running) {
    if (!opts.full) return running;
    await running.catch(() => undefined);
  }
  running = run(!!opts.full).finally(() => {
    running = undefined;
  });
  return running;
}

async function run(full: boolean): Promise<SyncResult> {
  // Demo mode owns the profile (see services/demo.ts); real conversations would mix into the mock data.
  if ((await readState()).settings.demoMode) return { processed: 0, added: [] };

  setSyncStatus({ phase: 'syncing' });
  try {
    const result = await pull(full);
    const message = result.added.length
      ? `Added ${result.added.map((i) => i.name).join(', ')}.`
      : result.processed
        ? `Read ${result.processed} new lines, nothing to add.`
        : 'No new conversations.';
    setSyncStatus({ phase: 'done', at: Date.now(), message });
    return result;
  } catch (e) {
    setSyncStatus({ phase: 'error', at: Date.now(), message: e instanceof Error ? e.message : 'Sync failed' });
    throw e;
  }
}

async function pull(full: boolean): Promise<SyncResult> {
  if (!supabaseEnabled) throw new NotConnectedError('Sign in to sync Bee conversations');
  if (full) await mutate((s) => ({ ...s, seenUtteranceIds: [] }));

  const { lastSyncAt } = await readState();
  const since = full || !lastSyncAt ? undefined : lastSyncAt - SINCE_MARGIN_MS;
  const utterances = await new FunctionBeeClient().fetchRecentUtterances(since);

  // The LLM sees all new lines together so it can resolve "buy it" to an earlier item. Undefined means fall back to rules.
  const alreadySeen = new Set((await readState()).seenUtteranceIds);
  const llmItems = await extractWithLlm(utterances.filter((u) => !alreadySeen.has(u.id)));

  const result = await mutate<SyncResult>((state) => {
    const seen = new Set(state.seenUtteranceIds);
    const fresh = utterances.filter((u) => !seen.has(u.id));
    let next = state;
    const added: ListItem[] = [];

    for (const u of fresh) {
      const extracted = llmItems ? (llmItems.get(u.id) ?? []) : extractItems(u.text);
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
