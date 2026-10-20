import { Linking } from 'react-native';
import type { CartProviderId, ListItem } from '../core/types';

/**
 * None of these retailers offer a public API for silently adding to a user's
 * cart, so "send to cart" opens a prefilled search for each item in the user's
 * shopping app (universal links open the app when it's installed).
 */
export const CART_PROVIDERS: Record<CartProviderId, { label: string; searchUrl: (query: string) => string }> = {
  'amazon-fresh': {
    label: 'Amazon Fresh',
    searchUrl: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}&i=amazonfresh`,
  },
  instacart: {
    label: 'Instacart',
    searchUrl: (q) => `https://www.instacart.com/store/s?k=${encodeURIComponent(q)}`,
  },
  walmart: {
    label: 'Walmart',
    searchUrl: (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}`,
  },
};

export const cartUrl = (provider: CartProviderId, item: ListItem) =>
  CART_PROVIDERS[provider].searchUrl(item.quantity ? `${item.quantity} ${item.name}` : item.name);

export const openInCart = (provider: CartProviderId, item: ListItem) => Linking.openURL(cartUrl(provider, item));
