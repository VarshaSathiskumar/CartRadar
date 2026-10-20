import type { ExtractedItem } from './extractor';
import { canonicalName } from './lexicon';
import type { ItemSource, ListItem, PersistedState, Settings, Store } from './types';

/** Don't re-add something the user checked off within this window. */
export const REBUY_SUPPRESS_MS = 12 * 60 * 60 * 1000;
/** Time inside a store geofence before leaving counts as a shopping trip. */
export const MIN_DWELL_MS = 3 * 60 * 1000;
/** Don't remind about the same store more often than this. */
export const NOTIFY_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const HISTORY_CAP = 200;
const HEARD_CAP = 50;
const SEEN_CAP = 500;

export const openItems = (items: ListItem[]) => items.filter((i) => i.status === 'open');
export const queuedItems = (items: ListItem[]) => items.filter((i) => i.status === 'queued');

export function makeItem(
  id: string,
  fields: Pick<ListItem, 'name' | 'quantity' | 'heardText'>,
  source: ItemSource,
  now: number,
): ListItem {
  return {
    id,
    name: fields.name,
    canonical: canonicalName(fields.name),
    quantity: fields.quantity,
    heardText: fields.heardText,
    status: 'open',
    source,
    addedAt: now,
    carriedOver: 0,
  };
}

/**
 * Adds extracted items to the list. Skips anything already open or queued, and
 * anything bought recently (so a conversation about eggs right after buying
 * them doesn't put eggs back on the list).
 */
export function mergeExtracted(
  state: PersistedState,
  extracted: ExtractedItem[],
  source: ItemSource,
  now: number,
  newId: () => string,
): { state: PersistedState; added: ListItem[] } {
  const blocked = new Set<string>();
  for (const i of state.items) if (i.status !== 'bought') blocked.add(i.canonical);
  for (const i of [...state.items, ...state.history]) {
    if (i.status === 'bought' && i.resolvedAt && now - i.resolvedAt < REBUY_SUPPRESS_MS) blocked.add(i.canonical);
  }

  const added: ListItem[] = [];
  for (const e of extracted) {
    if (blocked.has(e.canonical)) continue;
    blocked.add(e.canonical);
    added.push(makeItem(newId(), { name: e.name, quantity: e.quantity, heardText: e.sourceText }, source, now));
  }
  return { state: added.length ? { ...state, items: [...state.items, ...added] } : state, added };
}

export function recordHeard(
  state: PersistedState,
  snippet: { id: string; text: string; at: number; found: string[] },
): PersistedState {
  return {
    ...state,
    heard: [snippet, ...state.heard].slice(0, HEARD_CAP),
    seenUtteranceIds: [...state.seenUtteranceIds, snippet.id].slice(-SEEN_CAP),
  };
}

export function markSeen(state: PersistedState, ids: string[]): PersistedState {
  return { ...state, seenUtteranceIds: [...state.seenUtteranceIds, ...ids].slice(-SEEN_CAP) };
}

export function toggleBought(state: PersistedState, id: string, now: number): PersistedState {
  return {
    ...state,
    items: state.items.map((i) => {
      if (i.id !== id) return i;
      return i.status === 'bought' ? { ...i, status: 'open', resolvedAt: undefined } : { ...i, status: 'bought', resolvedAt: now };
    }),
  };
}

export function removeItem(state: PersistedState, id: string): PersistedState {
  return { ...state, items: state.items.filter((i) => i.id !== id) };
}

export interface TripOutcome {
  state: PersistedState;
  boughtCount: number;
  carried: ListItem[];
  queued: ListItem[];
}

/**
 * Ends a shopping trip. Checked-off items move to history. Everything still
 * open is a leftover: with `leftoversToCart` off it stays on the list for the
 * next trip (with its carry-over count bumped); with it on it moves to the cart
 * queue. Nothing is ever deleted.
 */
export function finishTrip(state: PersistedState, now: number): TripOutcome {
  const toCart = state.settings.leftoversToCart;
  const bought = state.items.filter((i) => i.status === 'bought');
  const leftovers = openItems(state.items);
  const queuedBefore = queuedItems(state.items);

  const carried = toCart ? [] : leftovers.map((i) => ({ ...i, carriedOver: i.carriedOver + 1 }));
  const queued = toCart ? leftovers.map((i) => ({ ...i, status: 'queued' as const, resolvedAt: now })) : [];

  return {
    state: {
      ...state,
      items: [...carried, ...queuedBefore, ...queued],
      history: [...bought, ...state.history].slice(0, HISTORY_CAP),
      lastTripAt: now,
    },
    boughtCount: bought.length,
    carried,
    queued,
  };
}

