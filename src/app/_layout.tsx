import * as Notifications from 'expo-notifications';
import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syncFromBee } from '../bee/sync';
import { AuthProvider, useAuth } from '../components/AuthProvider';
import { PhoneFrame } from '../components/PhoneFrame';
import { queuedItems } from '../core/listLogic';
import { useTheme } from '../components/theme';
import { registerBackgroundSync } from '../services/background';
import '../services/geofence'; // registers the geofence task with the OS
import { configureNotifications } from '../services/notifications';
import { loadState, useAppState } from '../services/store';

configureNotifications();

const icon = (glyph: string) => () => <Text style={{ fontSize: 20 }}>{glyph}</Text>;

export default function RootLayout() {
  return (
    <AuthProvider>
      <PhoneFrame>
        <AppTabs />
      </PhoneFrame>
    </AuthProvider>
  );
}

function AppTabs() {
  const t = useTheme();
  const { status } = useAuth();
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

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: t.accent,
          tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        }}
      >
        <Tabs.Protected guard={status === 'signedIn'}>
          <Tabs.Screen name="index" options={{ title: 'List', tabBarIcon: icon('🛒') }} />
          <Tabs.Screen
            name="cart"
            options={{ title: 'Cart queue', tabBarIcon: icon('📦'), tabBarBadge: queued > 0 ? queued : undefined }}
          />
          <Tabs.Screen name="heard" options={{ title: 'Heard', tabBarIcon: icon('👂') }} />
          <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙️') }} />
          {/* Reachable from Settings and the top bar; `href: null` would redirect away from it, so only the tab button is hidden. */}
          <Tabs.Screen name="location" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        </Tabs.Protected>
        <Tabs.Protected guard={status === 'signedOut'}>
          <Tabs.Screen name="login" options={{ title: 'Sign in', tabBarStyle: { display: 'none' } }} />
        </Tabs.Protected>
      </Tabs>
    </SafeAreaProvider>
  );
}
