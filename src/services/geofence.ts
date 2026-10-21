import * as Location from 'expo-location';
import { handleEnter, handleExit, leftoverPromptText, reminderText, tripText } from '../core/listLogic';
import { LEFTOVERS_CATEGORY, notifyNow } from './notifications';
import { mutate, readState } from './store';

export const GEOFENCE_TASK = 'cartradar-geofence';

/** Loaded defensively: it throws if its native code is missing (some Expo Go builds), which would crash the whole app. */
function loadTaskManager(): typeof import('expo-task-manager') | undefined {
  try {
    return require('expo-task-manager');
  } catch {
    return undefined;
  }
}
const TaskManager = loadTaskManager();

/** Registered at module load (imported from the root layout) so the OS can wake the app for it. */
TaskManager?.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(
  GEOFENCE_TASK,
  async ({ data, error }) => {
    if (error || !data) return;
    const storeId = data.region.identifier;
    if (!storeId) return;
    const now = Date.now();

    if (data.eventType === Location.GeofencingEventType.Enter) {
      const decision = await mutate((s) => {
        const d = handleEnter(s, storeId, now);
        return { state: d.state, result: d };
      });
      if (decision?.reminder) {
        const { title, body } = reminderText(decision.reminder.store);
        await notifyNow(title, body, { screen: 'list' });
      }
    } else if (data.eventType === Location.GeofencingEventType.Exit) {
      const decision = await mutate((s) => {
        const d = handleExit(s, storeId, now);
        return { state: d.state, result: d };
      });
      if (decision?.prompt) {
        const { title, body } = leftoverPromptText(decision.prompt);
        await notifyNow(title, body, { screen: 'list', itemIds: decision.prompt.items.map((i) => i.id) }, LEFTOVERS_CATEGORY);
      }
      if (decision?.trip) {
        const settings = (await readState()).settings;
        const text = tripText(decision.trip);
        if (text) await notifyNow(text.title, text.body, { screen: settings.leftoversToCart ? 'cart' : 'list' });
      }
    }
  },
);

export type GeofenceStatus = 'active' | 'no-stores' | 'foreground-denied' | 'background-denied' | 'unavailable';

/** (Re)registers geofences for the enabled stores. Call after the store list, toggles or radius change. */
export async function syncGeofences(): Promise<GeofenceStatus> {
  try {
    return await registerGeofences();
  } catch {
    // Expo Go cannot do background location, and some devices refuse region monitoring; never let that crash a screen.
    return 'unavailable';
  }
}

async function registerGeofences(): Promise<GeofenceStatus> {
  if (!TaskManager) return 'unavailable';
  const state = await readState();
  const stores = state.stores.filter((s) => s.enabled);

  const running = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  if (stores.length === 0) {
    if (running) await Location.stopGeofencingAsync(GEOFENCE_TASK);
    return 'no-stores';
  }

  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return 'foreground-denied';
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) return 'background-denied';

  await Location.startGeofencingAsync(
    GEOFENCE_TASK,
    stores.map((s) => ({
      identifier: s.id,
      latitude: s.latitude,
      longitude: s.longitude,
      radius: state.settings.geofenceRadiusM,
      notifyOnEnter: true,
      notifyOnExit: true,
    })),
  );
  return 'active';
}
