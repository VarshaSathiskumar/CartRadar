import { describe, expect, it } from 'vitest';
import { extractItems } from './extractor';
import {
  MIN_DWELL_MS,
  NOTIFY_COOLDOWN_MS,
  REBUY_SUPPRESS_MS,
  clearQueued,
  dismissNotNeeded,
  finishTrip,
  groupHistoryByDay,
  handleEnter,
  handleExit,
  leftoverPromptText,
  orderQueuedItem,
  queueItems,
  mergeExtracted,
  openItems,
  recordHeard,
  reminderText,
  toggleBought,
} from './listLogic';
import { EMPTY_STATE, type PersistedState, type Store } from './types';

const NOW = 1_800_000_000_000;
const store: Store = { id: 's1', name: 'Kroger', latitude: 1, longitude: 2, enabled: true };
let n = 0;
const newId = () => `id${++n}`;

const withStore = (patch: Partial<PersistedState> = {}): PersistedState => ({ ...EMPTY_STATE, stores: [store], ...patch });
const add = (state: PersistedState, text: string, now = NOW) => mergeExtracted(state, extractItems(text), 'bee', now, newId).state;

describe('mergeExtracted', () => {
  it('adds new items and skips duplicates, including plural/singular', () => {
    let s = add(EMPTY_STATE, 'we need eggs and milk');
    s = add(s, 'we are out of egg');
    expect(s.items.map((i) => i.name)).toEqual(['eggs', 'milk']);
  });

  it('does not re-add something checked off recently, but does after the window', () => {
    let s = add(EMPTY_STATE, 'we need eggs');
    s = toggleBought(s, s.items[0].id, NOW);
    expect(add(s, 'we need eggs', NOW + 1000).items).toHaveLength(1);
    s = finishTrip(s, NOW + 2000).state;
    expect(add(s, 'we are out of eggs', NOW + 3000).items).toHaveLength(0);
    expect(add(s, 'we are out of eggs', NOW + REBUY_SUPPRESS_MS + 5000).items.map((i) => i.name)).toEqual(['eggs']);
  });
});

describe('finishTrip', () => {
  const base = () => {
    let s = add(EMPTY_STATE, 'we need eggs, milk and bread');
    s = toggleBought(s, s.items[0].id, NOW);
    return s;
  };

  it('carries leftovers to the next list when the toggle is off', () => {
    const out = finishTrip(base(), NOW + 1);
    expect(out.boughtCount).toBe(1);
    expect(out.state.items.map((i) => [i.name, i.status, i.carriedOver])).toEqual([
      ['milk', 'open', 1],
      ['bread', 'open', 1],
    ]);
    expect(out.state.history.map((i) => i.name)).toEqual(['eggs']);
    expect(out.queued).toHaveLength(0);
  });

  it('queues leftovers for the cart when the toggle is on', () => {
    const s = base();
    const out = finishTrip({ ...s, settings: { ...s.settings, leftoversToCart: true } }, NOW + 1);
    expect(out.queued.map((i) => i.name)).toEqual(['milk', 'bread']);
    expect(openItems(out.state.items)).toHaveLength(0);
    expect(out.state.items.every((i) => i.status === 'queued')).toBe(true);
  });

  it('never loses items, in either mode', () => {
    for (const leftoversToCart of [false, true]) {
      const s = base();
      const out = finishTrip({ ...s, settings: { ...s.settings, leftoversToCart } }, NOW + 1);
      expect(out.state.items.length + out.state.history.length).toBe(3);
    }
  });

  it('keeps earlier queued items queued across trips and lets the user clear them', () => {
    const s0 = base();
    const t1 = finishTrip({ ...s0, settings: { ...s0.settings, leftoversToCart: true } }, NOW + 1).state;
    const nextList = add({ ...t1, settings: { ...t1.settings, leftoversToCart: false } }, 'we need rice', NOW + 2);
    const t2 = finishTrip(nextList, NOW + 3).state;
    expect(t2.items.map((i) => [i.name, i.status])).toEqual([
      ['rice', 'open'],
      ['milk', 'queued'],
      ['bread', 'queued'],
    ]);
    expect(t2.items[0].carriedOver).toBe(1);
    const cleared = clearQueued(t2, NOW + 4);
    expect(cleared.items.map((i) => i.name)).toEqual(['rice']);
  });
});

