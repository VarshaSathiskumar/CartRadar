import { describe, expect, it } from 'vitest';
import { DEMO_CONVERSATIONS } from './demoConversations';
import { applyDemoConversation, hasDemoData, isDemoId, planDemo, removeDemoData } from './demoData';
import type { ExtractedItem } from './extractor';
import { canonicalName } from './lexicon';
import { groupHistoryByDay, makeItem } from './listLogic';
import { EMPTY_STATE, type PersistedState } from './types';

const NOW = new Date(2026, 9, 20, 14, 0, 0).getTime();

/** Stands in for the model: reports each conversation's expected items on its second line. */
function fakeModel(plan: ReturnType<typeof planDemo>[number]): Map<string, ExtractedItem[]> {
  const line = plan.utterances[1];
  const items = plan.conversation.expect.map((name) => ({ name, canonical: canonicalName(name), sourceText: line.text }));
  return new Map([[line.id, items]]);
}

function populate(base: PersistedState = EMPTY_STATE): PersistedState {
  let n = 0;
  return planDemo(NOW, 'abc').reduce((s, entry) => applyDemoConversation(s, entry, fakeModel(entry), () => `demo:abc:item${n++}`, NOW), base);
}

describe('demo conversations', () => {
  it('has enough variety to read like real life', () => {
    expect(DEMO_CONVERSATIONS.length).toBeGreaterThanOrEqual(8);
    expect(DEMO_CONVERSATIONS.flatMap((c) => c.expect).length).toBeGreaterThanOrEqual(30);
    expect(DEMO_CONVERSATIONS.filter((c) => c.avoid.length).length).toBeGreaterThanOrEqual(4);
    expect(new Set(DEMO_CONVERSATIONS.map((c) => c.id)).size).toBe(DEMO_CONVERSATIONS.length);
  });

  it('is planned oldest first, with unique ids and nothing in the future', () => {
    const plan = planDemo(NOW, 'abc');
    const starts = plan.map((p) => p.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    const ids = plan.flatMap((p) => p.utterances.map((u) => u.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(isDemoId)).toBe(true);
    expect(Math.max(...plan.flatMap((p) => p.utterances.map((u) => u.at)))).toBeLessThanOrEqual(NOW);
  });
});

describe('applyDemoConversation', () => {
  const state = populate();
  const demo = [...state.items, ...state.history];

  it('puts at least 15 items on the profile, all marked as demo', () => {
    expect(demo.length).toBeGreaterThanOrEqual(15);
    expect(demo.every((i) => isDemoId(i.id))).toBe(true);
    expect(hasDemoData(state)).toBe(true);
  });

  it('spreads them across history days, the cart queue and the open list', () => {
    expect(groupHistoryByDay(state.history).length).toBeGreaterThanOrEqual(3);
    expect(state.items.filter((i) => i.status === 'queued').length).toBeGreaterThanOrEqual(3);
    expect(state.items.filter((i) => i.status === 'open').length).toBeGreaterThanOrEqual(10);
    expect(state.items.filter((i) => i.status === 'bought')).toHaveLength(1);
    expect(state.history.every((i) => i.status === 'bought' && i.resolvedAt !== undefined)).toBe(true);
  });

  it('records the conversations it read in the heard list and never re-reads them', () => {
    expect(state.heard.length).toBeGreaterThan(0);
    expect(state.heard.every((h) => isDemoId(h.id))).toBe(true);
    expect(state.seenUtteranceIds.every(isDemoId)).toBe(true);
  });

  it('does not add an item twice when it comes up again while still queued', () => {
    expect(demo.filter((i) => i.canonical === canonicalName('lemons'))).toHaveLength(1);
  });

  it('leaves the user\'s own items untouched', () => {
    const mine = makeItem('real1', { name: 'bread', quantity: undefined, heardText: undefined }, 'manual', NOW - 1000);
    const out = populate({ ...EMPTY_STATE, items: [mine] });
    expect(out.items[0]).toEqual(mine);
  });
});

describe('removeDemoData', () => {
  it('clears list, queue, history and heard lines, keeps the user\'s items, and tombstones every removed item', () => {
    const mine = makeItem('real1', { name: 'bread', quantity: undefined, heardText: undefined }, 'manual', NOW - 1000);
    const filled = populate({ ...EMPTY_STATE, items: [mine], heard: [{ id: 'real-line', text: 'we need bread', at: NOW, found: ['bread'] }], seenUtteranceIds: ['real-line'] });
    const removedIds = [...filled.items, ...filled.history].filter((i) => isDemoId(i.id)).map((i) => i.id);

    const out = removeDemoData(filled, NOW + 5);
    expect(out.items).toEqual([mine]);
    expect(out.history).toEqual([]);
    expect(out.heard.map((h) => h.id)).toEqual(['real-line']);
    expect(out.seenUtteranceIds).toEqual(['real-line']);
    expect(Object.keys(out.tombstones).sort()).toEqual([...removedIds].sort());
    expect(hasDemoData(out)).toBe(false);
  });
});
