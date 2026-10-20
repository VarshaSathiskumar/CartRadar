export type ItemStatus = 'open' | 'bought' | 'queued';
export type ItemSource = 'bee' | 'manual';

export interface ListItem {
  id: string;
  name: string;
  /** Normalised name used for de-duplication ("eggs" and "egg" collide). */
  canonical: string;
  quantity?: string;
  status: ItemStatus;
  source: ItemSource;
  addedAt: number;
  /** The phrase that triggered the item, shown so the user can see why it was added. */
  heardText?: string;
  /** How many trips this item has survived without being bought. */
  carriedOver: number;
  resolvedAt?: number;
}

export interface Utterance {
  id: string;
  text: string;
  /** Epoch ms. */
  at: number;
  speaker?: string;
}

export type CartProviderId = 'amazon-fresh' | 'instacart' | 'walmart';

export interface Settings {
  zip: string;
  /** Geofence radius around each store, in metres. */
  geofenceRadiusM: number;
  /**
   * Leftover handling when a trip ends.
   * false: unbought items roll onto the next list.
   * true: unbought items are queued for the shopping app.
   */
  leftoversToCart: boolean;
  cartProvider: CartProviderId;
  remindersEnabled: boolean;
  demoMode: boolean;
}

export interface Store {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  enabled: boolean;
}

export interface HeardSnippet {
  id: string;
  text: string;
  at: number;
  /** Item names extracted from this snippet. */
  found: string[];
}

export interface PersistedState {
  items: ListItem[];
  history: ListItem[];
  settings: Settings;
  stores: Store[];
  heard: HeardSnippet[];
  seenUtteranceIds: string[];
  lastSyncAt?: number;
  /** Epoch ms of the last reminder per store, for cooldown. */
  lastNotifiedAt: Record<string, number>;
  /** Epoch ms the user entered each store they are currently inside. */
  visits: Record<string, number>;
  /** Epoch ms of the last completed trip. */
  lastTripAt?: number;
}

export const DEFAULT_SETTINGS: Settings = {
  zip: '',
  geofenceRadiusM: 250,
  leftoversToCart: false,
  cartProvider: 'amazon-fresh',
  remindersEnabled: true,
  demoMode: false,
};

export const EMPTY_STATE: PersistedState = {
  items: [],
  history: [],
  settings: DEFAULT_SETTINGS,
  stores: [],
  heard: [],
  seenUtteranceIds: [],
  lastNotifiedAt: {},
  visits: {},
};
