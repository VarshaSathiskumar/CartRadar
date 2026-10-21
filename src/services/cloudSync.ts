import { AppState } from 'react-native';
import {
  fromItemRow,
  fromSettingsRow,
  mergeRemote,
  pendingUpload,
  toItemRow,
  toSettingsRow,
  toStoreRow,
  type ItemRow,
  type SettingsRow,
  type StoreRow,
} from '../core/sync';
import { EMPTY_STATE } from '../core/types';
import { mutateSilently, onLocalChange, readState } from './store';
import { supabase } from './supabase';

const CHUNK = 500;
const DEBOUNCE_MS = 2000;

const chunks = <T>(rows: T[]): T[][] => Array.from({ length: Math.ceil(rows.length / CHUNK) }, (_, i) => rows.slice(i * CHUNK, (i + 1) * CHUNK));

function check<T>(result: { data: T | null; error: { message: string } | null }): T | null {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

/**
 * Two-way sync with Supabase: pull what the cloud has and merge it (newest change wins per item),
 * then upload what changed here since the last sync. Local storage stays the source of truth offline.
 */
async function syncOnce(userId: string, force: boolean): Promise<void> {
  if (!supabase) return;
  const startedAt = Date.now();

  const initial = await readState();
  if (initial.cloudUserId && initial.cloudUserId !== userId) {
    // Another account's data must never upload into this one.
    await mutateSilently(() => ({ ...EMPTY_STATE, cloudUserId: userId }));
  } else if (!force) {
    const todo = pendingUpload(initial);
    if (!todo.items.length && !todo.deleted.length && !todo.prefs) return;
  }

  const [itemRows, settingsRow, storeRows] = await Promise.all([
    supabase.from('list_items').select('*').then((r) => check(r) as ItemRow[] | null),
    supabase.from('user_settings').select('*').maybeSingle().then((r) => check(r) as SettingsRow | null),
    supabase.from('stores').select('*').then((r) => check(r) as StoreRow[] | null),
  ]);

  const prefs = settingsRow ? fromSettingsRow(settingsRow, storeRows ?? []) : undefined;
  await mutateSilently((local) => mergeRemote(local, (itemRows ?? []).map(fromItemRow), prefs));

  const state = await readState();
  const pending = pendingUpload(state);

  for (const batch of chunks(pending.items.map((r) => toItemRow(userId, r)))) check(await supabase.from('list_items').upsert(batch));

  if (pending.deleted.length) {
    const at = new Date(Math.max(...pending.deleted.map((d) => d.at))).toISOString();
    // An update, not an upsert: an item that never reached the cloud has no row to mark.
    for (const batch of chunks(pending.deleted.map((d) => d.id))) {
      check(await supabase.from('list_items').update({ deleted_at: at, updated_at: at }).in('id', batch));
    }
  }

  if (pending.prefs) {
    const at = state.prefsUpdatedAt ?? startedAt;
    check(await supabase.from('user_settings').upsert(toSettingsRow(userId, state.settings, at)));
    const keep = new Set(state.stores.map((s) => s.id));
    if (state.stores.length) check(await supabase.from('stores').upsert(state.stores.map((s) => toStoreRow(userId, s, at))));
    const stale = (storeRows ?? []).map((s) => s.id).filter((id) => !keep.has(id));
    if (stale.length) check(await supabase.from('stores').delete().in('id', stale));
  }

  const uploaded = new Set(pending.deleted.map((d) => d.id));
  await mutateSilently((s) => ({
    ...s,
    cloudUserId: userId,
    cloudSyncedAt: startedAt,
    tombstones: Object.fromEntries(Object.entries(s.tombstones).filter(([id]) => !uploaded.has(id))),
  }));
}

let running: Promise<void> | undefined;
let rerun: { force: boolean } | undefined;

/** One sync at a time; a request that arrives mid-sync runs once more afterwards. */
function sync(userId: string, force: boolean): Promise<void> {
  if (running) {
    rerun = { force: force || !!rerun?.force };
    return running;
  }
  running = syncOnce(userId, force)
    .catch((e: unknown) => console.warn('Cloud sync failed:', e instanceof Error ? e.message : e))
    .finally(() => {
      running = undefined;
      const next = rerun;
      rerun = undefined;
      if (next) void sync(userId, next.force);
    });
  return running;
}

/**
 * Keeps this device in step with the signed-in account: a full sync now and whenever the app
 * comes to the foreground, and an upload shortly after each local edit. Returns a stop function.
 */
export function startCloudSync(userId: string): () => void {
  if (!supabase) return () => undefined;
  void sync(userId, true);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopChanges = onLocalChange(() => {
    clearTimeout(timer);
    timer = setTimeout(() => void sync(userId, false), DEBOUNCE_MS);
  });
  const appState = AppState.addEventListener('change', (s) => {
    if (s === 'active') void sync(userId, true);
  });

  return () => {
    clearTimeout(timer);
    stopChanges();
    appState.remove();
  };
}
