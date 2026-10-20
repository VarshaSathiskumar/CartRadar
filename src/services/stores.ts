import * as Location from 'expo-location';
import { buildAddress } from '../core/address';
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
  tags?: Record<string, string | undefined>;
}

/** Public Overpass servers, tried in order; each one is often at capacity, so none is relied on alone. */
const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const OVERPASS_TIMEOUT_MS = 8_000;

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
  throw new Error('Overpass is unavailable');
}

interface NominatimPlace {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  address?: Record<string, string | undefined>;
}

/** Backup source when Overpass is down: OpenStreetMap's own search, which also returns addresses. */
async function queryNominatim(centre: { latitude: number; longitude: number }): Promise<Store[]> {
  const d = 0.07; // about 8 km each way
  const viewbox = [centre.longitude - d, centre.latitude + d, centre.longitude + d, centre.latitude - d].join(',');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=supermarket&format=jsonv2&addressdetails=1&limit=40&bounded=1&viewbox=${viewbox}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const places = (await res.json()) as NominatimPlace[];
    return places.flatMap((p) => {
      if (!p.name) return [];
      const a = p.address ?? {};
      const address = buildAddress({
        'addr:housenumber': a.house_number,
        'addr:street': a.road,
        'addr:city': a.city ?? a.town ?? a.village ?? a.hamlet,
        'addr:state': a.state,
        'addr:postcode': a.postcode,
      });
      return [{ id: `${p.osm_type}/${p.osm_id}`, name: p.name, address, latitude: Number(p.lat), longitude: Number(p.lon), enabled: true }];
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Finds grocery stores near a point using OpenStreetMap data (no API key needed). */
export async function findGroceryStores(centre: { latitude: number; longitude: number }, radiusM = 5000): Promise<Store[]> {
  const q = `[out:json][timeout:25];(nwr["shop"~"^(supermarket|grocery|wholesale)$"](around:${radiusM},${centre.latitude},${centre.longitude}););out center 60;`;

  let stores: Store[] = [];
  try {
    for (const el of await queryOverpass(q)) {
      const latitude = el.lat ?? el.center?.lat;
      const longitude = el.lon ?? el.center?.lon;
      const name = el.tags?.name;
      if (latitude === undefined || longitude === undefined || !name) continue;
      stores.push({ id: `${el.type}/${el.id}`, name, address: buildAddress(el.tags), latitude, longitude, enabled: true });
    }
  } catch {
    try {
      stores = await queryNominatim(centre);
    } catch {
      throw new Error('The store search service is busy right now. Try again in a minute.');
    }
  }
  return stores
    .sort((a, b) => distanceMeters(centre, a) - distanceMeters(centre, b))
    .slice(0, MAX_STORES);
}