/** Clears the cart queue once the user has handed those items to the shopping app. */
export function clearQueued(state: PersistedState, now: number): PersistedState {
  const done = queuedItems(state.items).map((i) => ({ ...i, resolvedAt: now }));
  return {
    ...state,
    items: state.items.filter((i) => i.status !== 'queued'),
    history: [...done, ...state.history].slice(0, HISTORY_CAP),
  };
}

/** Moves a queued item back onto the shopping list. */
export function requeueToList(state: PersistedState, id: string): PersistedState {
  return {
    ...state,
    items: state.items.map((i) => (i.id === id && i.status === 'queued' ? { ...i, status: 'open', resolvedAt: undefined } : i)),
  };
}

export function updateSettings(state: PersistedState, patch: Partial<Settings>): PersistedState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

export function setStores(state: PersistedState, found: Store[]): PersistedState {
  const wasEnabled = new Map(state.stores.map((s) => [s.id, s.enabled]));
  return { ...state, stores: found.map((s) => ({ ...s, enabled: wasEnabled.get(s.id) ?? true })) };
}

export function toggleStore(state: PersistedState, id: string): PersistedState {
  return { ...state, stores: state.stores.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)) };
}

export interface GeofenceDecision {
  state: PersistedState;
  /** Set when the app should show a reminder notification. */
  reminder?: { store: Store; items: ListItem[] };
  /** Set when leaving the store ended a shopping trip. */
  trip?: TripOutcome & { store: Store };
}

/** Pure handler for a geofence enter event. */
export function handleEnter(state: PersistedState, storeId: string, now: number): GeofenceDecision {
  const store = state.stores.find((s) => s.id === storeId);
  if (!store || !store.enabled) return { state };

  const next: PersistedState = { ...state, visits: { ...state.visits, [storeId]: now } };
  const items = openItems(state.items);
  const last = state.lastNotifiedAt[storeId];
  const coolingDown = last !== undefined && now - last < NOTIFY_COOLDOWN_MS;

  if (!state.settings.remindersEnabled || items.length === 0 || coolingDown) return { state: next };
  return {
    state: { ...next, lastNotifiedAt: { ...next.lastNotifiedAt, [storeId]: now } },
    reminder: { store, items },
  };
}

/** Pure handler for a geofence exit event. Ends the trip if the user was inside long enough. */
export function handleExit(state: PersistedState, storeId: string, now: number): GeofenceDecision {
  const store = state.stores.find((s) => s.id === storeId);
  const enteredAt = state.visits[storeId];
  const { [storeId]: _removed, ...visits } = state.visits;
  const next: PersistedState = { ...state, visits };

  if (!store || enteredAt === undefined || now - enteredAt < MIN_DWELL_MS) return { state: next };
  if (state.items.length === 0) return { state: next };

  const trip = finishTrip(next, now);
  return { state: trip.state, trip: { ...trip, store } };
}

export function reminderText(store: Store, items: ListItem[]): { title: string; body: string } {
  const names = items.map((i) => (i.quantity ? `${i.quantity} ${i.name}` : i.name));
  const shown = names.slice(0, 5).join(', ');
  const more = names.length > 5 ? ` +${names.length - 5} more` : '';
  return {
    title: `You're near ${store.name}`,
    body: `${items.length} ${items.length === 1 ? 'item' : 'items'} to pick up: ${shown}${more}`,
  };
}

export function tripText(t: TripOutcome & { store: Store }, providerLabel: string): { title: string; body: string } | undefined {
  if (t.queued.length) {
    return {
      title: `${t.queued.length} left over from ${t.store.name}`,
      body: `Ready to add to your ${providerLabel} cart. Tap to review.`,
    };
  }
  if (t.carried.length) {
    return {
      title: `${t.carried.length} ${t.carried.length === 1 ? 'item' : 'items'} left over`,
      body: `Moved to your next list: ${t.carried.slice(0, 4).map((i) => i.name).join(', ')}`,
    };
  }
  return undefined;
}
