import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/theme';
import { Button, Card, Chip, Muted, SectionTitle, Toggle } from '../components/ui';
import { setStores, toggleStore, updateSettings } from '../core/listLogic';
import type { Store } from '../core/types';
import { syncGeofences, type GeofenceStatus } from '../services/geofence';
import { requestNotificationPermission } from '../services/notifications';
import { mutate, useAppState } from '../services/store';
import { findGroceryStores, geocodeZip } from '../services/stores';

const RADII = [150, 250, 500];

const statusMessage: Record<GeofenceStatus, string> = {
  active: 'Watching for stores',
  'no-stores': 'No stores selected',
  'foreground-denied': 'Location permission denied. Enable it in system settings.',
  'background-denied': 'Choose “Always” for location so reminders work when the app is closed.',
};

export default function LocationScreen() {
  const t = useTheme();
  const { state } = useAppState();
  const { settings, stores } = state;

  const [zip, setZip] = useState(settings.zip);
  const [busy, setBusy] = useState<'zip' | 'gps' | undefined>();
  const [geoStatus, setGeoStatus] = useState<GeofenceStatus | undefined>();

  // Region monitoring only exists on phones, so the browser skips notifications and geofences.
  const refreshGeofences = async () => {
    if (Platform.OS !== 'web') setGeoStatus(await syncGeofences());
  };

  const apply = async (centre: { latitude: number; longitude: number }, zipValue: string, found: Store[]) => {
    await mutate((s) => setStores(updateSettings(s, { zip: zipValue, centre: zipValue ? centre : undefined }), found));
    if (Platform.OS !== 'web') await requestNotificationPermission();
    await refreshGeofences();
  };

  const run = async (kind: 'zip' | 'gps', fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Couldn’t set up stores', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(undefined);
    }
  };

  const findByZip = () =>
    run('zip', async () => {
      const centre = await geocodeZip(zip);
      const found = await findGroceryStores(centre);
      if (found.length === 0) throw new Error('No grocery stores found near that zip code');
      await apply(centre, zip.trim(), found);
    });

  const findHere = () =>
    run('gps', async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Location permission was denied');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const centre = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      const found = await findGroceryStores(centre);
      if (found.length === 0) throw new Error('No grocery stores found near you');
      setZip('');
      await apply(centre, '', found);
    });

  const patch = (p: Parameters<typeof updateSettings>[1]) => mutate((s) => updateSettings(s, p));

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: t.bg }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/settings')} hitSlop={10}>
          <Text style={{ color: t.accent, fontSize: 17, fontWeight: '600' }}>‹ Settings</Text>
        </Pressable>
        <Text style={[styles.title, { color: t.text }]}>Location</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <SectionTitle>Search area</SectionTitle>
        <Card>
          <Muted style={{ marginBottom: 10 }}>
            {settings.zip ? `Showing stores near ${settings.zip}.` : stores.length ? 'Showing stores near your current location.' : 'Choose where to look for grocery stores.'}
          </Muted>
          <TextInput
            value={zip}
            onChangeText={setZip}
            placeholder="Zip code"
            placeholderTextColor={t.muted}
            keyboardType="number-pad"
            maxLength={5}
            style={[styles.input, { color: t.text, borderColor: t.border }]}
          />
          <View style={styles.rowGap}>
            <Button label={busy === 'zip' ? 'Searching…' : 'Find stores by zip'} onPress={() => void findByZip()} disabled={!!busy || zip.length !== 5} />
            <Button label={busy === 'gps' ? 'Locating…' : 'Use my current location'} kind="secondary" onPress={() => void findHere()} disabled={!!busy} />
          </View>
          {geoStatus && <Muted style={{ marginTop: 8 }}>{statusMessage[geoStatus]}</Muted>}
        </Card>

        <SectionTitle>Nearby stores</SectionTitle>
        {stores.length === 0 && (
          <Card>
            <Muted>No stores yet. Search by zip code or use your current location.</Muted>
          </Card>
        )}
        {stores.map((st) => (
          <Card key={st.id}>
            <Toggle title={st.name} value={st.enabled} onChange={() => void mutate((s) => toggleStore(s, st.id)).then(refreshGeofences)} />
          </Card>
        ))}

        {stores.length > 0 && (
          <>
            <SectionTitle>Remind me within</SectionTitle>
            <Card>
              <View style={styles.rowGap}>
                {RADII.map((r) => (
                  <Chip key={r} label={`${r} m`} selected={settings.geofenceRadiusM === r} onPress={() => void patch({ geofenceRadiusM: r }).then(refreshGeofences)} />
                ))}
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 6 },
  title: { fontSize: 28, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 16, marginBottom: 10 },
  rowGap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
