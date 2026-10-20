import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { EMPTY_STATE, type PersistedState } from '../core/types';

const KEY = 'cartradar/state/v1';

let cache: PersistedState = EMPTY_STATE;
let loaded = false;
const listeners = new Set<() => void>();
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
    const next = 'items' in out ? out : out.state;
    const result = 'items' in out ? undefined : out.result;
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    publish(next);
    return result;
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
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
