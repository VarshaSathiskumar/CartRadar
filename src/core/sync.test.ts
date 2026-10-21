import { describe, expect, it } from 'vitest';
import { fromItemRow, fromSettingsRow, mergeRemote, pendingUpload, stampChanges, toItemRow, toSettingsRow, toStoreRow, type RemoteItem } from './sync';
import { DEFAULT_SETTINGS, EMPTY_STATE, type ListItem, type PersistedState } from './types';

const T = 1_800_000_000_000;
const item = (id: string, patch: Partial<ListItem> = {}): ListItem => ({
  id,
  name: id,
  canonical: id,
  status: 'open',
  source: 'bee',
  addedAt: T,
  carriedOver: 0,
  ...patch,
});
const withItems = (items: ListItem[], history: ListItem[] = [], patch: Partial<PersistedState> = {}): PersistedState => ({ ...EMPTY_STATE, items, history, ...patch });
const remote = (i: ListItem, extra: Partial<RemoteItem> = {}): RemoteItem => ({ item: i, archived: false, ...extra });

describe('stampChanges', () => {
  it('stamps new and changed items, leaves untouched ones alone', () => {
    const prev = withItems([item('a', { updatedAt: T }), item('b', { updatedAt: T })]);
    const next = withItems([item('a', { updatedAt: T }), item('b', { updatedAt: T, status: 'bought' }), item('c')]);
    const out = stampChanges(prev, next, T + 10);
    expect(out.items.map((i) => i.updatedAt)).toEqual([T, T + 10, T + 10]);
  });

  it('leaves a tombstone for an item removed from the list, but not for trimmed history', () => {
    const prev = withItems([item('a')], [item('old')]);
    const out = stampChanges(prev, withItems([], []), T + 5);
    expect(out.tombstones).toEqual({ a: T + 5 });
  });

  it('does not tombstone an item that moved to history, and clears a tombstone when an item returns', () => {
    const moved = stampChanges(withItems([item('a')]), withItems([], [item('a', { status: 'bought' })]), T + 1);
    expect(moved.tombstones).toEqual({});
    const back = stampChanges(withItems([], [], { tombstones: { a: T } }), withItems([item('a')], [], { tombstones: { a: T } }), T + 2);
    expect(back.tombstones).toEqual({});
  });

  it('moves prefsUpdatedAt only when settings or stores change', () => {
    const same = stampChanges(EMPTY_STATE, { ...EMPTY_STATE }, T);
    expect(same.prefsUpdatedAt).toBeUndefined();
    const changed = stampChanges(EMPTY_STATE, { ...EMPTY_STATE, settings: { ...DEFAULT_SETTINGS, zip: '10001' } }, T);
    expect(changed.prefsUpdatedAt).toBe(T);
  });
});

describe('pendingUpload', () => {
  it('uploads everything on a device that never synced', () => {
    const p = pendingUpload(withItems([item('a')], [item('h', { resolvedAt: T })]));
    expect(p.items.map((r) => [r.item.id, r.archived])).toEqual([['a', false], ['h', true]]);
  });

  it('uploads only what changed after the last sync', () => {
    const p = pendingUpload(withItems([item('a', { updatedAt: T }), item('b', { updatedAt: T + 20 })], [], { cloudSyncedAt: T + 10, tombstones: { x: T + 15 } }));
    expect(p.items.map((r) => r.item.id)).toEqual(['b']);
    expect(p.deleted).toEqual([{ id: 'x', at: T + 15 }]);
    expect(p.prefs).toBe(false);
  });
});

describe('mergeRemote', () => {
  it('adds items the cloud has and keeps local-only ones', () => {
    const out = mergeRemote(withItems([item('mine', { addedAt: T })]), [remote(item('theirs', { addedAt: T + 1, updatedAt: T + 1 }))]);
    expect(out.items.map((i) => i.id)).toEqual(['mine', 'theirs']);
  });

  it('newest change wins per item', () => {
    const local = withItems([item('a', { status: 'bought', updatedAt: T + 5 })]);
    expect(mergeRemote(local, [remote(item('a', { status: 'open', updatedAt: T + 1 }))]).items[0].status).toBe('bought');
    expect(mergeRemote(local, [remote(item('a', { status: 'queued', updatedAt: T + 9 }))]).items[0].status).toBe('queued');
  });

  it('puts archived rows in history', () => {
    const out = mergeRemote(EMPTY_STATE, [remote(item('a', { status: 'bought', resolvedAt: T, updatedAt: T }), { archived: true })]);
    expect(out.items).toHaveLength(0);
    expect(out.history.map((i) => i.id)).toEqual(['a']);
  });

  it('applies a newer deletion, ignores an older one, and respects a newer local tombstone', () => {
    const local = withItems([item('a', { updatedAt: T + 5 })]);
    expect(mergeRemote(local, [remote(item('a'), { deletedAt: T + 9 })]).items).toHaveLength(0);
    expect(mergeRemote(local, [remote(item('a'), { deletedAt: T + 1 })]).items).toHaveLength(1);
    const removedHere = withItems([], [], { tombstones: { a: T + 9 } });
    const out = mergeRemote(removedHere, [remote(item('a', { updatedAt: T + 2 }))]);
    expect(out.items).toHaveLength(0);
    expect(out.tombstones).toEqual({ a: T + 9 });
  });

  it('takes the cloud settings and stores only when they are newer', () => {
    const prefs = { settings: { ...DEFAULT_SETTINGS, zip: '94103' }, stores: [{ id: 's', name: 'Safeway', latitude: 1, longitude: 2, enabled: true }], updatedAt: T + 5 };
    const older = { ...EMPTY_STATE, prefsUpdatedAt: T + 9, settings: { ...DEFAULT_SETTINGS, zip: '10001' } };
    expect(mergeRemote(older, [], prefs).settings.zip).toBe('10001');
    const newer = mergeRemote({ ...EMPTY_STATE, prefsUpdatedAt: T }, [], prefs);
    expect(newer.settings.zip).toBe('94103');
    expect(newer.stores.map((s) => s.name)).toEqual(['Safeway']);
    expect(newer.prefsUpdatedAt).toBe(T + 5);
  });
});

describe('row mapping', () => {
  it('round-trips an item', () => {
    const original = item('a', { quantity: '2 lb', heardText: 'we need apples', status: 'bought', resolvedAt: T + 3, carriedOver: 1, updatedAt: T + 4 });
    const row = toItemRow('u1', { item: original, archived: true });
    expect(row.user_id).toBe('u1');
    expect(fromItemRow(row)).toEqual({ item: original, archived: true, deletedAt: undefined });
  });

  it('round-trips settings and stores, and carries no conversation text', () => {
    const settings = { ...DEFAULT_SETTINGS, zip: '10001', centre: { latitude: 40.7, longitude: -74 }, leftoversToCart: true };
    const store = { id: 's', name: 'Kroger', address: '1 Main St', latitude: 1, longitude: 2, enabled: false };
    const back = fromSettingsRow(toSettingsRow('u1', settings, T), [toStoreRow('u1', store, T)]);
    expect(back).toEqual({ settings, stores: [store], updatedAt: T });
    expect(Object.keys(toItemRow('u1', { item: item('a'), archived: false }))).not.toContain('heard');
  });
});
