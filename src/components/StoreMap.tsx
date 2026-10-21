import { Linking, StyleSheet } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { googleMapsPlaceUrl } from '../core/geo';
import type { Store } from '../core/types';
import type { Coords } from '../services/location';

export interface StoreMapProps {
  user?: Coords;
  stores: Store[];
  /** What the user marker is called: "You are here" or the zip search area. */
  userLabel?: string;
  /** Reminder distance, drawn as a circle around the user marker. */
  radiusM?: number;
}

export function StoreMap({ user, stores, userLabel, radiusM }: StoreMapProps) {
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
      {user && radiusM ? (
        <Circle center={user} radius={radiusM} strokeColor="rgba(31,138,76,0.9)" fillColor="rgba(31,138,76,0.15)" strokeWidth={2} />
      ) : null}
      {stores.map((s) => (
        <Marker
          key={s.id}
          coordinate={{ latitude: s.latitude, longitude: s.longitude }}
          title={s.name}
          description="Tap to open in Google Maps"
          onCalloutPress={() => void Linking.openURL(googleMapsPlaceUrl(s))}
        />
      ))}
    </MapView>
  );
}
