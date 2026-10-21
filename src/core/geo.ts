export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const metersToMiles = (m: number): number => m / 1609.344;

/** Closest and farthest a reminder distance can be: tighter than this and GPS drift misses the store, wider and it fires from across town. */
export const MIN_REMINDER_MILES = 0.1;
export const MAX_REMINDER_MILES = 5;

/** The distance a user typed, in miles, as whole metres; undefined when it is not a number in range. */
export function parseReminderMiles(text: string): number | undefined {
  const miles = Number(text.trim());
  if (!text.trim() || !Number.isFinite(miles) || miles < MIN_REMINDER_MILES || miles > MAX_REMINDER_MILES) return undefined;
  return Math.round(miles * 1609.344);
}

/** Miles for an input box: at most two decimals, no trailing zeros. */
export const milesText = (meters: number): string => String(Number(metersToMiles(meters).toFixed(2)));

/** "0.4 mi" under ten miles, whole miles beyond. */
export function formatMiles(meters: number): string {
  const mi = metersToMiles(meters);
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}

/** Opens Google Maps directions to a point; Google fills in the traveller's own location as the start. */
export function googleMapsDirectionsUrl(to: { latitude: number; longitude: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.latitude},${to.longitude}`;
}

/** Opens a store on Google Maps: by name and address when known (so the listing shows), otherwise by its coordinates. */
export function googleMapsPlaceUrl(store: { name: string; address?: string; latitude: number; longitude: number }): string {
  const query = store.address ? `${store.name}, ${store.address}` : `${store.latitude},${store.longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
