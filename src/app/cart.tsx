import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../components/theme';
import { Button, Card, Muted, Screen } from '../components/ui';
import { clearQueued, queuedItems, requeueToList } from '../core/listLogic';
import { CART_PROVIDERS, openInCart } from '../services/cart';
import { mutate, useAppState } from '../services/store';

export default function CartScreen() {
  const t = useTheme();
  const { state } = useAppState();
  const queued = queuedItems(state.items);
  const provider = state.settings.cartProvider;
  const label = CART_PROVIDERS[provider].label;

  const open = (item: (typeof queued)[number]) =>
    openInCart(provider, item).catch(() => Alert.alert(`Couldn't open ${label}`, 'Check that a browser or the app is available.'));

  return (
    <Screen title="Cart queue" right={queued.length ? <Button label="All done" kind="secondary" onPress={() => void mutate((s) => clearQueued(s, Date.now()))} /> : undefined}>
      <FlatList
        data={queued}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={
          queued.length ? (
            <Muted style={{ marginHorizontal: 20, marginBottom: 10 }}>
              Items you didn’t pick up. Tap one to find it in {label}, then add it to your cart there.
            </Muted>
          ) : undefined
        }
        ListEmptyComponent={
          <Card>
            <Text style={{ color: t.text, fontWeight: '700', marginBottom: 4 }}>Queue is empty</Text>
            <Muted>
              With “Send leftovers to my cart” turned on in Settings, anything you don’t check off by the time you leave a
              store lands here.
            </Muted>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>
                {item.quantity ? `${item.quantity} ` : ''}
                {item.name}
              </Text>
              <Text onPress={() => void mutate((s) => requeueToList(s, item.id))} style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>
                Move back to list
              </Text>
            </View>
            <Button label={`Open in ${label}`} onPress={() => void open(item)} />
          </Card>
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 10 } });
