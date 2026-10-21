import { useState } from 'react';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { syncFromBee } from '../bee/sync';
import { useSyncStatus } from '../bee/syncStatus';
import { useAuth } from '../components/AuthProvider';
import { useTheme } from '../components/theme';
import { Button, Card, Muted, Screen, SectionTitle, Toggle } from '../components/ui';
import { updateSettings } from '../core/listLogic';
import { disableDemo, enableDemo } from '../services/demo';
import { mutate, useAppState } from '../services/store';
import { useWebReminders } from '../services/webReminders';

export default function SettingsScreen() {
  const t = useTheme();
  const { state } = useAppState();
  const { user, signOut } = useAuth();
  const { settings, stores } = state;

  const sync = useSyncStatus();
  const webReminders = useWebReminders();
  const [demo, setDemo] = useState<{ busy: boolean; message?: string }>({ busy: false });

  const patch = (p: Parameters<typeof updateSettings>[1]) => mutate((s) => updateSettings(s, p));

  // Progress and errors show in the status line below, which every sync (manual or automatic) updates.
  const syncNow = (full: boolean) => void syncFromBee({ full }).catch(() => undefined);
  const syncing = sync.phase === 'syncing';

  // Demo mode fills the profile with mock conversations (and saves them like real data); turning it off clears them again.
  const toggleDemo = async (on: boolean) => {
    if (demo.busy) return;
    setDemo({ busy: true });
    try {
      if (on) {
        const r = await enableDemo();
        setDemo({
          busy: false,
          message: `Added ${r.items} items from ${r.conversations} conversations.${r.usedModel ? '' : ' The extraction service was not reachable, so a simpler reader was used and fewer items were found.'}`,
        });
      } else {
        await disableDemo();
        setDemo({ busy: false, message: 'Demo data removed.' });
      }
    } catch (e) {
      setDemo({ busy: false, message: e instanceof Error ? e.message : 'Demo mode failed' });
    }
  };

  return (
    <Screen title="Settings">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {user && (
          <>
            <SectionTitle>Account</SectionTitle>
            <Card>
              {user.name && <Text style={[styles.label, { color: t.text }]}>{user.name}</Text>}
              <Muted style={{ marginBottom: 10 }}>{user.email}</Muted>
              <Button label="Sign out" kind="secondary" onPress={() => void signOut()} />
            </Card>
          </>
        )}

        <SectionTitle>Bee wearable</SectionTitle>
        <Card>
          <Text style={[styles.label, { color: t.text }]}>Synced through your CartRadar server</Text>
          <Muted style={{ marginBottom: 10 }}>
            {state.lastSyncAt ? `Last synced ${new Date(state.lastSyncAt).toLocaleString()}.` : 'Not synced yet.'} Pull down on the list to sync too.
          </Muted>
          <View style={styles.rowGap}>
            <Button label={syncing ? 'Syncing...' : 'Sync now'} onPress={() => syncNow(false)} disabled={syncing} />
            <Button label="Re-scan recent conversations" kind="secondary" onPress={() => syncNow(true)} disabled={syncing} />
          </View>
          {sync.phase === 'done' && <Muted style={{ marginTop: 8 }}>{sync.message}</Muted>}
          {sync.phase === 'error' && <Text style={{ color: t.danger, marginTop: 8, fontSize: 13 }}>Sync failed: {sync.message}</Text>}
        </Card>
        <Card>
          <Toggle
            title="Demo mode"
            description="Fills your list, cart queue and history with mock conversations that the model reads like real ones. Turn it off to clear them."
            value={settings.demoMode}
            onChange={(v) => void toggleDemo(v)}
          />
          {demo.busy && <Muted style={{ marginTop: 8 }}>{settings.demoMode ? 'Clearing demo data...' : 'Reading the mock conversations...'}</Muted>}
          {!demo.busy && demo.message && <Muted style={{ marginTop: 8 }}>{demo.message}</Muted>}
        </Card>

        <SectionTitle>Location</SectionTitle>
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/location')}>
          <Card style={styles.linkRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: t.text }]}>Zip code and stores</Text>
              <Muted>
                {stores.length
                  ? `${settings.zip ? `Near ${settings.zip}` : 'Near your current location'} · ${stores.filter((st) => st.enabled).length} of ${stores.length} stores on`
                  : 'Not set up yet'}
              </Muted>
            </View>
            <Text style={{ color: t.muted, fontSize: 22 }}>›</Text>
          </Card>
        </Pressable>

        <SectionTitle>Reminders</SectionTitle>
        <Card>
          <Toggle
            title="Remind me near a store"
            description="A notification listing what’s on your list when you arrive."
            value={settings.remindersEnabled}
            onChange={(v) => void patch({ remindersEnabled: v })}
          />
          {Platform.OS === 'web' && settings.remindersEnabled && (
            <Muted style={{ marginTop: 8 }}>
              {webReminders.status === 'tracking' && 'Checking your location while this page is open. You will see a reminder within 5 miles of a saved store.'}
              {webReminders.status === 'denied' && 'Location is blocked. Allow it for this site in your browser settings (iPhone: Settings, Safari, Location), then reload.'}
              {webReminders.status === 'unavailable' && 'This browser cannot share your location.'}
              {webReminders.status === 'off' && 'Waiting for location permission. Reminders only appear while this page is open.'}
            </Muted>
          )}
        </Card>

        <SectionTitle>Items I didn’t buy</SectionTitle>
        <Card>
          <Toggle
            title="Send leftovers to my cart"
            description={
              settings.leftoversToCart
                ? `When you leave a store with items left, you get a notification asking whether to move them to your Cart queue, where you can order them from Amazon Fresh.`
                : 'When you leave a store, anything not checked off stays on your list for the next trip.'
            }
            value={settings.leftoversToCart}
            onChange={(v) => void patch({ leftoversToCart: v })}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  rowGap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
