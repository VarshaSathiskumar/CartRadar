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

/** Public Overpass servers, tried in order; each one is often at capacity, so none is relied on alone. */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const OVERPASS_TIMEOUT_MS = 15_000;

async function queryOverpass(query: string): Promise<OverpassElement[]> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (res.ok) return ((await res.json()) as { elements: OverpassElement[] }).elements;
    } catch {
      // timed out or unreachable: try the next server
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('The store search service is busy right now. Try again in a minute.');
}

/** Finds grocery stores near a point using OpenStreetMap data (no API key needed). */
export async function findGroceryStores(centre: { latitude: number; longitude: number }, radiusM = 5000): Promise<Store[]> {
  const q = `[out:json][timeout:25];(nwr["shop"~"^(supermarket|grocery|wholesale)$"](around:${radiusM},${centre.latitude},${centre.longitude}););out center 60;`;
  const elements = await queryOverpass(q);

  const stores: Store[] = [];
  for (const el of elements) {
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
