import * as Notifications from 'expo-notifications';
import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syncFromBee } from '../bee/sync';
import { queuedItems } from '../core/listLogic';
import { useTheme } from '../components/theme';
import { registerBackgroundSync } from '../services/background';
import '../services/geofence'; // registers the geofence task with the OS
import { configureNotifications } from '../services/notifications';
import { loadState, useAppState } from '../services/store';

configureNotifications();

const icon = (glyph: string) => () => <Text style={{ fontSize: 20 }}>{glyph}</Text>;

export default function RootLayout() {
  const t = useTheme();
  const { state } = useAppState();
  const queued = queuedItems(state.items).length;

  useEffect(() => {
    void loadState().then(() => {
      void registerBackgroundSync().catch(() => undefined);
      void syncFromBee().catch(() => undefined);
    });
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      void loadState().then(() => syncFromBee().catch(() => undefined));
    });
    const tap = Notifications.addNotificationResponseReceivedListener((r) => {
      const screen = r.notification.request.content.data?.screen;
      router.navigate(screen === 'cart' ? '/cart' : '/');
    });
    return () => {
      sub.remove();
      tap.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: t.accent,
          tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'List', tabBarIcon: icon('🛒') }} />
        <Tabs.Screen
          name="cart"
          options={{ title: 'Cart queue', tabBarIcon: icon('📦'), tabBarBadge: queued > 0 ? queued : undefined }}
        />
        <Tabs.Screen name="heard" options={{ title: 'Heard', tabBarIcon: icon('👂') }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙️') }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
