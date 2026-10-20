import { describe, expect, it } from 'vitest';
import { buildAddress } from './address';

describe('buildAddress', () => {
  it('joins the tags that exist', () => {
    expect(buildAddress({ 'addr:housenumber': '123', 'addr:street': 'Main St', 'addr:city': 'Golden', 'addr:state': 'CO', 'addr:postcode': '80401' })).toBe('123 Main St, Golden, CO 80401');
    expect(buildAddress({ 'addr:street': 'Main St', 'addr:city': 'Golden' })).toBe('Main St, Golden');
  });

  it('returns undefined when OpenStreetMap has no address', () => {
    expect(buildAddress({ name: 'Kroger' })).toBeUndefined();
    expect(buildAddress()).toBeUndefined();
  });
});
