import { useSyncExternalStore } from 'react';
import { reminderText } from '../core/listLogic';
import { checkProximity } from '../core/proximity';
import { mutate } from './store';

export type WebReminderStatus = 'off' | 'tracking' | 'denied' | 'unavailable';

export interface WebReminder {
  key: string;
  title: string;
  body: string;
}

interface View {
  status: WebReminderStatus;
  reminders: WebReminder[];
}

let view: View = { status: 'off', reminders: [] };
const listeners = new Set<() => void>();
const set = (patch: Partial<View>) => {
  view = { ...view, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export const useWebReminders = (): View => useSyncExternalStore(subscribe, () => view);

export function dismissWebReminder(key: string): void {
  set({ reminders: view.reminders.filter((r) => r.key !== key) });
}

let watchId: number | undefined;
let inside: ReadonlySet<string> = new Set();
let busy = false;

async function onPosition(pos: GeolocationPosition) {
  if (busy) return; // fixes can arrive faster than the state is read and saved
  busy = true;
  try {
    const found = await mutate((s) => {
      const r = checkProximity(s, pos.coords, inside, Date.now());
      inside = r.inside;
      return { state: r.state, result: r.reminders };
    });
    if (!found?.length) return;
    const now = Date.now();
    set({
      reminders: [
        ...view.reminders.filter((r) => !found.some((f) => r.key.startsWith(`${f.store.id}:`))),
        ...found.map((f) => ({ key: `${f.store.id}:${now}`, ...reminderText(f.store, f.items) })),
      ],
    });
  } finally {
    busy = false;
  }
}

/**
 * Starts watching the position while the page is open (the browser asks for permission on first use).
 * Safe to call again; stopWebReminders turns it off and forgets which stores the user was inside.
 */
export function startWebReminders(): void {
  if (watchId !== undefined) return;
  if (typeof navigator === 'undefined' || !navigator.geolocation) return set({ status: 'unavailable' });
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (view.status !== 'tracking') set({ status: 'tracking' });
      void onPosition(pos);
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        stopWebReminders();
        set({ status: 'denied' });
      }
      // Timeouts and lost signal are retried by the browser; nothing to show.
    },
    { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
  );
}

export function stopWebReminders(): void {
  if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
  watchId = undefined;
  inside = new Set();
  set({ status: 'off', reminders: [] });
}
