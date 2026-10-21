import { describe, expect, it } from 'vitest';
import { NOTIFY_COOLDOWN_MS } from './listLogic';
import { checkProximity, claimNearbyStores } from './proximity';
import { EMPTY_STATE } from './types';
import type { ListItem, PersistedState, Store } from './types';

const store: Store = { id: 's1', name: 'Market', latitude: 40, longitude: -74, enabled: true } as Store;
const item = { id: 'i1', name: 'eggs', canonical: 'egg', status: 'open', source: 'manual', addedAt: 0, carriedOver: 0 } as ListItem;
const base: PersistedState = { ...EMPTY_STATE, stores: [store], items: [item] };
const R = base.settings.geofenceRadiusM;
const at = (metres: number) => ({ latitude: 40 + metres / 111_320, longitude: -74 });

describe('checkProximity', () => {
  it('reminds once on entering the saved radius, not before', () => {
    expect(checkProximity(base, at(R + 100), new Set(), 1).reminders).toHaveLength(0);
    const r = checkProximity(base, at(R - 50), new Set(), 1);
    expect(r.reminders).toHaveLength(1);
    expect(r.state.lastNotifiedAt.s1).toBe(1);
    expect(checkProximity(r.state, at(R / 2), r.inside, 2).reminders).toHaveLength(0);
  });

  it('does not repeat when GPS jitters at the edge', () => {
    const r = checkProximity(base, at(R - 10), new Set(), 1);
    const out = checkProximity(r.state, at(R + 30), r.inside, NOTIFY_COOLDOWN_MS + 5);
    expect(out.inside.has('s1')).toBe(true);
    expect(out.reminders).toHaveLength(0);
  });

  it('respects the cooldown, then reminds again after leaving and returning', () => {
    const r = checkProximity(base, at(R / 2), new Set(), 1);
    const left = checkProximity(r.state, at(R + 500), r.inside, 2);
    expect(checkProximity(left.state, at(R / 2), left.inside, 3).reminders).toHaveLength(0);
    expect(checkProximity(left.state, at(R / 2), left.inside, NOTIFY_COOLDOWN_MS + 2).reminders).toHaveLength(1);
  });

  it('ignores the cooldown when asked to (page load or zip change)', () => {
    const r = checkProximity(base, at(R / 2), new Set(), 1);
    expect(checkProximity(r.state, at(R / 2), new Set(), 2).reminders).toHaveLength(0);
    expect(checkProximity(r.state, at(R / 2), new Set(), 2, true).reminders).toHaveLength(1);
  });

  it('skips disabled stores and empty lists', () => {
    expect(checkProximity({ ...base, stores: [{ ...store, enabled: false }] }, at(10), new Set(), 1).reminders).toHaveLength(0);
    expect(checkProximity({ ...base, items: [] }, at(10), new Set(), 1).reminders).toHaveLength(0);
  });
});

describe('claimNearbyStores', () => {
  const other: Store = { id: 's2', name: 'Target', latitude: 40.001, longitude: -74, enabled: true } as Store;
  const far: Store = { id: 's3', name: 'Far', latitude: 41, longitude: -74, enabled: true } as Store;
  const state: PersistedState = { ...base, stores: [store, other, far], settings: { ...base.settings, geofenceRadiusM: 500 } };

  it('claims stores within the radius and marks them reminded', () => {
    const r = claimNearbyStores(state, 's1', { latitude: 40, longitude: -74 }, 10);
    expect(r.others.map((o) => o.id)).toEqual(['s2']);
    expect(r.state.lastNotifiedAt.s2).toBe(10);
  });

  it('skips stores still cooling down', () => {
    const cooling = { ...state, lastNotifiedAt: { s2: 5 } };
    expect(claimNearbyStores(cooling, 's1', { latitude: 40, longitude: -74 }, 10).others).toHaveLength(0);
  });
});
