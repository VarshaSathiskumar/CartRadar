import { distanceMeters } from './geo';
import { NOTIFY_COOLDOWN_MS, openItems } from './listLogic';
import type { ListItem, PersistedState, Store } from './types';

/** How close counts as "at the store" for reminders shown while the app is open. */
export const WEB_REMINDER_RADIUS_M = Math.round(1.5 * 1609.344);
/** A store already counted as entered only counts as left beyond this extra distance, so GPS jitter at the edge cannot repeat a reminder. */
export const EXIT_MARGIN_M = 50;

export interface ProximityResult {
  /** Ids of the stores the user is currently inside; pass it back with the next position. */
  inside: Set<string>;
  state: PersistedState;
  reminders: { store: Store; items: ListItem[] }[];
}

/**
 * Pure step for one position fix. A reminder is due for a store the user has just entered, when items are pending and
 * the store was not reminded about within the cooldown. The reminder time is saved in `lastNotifiedAt`, so a reload
 * or a second tab cannot repeat it either. `ignoreCooldown` is for a page load or a zip change, which always remind.
 */
export function checkProximity(
  state: PersistedState,
  here: { latitude: number; longitude: number },
  inside: ReadonlySet<string>,
  now: number,
  ignoreCooldown = false,
): ProximityResult {
  const nextInside = new Set<string>();
  const reminders: ProximityResult['reminders'] = [];
  const items = openItems(state.items);
  let lastNotifiedAt = state.lastNotifiedAt;

  for (const store of state.stores) {
    if (!store.enabled) continue;
    const d = distanceMeters(here, store);
    const wasInside = inside.has(store.id);
    if (d > WEB_REMINDER_RADIUS_M + (wasInside ? EXIT_MARGIN_M : 0)) continue;
    nextInside.add(store.id);
    if (wasInside || items.length === 0) continue;
    const last = lastNotifiedAt[store.id];
    if (!ignoreCooldown && last !== undefined && now - last < NOTIFY_COOLDOWN_MS) continue;
    lastNotifiedAt = { ...lastNotifiedAt, [store.id]: now };
    reminders.push({ store, items });
  }

  return { inside: nextInside, state: lastNotifiedAt === state.lastNotifiedAt ? state : { ...state, lastNotifiedAt }, reminders };
}
