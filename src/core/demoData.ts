import { DEMO_CONVERSATIONS, type DemoConversation } from './demoConversations';
import type { ExtractedItem } from './extractor';
import { markSeen, mergeExtracted, queueItems, recordHeard } from './listLogic';
import type { ListItem, PersistedState, Utterance } from './types';

/** Everything demo mode creates (items, spoken lines) has an id starting with this, so turning it off can find it. */
export const DEMO_PREFIX = 'demo:';
export const isDemoId = (id: string): boolean => id.startsWith(DEMO_PREFIX);
export const hasDemoData = (state: PersistedState): boolean => [...state.items, ...state.history].some((i) => isDemoId(i.id));

const HOUR = 3_600_000;
const LINE_GAP_MS = 40_000;
/** A past day's trip happens this long after the conversation. */
const TRIP_DELAY_MS = 2 * HOUR;

export function conversationStart(c: DemoConversation, now: number): number {
  if ('minutesAgo' in c.when) return now - c.when.minutesAgo * 60_000;
  const day = new Date(now);
  day.setDate(day.getDate() - c.when.daysAgo);
  day.setHours(c.when.hour, 0, 0, 0);
  return day.getTime();
}

export interface DemoPlanEntry {
  conversation: DemoConversation;
  start: number;
  utterances: Utterance[];
}

/** The conversations with their timestamps and ids for one switch-on, oldest first. */
export function planDemo(now: number, runId: string): DemoPlanEntry[] {
  return DEMO_CONVERSATIONS.map((conversation) => {
    const start = conversationStart(conversation, now);
    const utterances = conversation.lines.map(([speaker, text], i) => ({
      id: `${DEMO_PREFIX}${runId}:${conversation.id}:${i}`,
      text,
      speaker,
      at: start + i * LINE_GAP_MS,
    }));
    return { conversation, start, utterances };
  }).sort((a, b) => a.start - b.start);
}

/**
 * Adds one conversation's extracted items to the list the way the Bee sync does, then plays out what
 * happened next (bought and filed in history, left in the cart queue, or still open) so the app shows
 * a lived-in profile. Conversations must be applied oldest first. Real items are never touched.
 */
export function applyDemoConversation(
  state: PersistedState,
  entry: DemoPlanEntry,
  extracted: Map<string, ExtractedItem[]>,
  newId: () => string,
  now: number,
): PersistedState {
  let next = state;
  const added: ListItem[] = [];
  for (const u of entry.utterances) {
    const found = extracted.get(u.id) ?? [];
    if (found.length === 0) {
      next = markSeen(next, [u.id]);
      continue;
    }
    const merged = mergeExtracted(next, found, 'bee', u.at, newId);
    next = recordHeard(merged.state, { id: u.id, text: u.text, at: u.at, found: found.map((f) => f.name) });
    added.push(...merged.added);
  }
  if (added.length === 0) return next;

  const ids = new Set(added.map((i) => i.id));
  const end = entry.utterances[entry.utterances.length - 1].at;
  const { fate } = entry.conversation;

  if (fate.kind === 'queued') return queueItems(next, [...ids], end + TRIP_DELAY_MS);

  if (fate.kind === 'history') {
    const resolvedAt = end + TRIP_DELAY_MS;
    const done = next.items.filter((i) => ids.has(i.id)).map((i) => ({ ...i, status: 'bought' as const, resolvedAt }));
    return { ...next, items: next.items.filter((i) => !ids.has(i.id)), history: [...done, ...next.history], lastTripAt: resolvedAt };
  }

  const checkedOff = new Set(added.slice(0, fate.boughtFirst ?? 0).map((i) => i.id));
  const resolvedAt = Math.min(end + 10 * 60_000, now);
  return { ...next, items: next.items.map((i) => (checkedOff.has(i.id) ? { ...i, status: 'bought' as const, resolvedAt } : i)) };
}

/**
 * Removes everything demo mode added, from the list, the cart queue, history and the heard lines.
 * Each removed item also gets a tombstone so the deletion reaches the cloud copy and other devices
 * (history removals are not tombstoned automatically). Real items are left alone.
 */
export function removeDemoData(state: PersistedState, now: number): PersistedState {
  const tombstones = { ...state.tombstones };
  for (const i of [...state.items, ...state.history]) if (isDemoId(i.id)) tombstones[i.id] = now;
  return {
    ...state,
    items: state.items.filter((i) => !isDemoId(i.id)),
    history: state.history.filter((i) => !isDemoId(i.id)),
    heard: state.heard.filter((h) => !isDemoId(h.id)),
    seenUtteranceIds: state.seenUtteranceIds.filter((id) => !isDemoId(id)),
    tombstones,
  };
}
