import * as Crypto from 'expo-crypto';
import { extractWithLlm } from '../bee/llmExtractor';
import { applyDemoConversation, hasDemoData, isDemoId, planDemo, removeDemoData } from '../core/demoData';
import { extractItems, type ExtractedItem } from '../core/extractor';
import { updateSettings } from '../core/listLogic';
import { mutate, readState } from './store';

export interface DemoResult {
  /** Demo items now on the profile (list, cart queue and history). */
  items: number;
  conversations: number;
  /** False when the extraction function was unreachable and the simpler built-in reader was used. */
  usedModel: boolean;
}

/**
 * Fills the profile with mock conversations read by the same extraction model as real Bee transcripts.
 * Everything goes through the normal store, so it is saved and synced like the user's own data.
 */
export async function enableDemo(): Promise<DemoResult> {
  const before = await readState();
  const plan = planDemo(Date.now(), Crypto.randomUUID().slice(0, 8));

  if (hasDemoData(before)) {
    await mutate((s) => updateSettings(s, { demoMode: true }));
    return { items: [...before.items, ...before.history].filter((i) => isDemoId(i.id)).length, conversations: plan.length, usedModel: true };
  }

  // One request per conversation, so the model never mixes up "it" across unrelated talks.
  const read = await Promise.all(plan.map((entry) => extractWithLlm(entry.utterances).catch(() => undefined)));
  const usedModel = read.every((r) => r !== undefined);

  let counter = 0;
  const runId = plan[0].utterances[0].id.split(':')[1];
  const newId = () => `demo:${runId}:item${counter++}`;

  const now = Date.now();
  const items = await mutate<number>((state) => {
    let next = updateSettings(state, { demoMode: true });
    plan.forEach((entry, i) => {
      const extracted = read[i] ?? new Map<string, ExtractedItem[]>(entry.utterances.map((u) => [u.id, extractItems(u.text)]));
      next = applyDemoConversation(next, entry, extracted, newId, now);
    });
    return { state: next, result: [...next.items, ...next.history].filter((i) => isDemoId(i.id)).length };
  });
  return { items: items ?? 0, conversations: plan.length, usedModel };
}

/** Turns demo mode off and clears everything it added; the user's own items stay. */
export async function disableDemo(): Promise<void> {
  await mutate((s) => updateSettings(removeDemoData(s, Date.now()), { demoMode: false }));
}
