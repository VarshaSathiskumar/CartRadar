import { describe, expect, it } from 'vitest';
import { amazonFreshUrl } from './amazon';

describe('amazonFreshUrl', () => {
  it('searches Amazon Fresh for the item, with its quantity when there is one', () => {
    expect(amazonFreshUrl({ name: 'eggs' })).toBe('https://www.amazon.com/s?k=eggs&i=amazonfresh');
    expect(amazonFreshUrl({ name: 'eggs', quantity: '2 dozen' })).toBe('https://www.amazon.com/s?k=2%20dozen%20eggs&i=amazonfresh');
  });

  it('escapes characters that would break the link', () => {
    expect(amazonFreshUrl({ name: 'mac & cheese' })).toBe('https://www.amazon.com/s?k=mac%20%26%20cheese&i=amazonfresh');
  });
});
