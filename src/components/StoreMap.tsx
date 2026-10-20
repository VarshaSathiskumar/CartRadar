import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { Store } from '../core/types';
import type { Coords } from '../services/location';

export interface StoreMapProps {
  user?: Coords;
  stores: Store[];
  /** What the user marker is called: "You are here" or the zip search area. */
  userLabel?: string;
}

export function StoreMap({ user, stores, userLabel }: StoreMapProps) {
  const centre = user ?? stores[0];
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      region={
        centre
          ? { latitude: centre.latitude, longitude: centre.longitude, latitudeDelta: 0.06, longitudeDelta: 0.06 }
          : undefined
      }
    >
      {user && <Marker coordinate={user} title={userLabel ?? 'You are here'} pinColor="blue" />}
      {stores.map((s) => (
        <Marker key={s.id} coordinate={{ latitude: s.latitude, longitude: s.longitude }} title={s.name} />
      ))}
    </MapView>
  );
}