const listed = () => add(withStore(), 'we need eggs and milk');

describe('geofence handlers', () => {
  it('reminds on enter, then respects the cooldown', () => {
    const first = handleEnter(listed(), 's1', NOW);
    expect(first.reminder?.items.map((i) => i.name)).toEqual(['eggs', 'milk']);
    const again = handleEnter(first.state, 's1', NOW + NOTIFY_COOLDOWN_MS - 1);
    expect(again.reminder).toBeUndefined();
    const later = handleEnter(again.state, 's1', NOW + NOTIFY_COOLDOWN_MS + 1);
    expect(later.reminder).toBeDefined();
  });

  it('stays quiet when reminders are off, the list is empty, or the store is disabled', () => {
    const s = listed();
    expect(handleEnter({ ...s, settings: { ...s.settings, remindersEnabled: false } }, 's1', NOW).reminder).toBeUndefined();
    expect(handleEnter(withStore(), 's1', NOW).reminder).toBeUndefined();
    expect(handleEnter({ ...s, stores: [{ ...store, enabled: false }] }, 's1', NOW).reminder).toBeUndefined();
  });

  it('ends the trip on exit after enough dwell time', () => {
    const entered = handleEnter(listed(), 's1', NOW).state;
    const out = handleExit(entered, 's1', NOW + MIN_DWELL_MS + 1);
    expect(out.trip?.carried.map((i) => i.name)).toEqual(['eggs', 'milk']);
    expect(out.state.visits).toEqual({});
  });

  it('ignores drive-bys and exits with no matching enter', () => {
    const entered = handleEnter(listed(), 's1', NOW).state;
    const driveBy = handleExit(entered, 's1', NOW + 30_000);
    expect(driveBy.trip).toBeUndefined();
    expect(openItems(driveBy.state.items)).toHaveLength(2);
    expect(handleExit(listed(), 's1', NOW + MIN_DWELL_MS * 2).trip).toBeUndefined();
  });
});

describe('leaving a store with "send leftovers to my cart" on', () => {
  const withCart = () => {
    const s = listed();
    return { ...s, settings: { ...s.settings, leftoversToCart: true } };
  };

  it('asks instead of moving leftovers', () => {
    const entered = handleEnter(withCart(), 's1', NOW).state;
    const out = handleExit(entered, 's1', NOW + MIN_DWELL_MS + 1);
    expect(out.trip).toBeUndefined();
    expect(out.prompt?.items.map((i) => i.name)).toEqual(['eggs', 'milk']);
    expect(openItems(out.state.items)).toHaveLength(2);
  });

  it('files bought items in history and does not ask when nothing is left', () => {
    const base = withCart();
    const bought = { ...base, items: base.items.map((i) => ({ ...i, status: 'bought' as const })) };
    const entered = handleEnter(bought, 's1', NOW).state;
    const out = handleExit(entered, 's1', NOW + MIN_DWELL_MS + 1);
    expect(out.prompt).toBeUndefined();
    expect(out.state.items).toHaveLength(0);
    expect(out.state.history).toHaveLength(2);
  });

  it('words the notification with the store and the remaining items', () => {
    const entered = handleEnter(withCart(), 's1', NOW).state;
    const out = handleExit(entered, 's1', NOW + MIN_DWELL_MS + 1);
    expect(leftoverPromptText(out.prompt!)).toEqual({
      title: 'You left Kroger',
      body: '2 items remaining: eggs, milk. Move to cart now?',
    });
  });
});

describe('queueItems', () => {
  it('queues only the named open items', () => {
    const s = listed();
    const out = queueItems(s, [s.items[0].id], NOW + 5);
    expect(out.items.map((i) => i.status)).toEqual(['queued', 'open']);
    expect(out.items[0].resolvedAt).toBe(NOW + 5);
  });
});

