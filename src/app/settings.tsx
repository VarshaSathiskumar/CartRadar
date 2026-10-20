import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { syncFromBee } from '../bee/sync';
import { useTheme } from '../components/theme';
import { Button, Card, Chip, Muted, Screen, SectionTitle } from '../components/ui';
import { setStores, toggleStore, updateSettings } from '../core/listLogic';
import type { CartProviderId } from '../core/types';
import { CART_PROVIDERS } from '../services/cart';
import { syncGeofences, type GeofenceStatus } from '../services/geofence';
import { requestNotificationPermission } from '../services/notifications';
import { clearBeeToken, getBeeToken, setBeeToken } from '../services/secrets';
import { mutate, useAppState } from '../services/store';
import { findGroceryStores, geocodeZip } from '../services/stores';

const RADII = [150, 250, 500];

const statusMessage: Record<GeofenceStatus, string> = {
  active: 'Watching for stores',
  'no-stores': 'No stores selected',
  'foreground-denied': 'Location permission denied. Enable it in system settings.',
  'background-denied': 'Choose “Always” for location so reminders work when the app is closed.',
};

export default function SettingsScreen() {
  const t = useTheme();
  const { state } = useAppState();
  const { settings, stores } = state;

  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [zip, setZip] = useState(settings.zip);
  const [busy, setBusy] = useState(false);
  const [geoStatus, setGeoStatus] = useState<GeofenceStatus | undefined>();

  useEffect(() => {
    void getBeeToken().then((v) => setHasToken(!!v));
  }, []);

  const patch = (p: Parameters<typeof updateSettings>[1]) => mutate((s) => updateSettings(s, p));
  const refreshGeofences = async () => setGeoStatus(await syncGeofences());

  const saveToken = async () => {
    if (!token.trim()) return;
    await setBeeToken(token);
    setToken('');
    setHasToken(true);
    try {
      const r = await syncFromBee();
      Alert.alert('Connected', `Checked ${r.processed} new lines of conversation.`);
    } catch (e) {
      Alert.alert('Saved, but Bee didn’t respond', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const findStores = async () => {
    setBusy(true);
    try {
      const centre = await geocodeZip(zip);
      const found = await findGroceryStores(centre);
      if (found.length === 0) throw new Error('No grocery stores found near that zip code');
      await mutate((s) => setStores(updateSettings(s, { zip: zip.trim() }), found));
      await requestNotificationPermission();
      await refreshGeofences();
    } catch (e) {
      Alert.alert('Couldn’t set up stores', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Settings">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <SectionTitle>Bee wearable</SectionTitle>
        <Card>
          <Text style={[styles.label, { color: t.text }]}>{hasToken ? 'Connected' : 'Not connected'}</Text>
          <TextInput
            value={token}
            onChangeText={setToken}
            placeholder={hasToken ? 'Paste a new access token to replace' : 'Paste your Bee access token'}
            placeholderTextColor={t.muted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={[styles.input, { color: t.text, borderColor: t.border }]}
          />
          <View style={styles.rowGap}>
            <Button label="Save token" onPress={() => void saveToken()} disabled={!token.trim()} />
            {hasToken && (
              <Button
                label="Disconnect"
                kind="secondary"
                onPress={() => void clearBeeToken().then(() => setHasToken(false))}
              />
            )}
          </View>
        </Card>
        <Card>
          <Toggle
            title="Demo mode"
            description="Feeds a scripted conversation instead of reading from Bee, so you can try the whole flow."
            value={settings.demoMode}
            onChange={(v) => void patch({ demoMode: v })}
          />
        </Card>

        <SectionTitle>Where you shop</SectionTitle>
        <Card>
          <TextInput
            value={zip}
            onChangeText={setZip}
            placeholder="Zip code"
            placeholderTextColor={t.muted}
            keyboardType="number-pad"
            maxLength={5}
            style={[styles.input, { color: t.text, borderColor: t.border }]}
          />
          <Button label={busy ? 'Searching…' : stores.length ? 'Refresh nearby stores' : 'Find nearby stores'} onPress={() => void findStores()} disabled={busy || zip.length !== 5} />
          {geoStatus && <Muted style={{ marginTop: 8 }}>{statusMessage[geoStatus]}</Muted>}
        </Card>
        {stores.map((st) => (
          <Card key={st.id}>
            <Toggle title={st.name} value={st.enabled} onChange={() => void mutate((s) => toggleStore(s, st.id)).then(refreshGeofences)} />
          </Card>
        ))}
        {stores.length > 0 && (
          <Card>
            <Text style={[styles.label, { color: t.text }]}>Remind me within</Text>
            <View style={styles.rowGap}>
              {RADII.map((r) => (
                <Chip key={r} label={`${r} m`} selected={settings.geofenceRadiusM === r} onPress={() => void patch({ geofenceRadiusM: r }).then(refreshGeofences)} />
              ))}
            </View>
          </Card>
        )}

        <SectionTitle>Reminders</SectionTitle>
        <Card>
          <Toggle
            title="Remind me near a store"
            description="A notification listing what’s on your list when you arrive."
            value={settings.remindersEnabled}
            onChange={(v) => void patch({ remindersEnabled: v })}
          />
        </Card>

        <SectionTitle>Items I didn’t buy</SectionTitle>
        <Card>
          <Toggle
            title="Send leftovers to my cart"
            description={
              settings.leftoversToCart
                ? `When you leave a store, anything not checked off goes to your Cart queue so you can order it from ${CART_PROVIDERS[settings.cartProvider].label}.`
                : 'When you leave a store, anything not checked off stays on your list for the next trip.'
            }
            value={settings.leftoversToCart}
            onChange={(v) => void patch({ leftoversToCart: v })}
          />
          {settings.leftoversToCart && (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.label, { color: t.text }]}>Shopping app</Text>
              <View style={styles.rowGap}>
                {(Object.keys(CART_PROVIDERS) as CartProviderId[]).map((id) => (
                  <Chip key={id} label={CART_PROVIDERS[id].label} selected={settings.cartProvider === id} onPress={() => void patch({ cartProvider: id })} />
                ))}
              </View>
            </View>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Toggle({ title, description, value, onChange }: { title: string; description?: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: t.text }]}>{title}</Text>
        {description && <Muted>{description}</Muted>}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.accent }} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 16, marginBottom: 10 },
  rowGap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
