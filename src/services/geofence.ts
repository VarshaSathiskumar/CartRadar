import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { handleEnter, handleExit, reminderText, tripText } from '../core/listLogic';
import { CART_PROVIDERS } from './cart';
import { notifyNow } from './notifications';
import { mutate, readState } from './store';

export const GEOFENCE_TASK = 'cartradar-geofence';

/** Registered at module load (imported from the root layout) so the OS can wake the app for it. */
TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(
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
        const { title, body } = reminderText(decision.reminder.store, decision.reminder.items);
        await notifyNow(title, body, { screen: 'list' });
      }
    } else if (data.eventType === Location.GeofencingEventType.Exit) {
      const decision = await mutate((s) => {
        const d = handleExit(s, storeId, now);
        return { state: d.state, result: d };
      });
      if (decision?.trip) {
        const settings = (await readState()).settings;
        const text = tripText(decision.trip, CART_PROVIDERS[settings.cartProvider].label);
        if (text) await notifyNow(text.title, text.body, { screen: settings.leftoversToCart ? 'cart' : 'list' });
      }
    }
  },
);

export type GeofenceStatus = 'active' | 'no-stores' | 'foreground-denied' | 'background-denied';

/** (Re)registers geofences for the enabled stores. Call after the store list, toggles or radius change. */
export async function syncGeofences(): Promise<GeofenceStatus> {
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
