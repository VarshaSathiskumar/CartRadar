import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { syncFromBee } from '../bee/sync';
import { useTheme } from '../components/theme';
import { Button, Card, Muted, Screen, SectionTitle } from '../components/ui';
import { extractItems } from '../core/extractor';
import { finishTrip, makeItem, openItems, removeItem, toggleBought } from '../core/listLogic';
import type { ListItem } from '../core/types';
import { CART_PROVIDERS } from '../services/cart';
import { mutate, useAppState } from '../services/store';

export default function ListScreen() {
  const t = useTheme();
  const { state } = useAppState();
  const [draft, setDraft] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const open = openItems(state.items);
  const bought = state.items.filter((i) => i.status === 'bought');
  const rows: (ListItem | string)[] = [...open, ...(bought.length ? ['Got it', ...bought] : [])];

  const refresh = async () => {
    setRefreshing(true);
    try {
      await syncFromBee();
    } catch (e) {
      Alert.alert("Couldn't reach Bee", e instanceof Error ? e.message : 'Unknown error');
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
    const where = state.settings.leftoversToCart ? `your ${CART_PROVIDERS[state.settings.cartProvider].label} cart queue` : 'your next list';
    Alert.alert('Finish trip?', `${open.length} unchecked ${open.length === 1 ? 'item moves' : 'items move'} to ${where}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', onPress: () => void mutate((s) => finishTrip(s, Date.now()).state) },
    ]);
  };

  return (
    <Screen title="Shopping list" right={state.items.length ? <Button label="Finish trip" kind="secondary" onPress={endTrip} /> : undefined}>
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

      <FlatList
        data={rows}
        keyExtractor={(r) => (typeof r === 'string' ? r : r.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          <Card>
            <Text style={{ color: t.text, fontWeight: '700', marginBottom: 4 }}>Nothing to buy yet</Text>
            <Muted>
              Items appear here when you say things like “we’re out of eggs” near your Bee. Pull down to check for new
              conversations, or turn on demo mode in Settings to try it without a device.
            </Muted>
          </Card>
        }
        renderItem={({ item }) =>
          typeof item === 'string' ? (
            <SectionTitle>{item}</SectionTitle>
          ) : (
            <Row item={item} onToggle={() => void mutate((s) => toggleBought(s, item.id, Date.now()))} onRemove={() => void mutate((s) => removeItem(s, item.id))} />
          )
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </Screen>
  );
}

function Row({ item, onToggle, onRemove }: { item: ListItem; onToggle: () => void; onRemove: () => void }) {
  const t = useTheme();
  const done = item.status === 'bought';
  return (
    <Card style={styles.row}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} onPress={onToggle} style={styles.rowMain}>
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
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 8 },
  input: { flex: 1, fontSize: 16, paddingHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
