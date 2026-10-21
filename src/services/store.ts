import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { stampChanges } from '../core/sync';
import { EMPTY_STATE, type PersistedState } from '../core/types';

const KEY = 'cartradar/state/v1';

let cache: PersistedState = EMPTY_STATE;
let loaded = false;
const listeners = new Set<() => void>();
const changeListeners = new Set<() => void>();
// Serialises writes so a background task and the UI can't interleave a read-modify-write.
let queue: Promise<unknown> = Promise.resolve();

async function readDisk(): Promise<PersistedState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    // Spread over defaults so state saved by an older version still has every field.
    return { ...EMPTY_STATE, ...parsed, settings: { ...EMPTY_STATE.settings, ...parsed.settings } };
  } catch {
    return EMPTY_STATE;
  }
}

function publish(next: PersistedState) {
  cache = next;
  loaded = true;
  listeners.forEach((l) => l());
}

export async function loadState(): Promise<PersistedState> {
  publish(await readDisk());
  return cache;
}

/**
 * Read-modify-write against what is on disk (not the in-memory copy), so it is
 * safe to call from a background task that runs outside the React tree.
 */
export function mutate<R = void>(fn: (state: PersistedState) => { state: PersistedState; result?: R } | PersistedState): Promise<R | undefined> {
  const run = async () => {
    const current = await readDisk();
    const out = fn(current);
    // Stamping here, the one place every edit passes through, tells cloud sync what changed.
    const next = stampChanges(current, 'items' in out ? out : out.state, Date.now());
    const result = 'items' in out ? undefined : out.result;
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    publish(next);
    changeListeners.forEach((l) => l());
    return result;
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

/** Like mutate, but for changes that came from the cloud: not stamped as local edits and not synced back. */
export function mutateSilently(fn: (state: PersistedState) => PersistedState): Promise<void> {
  const run = async () => {
    const next = fn(await readDisk());
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    publish(next);
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

/** Called after every local edit; cloud sync uses it to schedule an upload. */
export function onLocalChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

export async function readState(): Promise<PersistedState> {
  await queue;
  return readDisk();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useAppState(): { state: PersistedState; ready: boolean } {
  const state = useSyncExternalStore(subscribe, () => cache);
  return { state, ready: loaded };
}
