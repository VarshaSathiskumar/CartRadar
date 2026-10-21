import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');
export type NotificationResponse = import('expo-notifications').NotificationResponse;

/**
 * expo-notifications throws while loading when a native piece is missing (the SDK 58 Expo Go on Android
 * lacks one of them). Load it lazily so the rest of the app keeps running without notifications.
 */
function load(): NotificationsModule | undefined {
  try {
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return undefined;
  }
}
const Notifications = load();

const CHANNEL = 'reminders';

/** Notification shown after leaving a store with items left: "Move to cart now?" with two buttons. */
export const LEFTOVERS_CATEGORY = 'leftovers';
export const MOVE_TO_CART_ACTION = 'move-to-cart';
export const KEEP_ON_LIST_ACTION = 'keep-on-list';

export function configureNotifications() {
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS !== 'web') {
    void Notifications.setNotificationCategoryAsync(LEFTOVERS_CATEGORY, [
      { identifier: MOVE_TO_CART_ACTION, buttonTitle: 'Move to cart', options: { opensAppToForeground: true } },
      { identifier: KEEP_ON_LIST_ACTION, buttonTitle: 'Keep on list', options: { opensAppToForeground: false } },
    ]).catch(() => undefined); // not every environment (e.g. Expo Go) supports categories
  }
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Grocery reminders',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => undefined);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function notifyNow(title: string, body: string, data: Record<string, unknown> = {}, categoryIdentifier?: string) {
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, categoryIdentifier },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  });
}

/** Calls `handler` when the user taps a notification or one of its buttons. Returns a function that stops listening. */
export function onNotificationResponse(handler: (response: NotificationResponse) => void): () => void {
  if (!Notifications) return () => undefined;
  const sub = Notifications.addNotificationResponseReceivedListener(handler);
  return () => sub.remove();
}
