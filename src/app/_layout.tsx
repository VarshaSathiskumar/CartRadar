import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syncFromBee } from '../bee/sync';
import { AuthProvider, useAuth } from '../components/AuthProvider';
import { PhoneFrame } from '../components/PhoneFrame';
import { queueItems, queuedItems } from '../core/listLogic';
import { useTheme } from '../components/theme';
import { registerBackgroundSync } from '../services/background';
import '../services/geofence'; // registers the geofence task with the OS
import { configureNotifications, KEEP_ON_LIST_ACTION, MOVE_TO_CART_ACTION, onNotificationResponse } from '../services/notifications';
import { loadState, mutate, useAppState } from '../services/store';

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
    const stopListening = onNotificationResponse((r) => {
      const data = r.notification.request.content.data;
      if (r.actionIdentifier === KEEP_ON_LIST_ACTION) return;
      if (r.actionIdentifier === MOVE_TO_CART_ACTION) {
        const ids = Array.isArray(data?.itemIds) ? data.itemIds.filter((id: unknown): id is string => typeof id === 'string') : [];
        void mutate((s) => queueItems(s, ids, Date.now())).then(() => router.navigate('/cart'));
        return;
      }
      router.navigate(data?.screen === 'cart' ? '/cart' : '/');
    });
    return () => {
      sub.remove();
      stopListening();
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
