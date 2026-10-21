import type { ListItem, PersistedState, Settings, Store } from './types';

/**
 * Pure logic for syncing the list, settings and stores with the cloud. No network here:
 * services/cloudSync.ts fetches and uploads, this decides who wins.
 */

/** A list item as stored in the cloud (list_items). */
export interface RemoteItem {
  item: ListItem;
  archived: boolean;
  /** Epoch ms the row was soft-deleted, if it was. */
  deletedAt?: number;
}

export interface RemotePrefs {
  settings: Settings;
  stores: Store[];
  updatedAt: number;
}

const sameContent = (a: ListItem, b: ListItem) => JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 });

/**
 * Stamps what changed between two states so a later sync knows what to upload:
 * changed or new items get updatedAt, items that vanished from the list get a tombstone,
 * and a settings or stores change moves prefsUpdatedAt. History trimmed by its cap is not a deletion.
 */
export function stampChanges(prev: PersistedState, next: PersistedState, now: number): PersistedState {
  const before = new Map([...prev.items, ...prev.history].map((i) => [i.id, i]));
  const stamp = (i: ListItem): ListItem => {
    const old = before.get(i.id);
    return old && sameContent(old, i) ? { ...i, updatedAt: old.updatedAt ?? i.updatedAt } : { ...i, updatedAt: now };
  };
  const items = next.items.map(stamp);
  const history = next.history.map(stamp);

  const present = new Set([...items, ...history].map((i) => i.id));
  const tombstones = { ...next.tombstones };
  for (const i of prev.items) if (!present.has(i.id)) tombstones[i.id] = now;
  for (const id of present) delete tombstones[id];

  const prefsChanged = JSON.stringify([prev.settings, prev.stores]) !== JSON.stringify([next.settings, next.stores]);
  return { ...next, items, history, tombstones, prefsUpdatedAt: prefsChanged ? now : next.prefsUpdatedAt };
}

/** What this device still has to upload, given when the last sync started. */
export function pendingUpload(state: PersistedState): { items: RemoteItem[]; deleted: { id: string; at: number }[]; prefs: boolean } {
  const since = state.cloudSyncedAt ?? 0;
  const changed = (i: ListItem) => (i.updatedAt ?? i.resolvedAt ?? i.addedAt) > since;
  return {
    items: [
      ...state.items.filter(changed).map((item) => ({ item, archived: false })),
      ...state.history.filter(changed).map((item) => ({ item, archived: true })),
    ],
    deleted: Object.entries(state.tombstones).map(([id, at]) => ({ id, at })),
    // Never synced: upload settings and stores once even when nothing was edited, unless the cloud has newer ones.
    prefs: (state.prefsUpdatedAt ?? 0) > since || (state.cloudSyncedAt === undefined && state.stores.length + (state.settings.zip ? 1 : 0) > 0),
  };
}

/** Folds what the cloud has into local state. Newest change per item wins; the cloud's settings win only when newer. */
export function mergeRemote(local: PersistedState, remoteItems: RemoteItem[], remotePrefs?: RemotePrefs): PersistedState {
  const items = new Map(local.items.map((i) => [i.id, i]));
  const history = new Map(local.history.map((i) => [i.id, i]));
  const tombstones = { ...local.tombstones };

  for (const remote of remoteItems) {
    const id = remote.item.id;
    const mine = items.get(id) ?? history.get(id);
    const remoteAt = remote.deletedAt ?? remote.item.updatedAt ?? 0;
    const localAt = mine ? (mine.updatedAt ?? mine.resolvedAt ?? mine.addedAt) : (tombstones[id] ?? -1);
    if (localAt >= remoteAt) continue;

    items.delete(id);
    history.delete(id);
    delete tombstones[id];
    if (remote.deletedAt !== undefined) continue;
    (remote.archived ? history : items).set(id, remote.item);
  }

  const mergedPrefs =
    remotePrefs && remotePrefs.updatedAt > (local.prefsUpdatedAt ?? 0)
      ? { settings: { ...local.settings, ...remotePrefs.settings }, stores: remotePrefs.stores, prefsUpdatedAt: remotePrefs.updatedAt }
      : {};

  return {
    ...local,
    ...mergedPrefs,
    items: [...items.values()].sort((a, b) => a.addedAt - b.addedAt),
    history: [...history.values()].sort((a, b) => (b.resolvedAt ?? b.addedAt) - (a.resolvedAt ?? a.addedAt)),
    tombstones,
  };
}

