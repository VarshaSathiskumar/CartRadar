import * as Crypto from 'expo-crypto';
import { useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { syncFromBee } from '../bee/sync';
import { useSyncStatus } from '../bee/syncStatus';
import { useTheme } from '../components/theme';
import { useAuth } from '../components/AuthProvider';
import { BottomSheet } from '../components/BottomSheet';
import { StoreMap } from '../components/StoreMap';
import { SwipeableRow, useJustDragged } from '../components/SwipeableRow';
import { TopBar } from '../components/TopBar';
import { Button, Card, Muted, SectionTitle } from '../components/ui';
import { extractItems } from '../core/extractor';
import { finishTrip, groupHistoryByDay, makeItem, openItems, queueItems, removeItem, requeueToList, toggleBought } from '../core/listLogic';
import { AMAZON_FRESH_LABEL } from '../core/amazon';
import type { ListItem } from '../core/types';
import { useNearbyStores, useUserLocation } from '../services/location';
import { mutate, useAppState } from '../services/store';

export default function ListScreen() {
  const t = useTheme();
  const { state } = useAppState();
  const [draft, setDraft] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const sync = useSyncStatus();
  const [moved, setMoved] = useState<ListItem | undefined>();
  const movedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Swiping an item left sends it to the Cart queue; the notice below the input lets the user take it back.
  const moveToQueue = (item: ListItem) => {
    void mutate((s) => queueItems(s, [item.id], Date.now()));
    setMoved(item);
    clearTimeout(movedTimer.current);
    movedTimer.current = setTimeout(() => setMoved(undefined), 10_000);
  };
  const undoMove = () => {
    if (!moved) return;
    void mutate((s) => requeueToList(s, moved.id));
    clearTimeout(movedTimer.current);
    setMoved(undefined);
  };

  const open = openItems(state.items);
  const bought = state.items.filter((i) => i.status === 'bought');
  const days = groupHistoryByDay(state.history);

  const { user } = useAuth();
  const { coords, status: locationStatus } = useUserLocation();
  // Device-based lookup only until a zip is chosen; after that the map belongs to the zip area.
  const usingDevice = !state.settings.zip && !state.settings.centre;
  const nearby = useNearbyStores(state.stores.length || !usingDevice ? undefined : coords);
  // Stores switched off in Location settings stay saved but are not shown on the map.
  // Memoised because the map redraws and re-fits itself whenever this array changes.
  const mapStores = useMemo(() => (state.stores.length ? state.stores : usingDevice ? nearby : []).filter((st) => st.enabled), [state.stores, usingDevice, nearby]);
  // A zip code from Location settings moves the map there instead of to the device position.
  // Settings saved before the centre was stored fall back to the middle of the saved stores.
  const zipCentre =
    state.settings.centre ??
    (state.settings.zip && state.stores.length
      ? {
          latitude: state.stores.reduce((sum, st) => sum + st.latitude, 0) / state.stores.length,
          longitude: state.stores.reduce((sum, st) => sum + st.longitude, 0) / state.stores.length,
        }
      : undefined);
  const mapCentre = zipCentre ?? coords;
  const given = (user?.name ?? user?.email.split('@')[0])?.split(/\s+/)[0];
  const firstName = given ? given.replace(/^./, (c) => c.toUpperCase()) : undefined;
  const locationLabel =
    state.settings.zip || (locationStatus === 'ready' ? 'Current location' : locationStatus === 'loading' ? 'Locating...' : 'Set location');
  const toBuy = open.length;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await syncFromBee();
    } catch {
      // The error is shown under the input (Alert.alert does nothing in the browser).
    } finally {
      setRefreshing(false);
    }
  };

  const addManual = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    // Reuse the extractor's quantity parsing ("2 dozen eggs"); fall back to the raw text.
    const parsed = extractItems(`add ${text} to the list`)[0];
    void mutate((s) => {
      if (s.items.some((i) => i.status !== 'bought' && i.canonical === (parsed?.canonical ?? text.toLowerCase()))) return s;
      const item = makeItem(Crypto.randomUUID(), { name: parsed?.name ?? text, quantity: parsed?.quantity, heardText: undefined }, 'manual', Date.now());
      return { ...s, items: [...s.items, item] };
    });
  };

  const endTrip = () => {
    const where = state.settings.leftoversToCart ? `your ${AMAZON_FRESH_LABEL} cart queue` : 'your next list';
    const message = `${open.length} unchecked ${open.length === 1 ? 'item moves' : 'items move'} to ${where}.`;
    const finish = () => void mutate((s) => finishTrip(s, Date.now()).state);
    // Alert.alert does nothing in the browser, so the web build asks with the browser's own dialog.
    if (Platform.OS === 'web') {
      if (window.confirm(`Finish trip? ${message}`)) finish();
      return;
    }
    Alert.alert('Finish trip?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', onPress: finish },
    ]);
  };

  return (
    <View style={styles.root}>
      <TopBar name={firstName} subtitle={toBuy ? `${toBuy} ${toBuy === 1 ? 'item' : 'items'} to buy` : 'Nothing to buy yet'} location={locationLabel} />
      <View style={styles.mapArea}>
        <StoreMap user={mapCentre} stores={mapStores} userLabel={zipCentre ? 'Search area' : 'You are here'} />

        <BottomSheet>
          <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={[styles.inputRow, { borderColor: t.border, backgroundColor: t.card }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={addManual}
                placeholder="Add an item"
                placeholderTextColor={t.muted}
                returnKeyType="done"
                style={[styles.input, { color: t.text }]}
              />
              <Button label="Add" onPress={addManual} disabled={!draft.trim()} />
            </View>

            {sync.phase === 'syncing' && (
              <View style={styles.notice}>
                <Muted style={{ flex: 1 }}>Syncing with Bee...</Muted>
              </View>
            )}
            {sync.phase === 'error' && (
              <View style={styles.notice}>
                <Text style={{ flex: 1, color: t.danger, fontSize: 13 }}>Bee sync failed: {sync.message}</Text>
                <Pressable accessibilityRole="button" onPress={() => void refresh()} hitSlop={8}>
                  <Text style={{ color: t.accent, fontWeight: '700' }}>Retry</Text>
                </Pressable>
              </View>
            )}

            {moved && (
            <View style={styles.notice}>
              <Muted style={{ flex: 1 }}>Moved {moved.name} to the cart queue.</Muted>
              <Pressable accessibilityRole="button" onPress={undoMove} hitSlop={8}>
                <Text style={{ color: t.accent, fontWeight: '700' }}>Undo</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.todayRow}>
              <SectionTitle>Today</SectionTitle>
              {state.items.length > 0 && (
                <View style={{ marginRight: 16 }}>
                  <Button label="Finish trip" kind="secondary" onPress={endTrip} />
                </View>
              )}
            </View>
            {open.length === 0 && bought.length === 0 && (
              <Card>
                <Text style={{ color: t.text, fontWeight: '700', marginBottom: 4 }}>Nothing to buy yet</Text>
                <Muted>
                  Items appear here when you say things like “we’re out of eggs” near your Bee. Pull down to check for new
                  conversations, or turn on demo mode in Settings to try it without a device.
                </Muted>
              </Card>
            )}
            {open.map((item) => (
              <SwipeableRow key={item.id} label="Move to cart" onSwipeLeft={() => moveToQueue(item)}>
              <Row flat item={item} onToggle={() => void mutate((s) => toggleBought(s, item.id, Date.now()))} onRemove={() => void mutate((s) => removeItem(s, item.id))} />
            </SwipeableRow>
            ))}
            {bought.length > 0 && <SectionTitle>Got it</SectionTitle>}
            {bought.map((item) => (
              <Row key={item.id} item={item} onToggle={() => void mutate((s) => toggleBought(s, item.id, Date.now()))} onRemove={() => void mutate((s) => removeItem(s, item.id))} />
            ))}

            {days.map((day) => (
              <View key={day.dayStart}>
                <SectionTitle>{dayLabel(day.dayStart)}</SectionTitle>
                {day.items.map((item) => (
                  <Card key={item.id} style={styles.row}>
                    <Text style={{ color: t.accent, fontWeight: '800' }}>✓</Text>
                    <Text style={{ color: t.muted, fontSize: 16, flex: 1 }}>
                      {item.quantity ? `${item.quantity} ` : ''}
                      {item.name}
                    </Text>
                  </Card>
                ))}
              </View>
            ))}
          </ScrollView>
        </BottomSheet>
      </View>
    </View>
  );
}

const dayLabel = (dayStart: number): string => {
  const today = new Date().setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - dayStart) / 86_400_000);
  if (diffDays === 1) return 'Yesterday';
  return new Date(dayStart).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

function Row({ item, onToggle, onRemove, flat }: { item: ListItem; onToggle: () => void; onRemove: () => void; flat?: boolean }) {
  const t = useTheme();
  const justDragged = useJustDragged();
  const done = item.status === 'bought';
  return (
    <Card style={flat ? { ...styles.row, marginHorizontal: 0, marginBottom: 0 } : styles.row}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} onPress={() => !justDragged.current && onToggle()} style={styles.rowMain}>
        <View style={[styles.box, { borderColor: done ? t.accent : t.border, backgroundColor: done ? t.accent : 'transparent' }]}>
          {done && <Text style={{ color: t.accentText, fontWeight: '800' }}>✓</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '600', textDecorationLine: done ? 'line-through' : 'none', opacity: done ? 0.55 : 1 }}>
            {item.quantity ? `${item.quantity} ` : ''}
            {item.name}
          </Text>
          {item.carriedOver > 0 && !done && (
            <Text style={{ color: t.warn, fontSize: 12, fontWeight: '700' }}>
              Carried over{item.carriedOver > 1 ? ` ×${item.carriedOver}` : ''}
            </Text>
          )}
          {item.heardText && <Muted>“{item.heardText}”</Muted>}
        </View>
      </Pressable>
      <Pressable accessibilityLabel={`Remove ${item.name}`} onPress={onRemove} hitSlop={10}>
        <Text style={{ color: t.muted, fontSize: 20 }}>×</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mapArea: { flex: 1 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginBottom: 4 },
  todayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 8 },
  input: { flex: 1, fontSize: 16, paddingHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
