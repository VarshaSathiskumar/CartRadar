import * as Location from 'expo-location';
import { distanceMeters } from '../core/geo';
import type { Store } from '../core/types';

/** iOS allows 20 monitored regions per app; stay well under it. */
const MAX_STORES = 15;

export async function geocodeZip(zip: string): Promise<{ latitude: number; longitude: number }> {
  const clean = zip.trim();
  if (!/^\d{5}$/.test(clean)) throw new Error('Enter a 5-digit US zip code');

  try {
    const res = await fetch(`https://api.zippopotam.us/us/${clean}`);
    if (res.ok) {
      const json = (await res.json()) as { places?: { latitude: string; longitude: string }[] };
      const p = json.places?.[0];
      if (p) return { latitude: Number(p.latitude), longitude: Number(p.longitude) };
    }
  } catch {
    // fall through to the device geocoder
  }
  const [hit] = await Location.geocodeAsync(`${clean}, USA`);
  if (!hit) throw new Error(`Couldn't find zip code ${clean}`);
  return { latitude: hit.latitude, longitude: hit.longitude };
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: { name?: string };
}

/** Finds grocery stores near a point using OpenStreetMap data (no API key needed). */
export async function findGroceryStores(centre: { latitude: number; longitude: number }, radiusM = 8000): Promise<Store[]> {
  const q = `[out:json][timeout:25];(nwr["shop"~"^(supermarket|grocery|wholesale)$"](around:${radiusM},${centre.latitude},${centre.longitude}););out center 60;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(q)}`,
  });
  if (!res.ok) throw new Error(`Store search failed (${res.status})`);
  const json = (await res.json()) as { elements: OverpassElement[] };

  const stores: Store[] = [];
  for (const el of json.elements) {
    const latitude = el.lat ?? el.center?.lat;
    const longitude = el.lon ?? el.center?.lon;
    const name = el.tags?.name;
    if (latitude === undefined || longitude === undefined || !name) continue;
    stores.push({ id: `${el.type}/${el.id}`, name, latitude, longitude, enabled: true });
  }
  return stores
    .sort((a, b) => distanceMeters(centre, a) - distanceMeters(centre, b))
    .slice(0, MAX_STORES);
}