// ---- Row mapping (column names match supabase/migrations/0001_init.sql) ----

const iso = (ms: number) => new Date(ms).toISOString();

export interface ItemRow {
  user_id: string;
  id: string;
  name: string;
  canonical: string;
  quantity: string | null;
  status: ListItem['status'];
  source: ListItem['source'];
  heard_text: string | null;
  carried_over: number;
  archived: boolean;
  added_at: string;
  resolved_at: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export function toItemRow(userId: string, { item, archived }: RemoteItem): ItemRow {
  return {
    user_id: userId,
    id: item.id,
    name: item.name,
    canonical: item.canonical,
    quantity: item.quantity ?? null,
    status: item.status,
    source: item.source,
    heard_text: item.heardText ?? null,
    carried_over: item.carriedOver,
    archived,
    added_at: iso(item.addedAt),
    resolved_at: item.resolvedAt === undefined ? null : iso(item.resolvedAt),
    updated_at: iso(item.updatedAt ?? item.resolvedAt ?? item.addedAt),
    deleted_at: null,
  };
}

export function fromItemRow(row: ItemRow): RemoteItem {
  const item: ListItem = {
    id: row.id,
    name: row.name,
    canonical: row.canonical,
    status: row.status,
    source: row.source,
    addedAt: Date.parse(row.added_at),
    carriedOver: row.carried_over,
    updatedAt: Date.parse(row.updated_at),
  };
  if (row.quantity !== null) item.quantity = row.quantity;
  if (row.heard_text !== null) item.heardText = row.heard_text;
  if (row.resolved_at !== null) item.resolvedAt = Date.parse(row.resolved_at);
  return { item, archived: row.archived, deletedAt: row.deleted_at === null ? undefined : Date.parse(row.deleted_at) };
}

export interface SettingsRow {
  user_id: string;
  zip: string;
  centre_lat: number | null;
  centre_lng: number | null;
  geofence_radius_m: number;
  leftovers_to_cart: boolean;
  reminders_enabled: boolean;
  demo_mode: boolean;
  updated_at: string;
}

export const toSettingsRow = (userId: string, s: Settings, updatedAt: number): SettingsRow => ({
  user_id: userId,
  zip: s.zip,
  centre_lat: s.centre?.latitude ?? null,
  centre_lng: s.centre?.longitude ?? null,
  geofence_radius_m: s.geofenceRadiusM,
  leftovers_to_cart: s.leftoversToCart,
  reminders_enabled: s.remindersEnabled,
  demo_mode: s.demoMode,
  updated_at: iso(updatedAt),
});

export function fromSettingsRow(row: SettingsRow, stores: StoreRow[]): RemotePrefs {
  const settings: Settings = {
    zip: row.zip,
    geofenceRadiusM: row.geofence_radius_m,
    leftoversToCart: row.leftovers_to_cart,
    remindersEnabled: row.reminders_enabled,
    demoMode: row.demo_mode,
  };
  if (row.centre_lat !== null && row.centre_lng !== null) settings.centre = { latitude: row.centre_lat, longitude: row.centre_lng };
  return {
    settings,
    stores: stores.map((s) => ({ id: s.id, name: s.name, ...(s.address === null ? {} : { address: s.address }), latitude: s.latitude, longitude: s.longitude, enabled: s.enabled })),
    updatedAt: Date.parse(row.updated_at),
  };
}

export interface StoreRow {
  user_id: string;
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  enabled: boolean;
  updated_at: string;
}

export const toStoreRow = (userId: string, s: Store, updatedAt: number): StoreRow => ({
  user_id: userId,
  id: s.id,
  name: s.name,
  address: s.address ?? null,
  latitude: s.latitude,
  longitude: s.longitude,
  enabled: s.enabled,
  updated_at: iso(updatedAt),
});
