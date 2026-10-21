import { describe, expect, it } from 'vitest';
import { distanceMeters, formatMiles, googleMapsDirectionsUrl, metersToMiles, milesText, parseReminderMiles } from './geo';

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

describe('reminder distance in miles', () => {
  it('converts what the user typed to whole metres', () => {
    expect(parseReminderMiles('1')).toBe(1609);
    expect(parseReminderMiles(' 0.5 ')).toBe(805);
    expect(parseReminderMiles('0.1')).toBe(161);
  });

  it('rejects empty, non-numeric and out-of-range input', () => {
    for (const bad of ['', '  ', 'abc', '0', '0.05', '5.1', '-1', 'Infinity']) expect(parseReminderMiles(bad)).toBeUndefined();
    expect(parseReminderMiles('5')).toBe(8047);
  });

  it('shows stored metres as short miles text', () => {
    expect(milesText(250)).toBe('0.16');
    expect(milesText(1609)).toBe('1');
    expect(milesText(805)).toBe('0.5');
  });
});
