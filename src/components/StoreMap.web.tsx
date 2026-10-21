import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createElement, useEffect, useRef } from 'react';
import { googleMapsPlaceUrl } from '../core/geo';
import type { StoreMapProps } from './StoreMap';

/** Space kept clear at the bottom so markers are not hidden behind the list sheet. */
const SHEET_PADDING_PX = 280;

/** Popup for a store pin: the name is a link that opens the store in Google Maps. Built with DOM nodes so store names are never read as HTML. */
function storePopup(store: StoreMapProps['stores'][number]): HTMLElement {
  const box = document.createElement('div');
  const link = document.createElement('a');
  link.href = googleMapsPlaceUrl(store);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = store.name;
  link.style.cssText = 'font-weight:700;font-size:14px;color:#1F8A4C;text-decoration:underline;';
  box.appendChild(link);
  const hint = document.createElement('div');
  hint.textContent = store.address ? `${store.address}` : 'Open in Google Maps';
  hint.style.cssText = 'font-size:12px;color:#666;margin-top:2px;';
  box.appendChild(hint);
  return box;
}

export function StoreMap({ user, stores, userLabel }: StoreMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false }).setView([39.5, -98.35], 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group) return;
    group.clearLayers();
    const points: L.LatLngTuple[] = [];

    if (user) {
      const p: L.LatLngTuple = [user.latitude, user.longitude];
      L.circleMarker(p, { radius: 9, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).bindTooltip(userLabel ?? 'You are here').addTo(group);
      points.push(p);
    }
    for (const s of stores) {
      const p: L.LatLngTuple = [s.latitude, s.longitude];
      L.marker(p, {
        icon: L.divIcon({
          className: '',
          iconSize: [30, 30],
          html: '<div style="width:30px;height:30px;border-radius:15px;background:#1F8A4C;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 1px 4px rgba(0,0,0,.35)">🛒</div>',
        }),
      })
        .bindPopup(storePopup(s))
        .addTo(group);
      points.push(p);
    }
    if (points.length) m.fitBounds(L.latLngBounds(points), { maxZoom: 15, padding: [40, 40], paddingBottomRight: [40, SHEET_PADDING_PX] });
  }, [user?.latitude, user?.longitude, userLabel, stores]);

  return createElement('div', { ref: el, style: { position: 'absolute', inset: 0, zIndex: 0, isolation: 'isolate' } });
}
