import { describe, expect, it } from 'vitest';
import { distanceMeters, formatMiles, googleMapsDirectionsUrl, metersToMiles } from './geo';

describe('distance helpers', () => {
  it('converts meters to miles', () => {
    expect(metersToMiles(1609.344)).toBeCloseTo(1, 5);
  });

  it('formats short distances with a decimal and long ones as whole miles', () => {
    expect(formatMiles(644)).toBe('0.4 mi');
    expect(formatMiles(24140)).toBe('15 mi');
  });

  it('measures roughly 1 degree of latitude as 69 miles', () => {
    const m = distanceMeters({ latitude: 40, longitude: -100 }, { latitude: 41, longitude: -100 });
    expect(metersToMiles(m)).toBeGreaterThan(68.5);
    expect(metersToMiles(m)).toBeLessThan(69.5);
  });
});

describe('googleMapsDirectionsUrl', () => {
  it('points at the destination coordinates', () => {
    expect(googleMapsDirectionsUrl({ latitude: 39.75, longitude: -105.22 })).toBe('https://www.google.com/maps/dir/?api=1&destination=39.75,-105.22');
  });
});
