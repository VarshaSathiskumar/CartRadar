import type { ListItem } from './types';

export const AMAZON_FRESH_LABEL = 'Amazon Fresh';

/** Amazon has no public API to fill a Fresh cart, so each item opens a Fresh search with the quantity spoken. */
export function amazonFreshUrl(item: Pick<ListItem, 'name' | 'quantity'>): string {
  const query = item.quantity ? `${item.quantity} ${item.name}` : item.name;
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&i=amazonfresh`;
}

/** Where the user reviews and checks out whatever they added. */
export const AMAZON_CART_URL = 'https://www.amazon.com/gp/cart/view.html';
