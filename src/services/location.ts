import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import type { Store } from '../core/types';
import { findGroceryStores } from './stores';

export interface Coords {
  latitude: number;
  longitude: number;
}

export type LocationStatus = 'loading' | 'ready' | 'denied' | 'error';

/** The user's current position, asked once when the screen mounts. */
export function useUserLocation(): { coords?: Coords; status: LocationStatus } {
  const [coords, setCoords] = useState<Coords | undefined>();
  const [status, setStatus] = useState<LocationStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { status: permission } = await Location.requestForegroundPermissionsAsync();
        if (permission !== 'granted') return !cancelled && setStatus('denied');
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { coords, status };
}

/** Grocery stores around a point, looked up once per rounded position. */
export function useNearbyStores(coords?: Coords): Store[] {
  const [stores, setStores] = useState<Store[]>([]);
  const lat = coords?.latitude;
  const lon = coords?.longitude;

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    let cancelled = false;
    findGroceryStores({ latitude: lat, longitude: lon })
      .then((found) => !cancelled && setStores(found))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [lat?.toFixed(3), lon?.toFixed(3)]);

  return stores;
}
