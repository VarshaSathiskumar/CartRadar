import { useSyncExternalStore } from 'react';

export type SyncStatus =
  | { phase: 'idle' }
  | { phase: 'syncing' }
  | { phase: 'done'; at: number; message: string }
  | { phase: 'error'; at: number; message: string };

let current: SyncStatus = { phase: 'idle' };
const listeners = new Set<() => void>();

export function setSyncStatus(next: SyncStatus): void {
  current = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** What the last Bee sync did, for the screens to show. */
export const useSyncStatus = (): SyncStatus => useSyncExternalStore(subscribe, () => current);
