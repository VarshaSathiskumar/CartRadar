export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const metersToMiles = (m: number): number => m / 1609.344;

/** "0.4 mi" under ten miles, whole miles beyond. */
export function formatMiles(meters: number): string {
  const mi = metersToMiles(meters);
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}

/** Opens Google Maps directions to a point; Google fills in the traveller's own location as the start. */
export function googleMapsDirectionsUrl(to: { latitude: number; longitude: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.latitude},${to.longitude}`;
}