describe('orderQueuedItem', () => {
  it('moves one queued item into history and leaves the rest queued', () => {
    const s = listed();
    const queuedAll = queueItems(queueItems(s, [s.items[0].id], NOW), [s.items[1].id], NOW);
    const out = orderQueuedItem(queuedAll, queuedAll.items[0].id, NOW + 9);
    expect(out.items.map((i) => i.name)).toEqual(['milk']);
    expect(out.history.map((i) => i.name)).toEqual(['eggs']);
    expect(out.history[0].resolvedAt).toBe(NOW + 9);
  });

  it('ignores items that are not queued', () => {
    const s = listed();
    expect(orderQueuedItem(s, s.items[0].id, NOW)).toBe(s);
  });
});

describe('reminderText', () => {
  it('names the store and falls back to a generic body without items', () => {
    const { title, body } = reminderText(store);
    expect(title).toBe("You're near Kroger");
    expect(body).toBe("Don't forget to pick up your grocery items.");
  });

  it('lists the items on the list, capped at four', () => {
    const items = add(EMPTY_STATE, 'we need milk, eggs, bread, rice, noodles and cheese').items;
    expect(reminderText(store, 0, items.slice(0, 3)).body).toBe('Pick up: milk, eggs, bread.');
    expect(reminderText(store, 0, items).body).toMatch(/^Pick up: .+ \+2 more\.$/);
  });

  it('combines nearby stores into one title', () => {
    expect(reminderText(store, 1).title).toBe("You're near Kroger + 1 other");
    expect(reminderText(store, 4).title).toBe("You're near Kroger + 4 others");
  });
});

describe('groupHistoryByDay', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const bought = (name: string, resolvedAt: number) => ({ ...add(EMPTY_STATE, `we need ${name}`).items[0], status: 'bought' as const, resolvedAt });

  it('groups by local day, newest first', () => {
    // Local noon keeps the same-day pair clear of midnight in any timezone.
    const noon = new Date(NOW).setHours(12, 0, 0, 0);
    const groups = groupHistoryByDay([bought('eggs', noon), bought('milk', noon - 3 * DAY), bought('bread', noon - 10_000)]);
    expect(groups.map((g) => g.items.map((i) => i.name))).toEqual([['eggs', 'bread'], ['milk']]);
    expect(groups[0].dayStart).toBeGreaterThan(groups[1].dayStart);
  });

  it('returns nothing for an empty history', () => {
    expect(groupHistoryByDay([])).toEqual([]);
  });
});

describe('recordHeard', () => {
  it('keeps one entry per utterance when the same line is seen again', () => {
    const snippet = { id: 'u1', text: 'we need milk', at: NOW, found: ['milk'] };
    const once = recordHeard(EMPTY_STATE, snippet);
    const twice = recordHeard(once, { ...snippet, found: ['milk', 'eggs'] });
    expect(twice.heard).toHaveLength(1);
    expect(twice.heard[0].found).toEqual(['milk', 'eggs']);
    expect(twice.seenUtteranceIds).toEqual(['u1']);
  });
});

describe('dismissNotNeeded', () => {
  const eggs = (sourceText: string) => [{ name: 'eggs', canonical: 'egg', sourceText, notNeeded: true }];

  it('moves an open item to history with the phrase that removed it', () => {
    const state = add(withStore(), 'we need eggs and milk');
    const { state: next, removed } = dismissNotNeeded(state, eggs('the eggs will last another week'), NOW + 1000);
    expect(removed.map((i) => i.name)).toEqual(['eggs']);
    expect(openItems(next.items).map((i) => i.name)).toEqual(['milk']);
    expect(next.history[0]).toMatchObject({ name: 'eggs', status: 'notNeeded', notNeededText: 'the eggs will last another week', resolvedAt: NOW + 1000 });
  });

  it('ignores items that are not open on the list', () => {
    const state = withStore();
    expect(dismissNotNeeded(state, eggs('x'), NOW).state).toBe(state);
  });

  it('is never added by mergeExtracted', () => {
    expect(mergeExtracted(withStore(), eggs('x'), 'bee', NOW, newId).added).toEqual([]);
  });
});
