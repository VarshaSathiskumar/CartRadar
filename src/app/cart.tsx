import { useState } from 'react';
import { FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../components/theme';
import { Button, Card, Muted, Screen } from '../components/ui';
import { AMAZON_CART_URL, AMAZON_FRESH_LABEL, amazonFreshUrl } from '../core/amazon';
import { clearQueued, orderQueuedItem, queuedItems, requeueToList } from '../core/listLogic';
import type { ListItem } from '../core/types';
import { mutate, useAppState } from '../services/store';

/** One pass through the queue: the items waiting when it started, and which one the user is on. */
interface Run {
  ids: string[];
  pos: number;
}

export default function CartScreen() {
  const t = useTheme();
  const { state } = useAppState();
  const queued = queuedItems(state.items);
  const [run, setRun] = useState<Run | undefined>();
  const [error, setError] = useState<string | undefined>();

  const itemAt = (r: Run, pos: number): ListItem | undefined => state.items.find((i) => i.id === r.ids[pos] && i.status === 'queued');

  const open = (item: ListItem) => {
    setError(undefined);
    Linking.openURL(amazonFreshUrl(item)).catch(() => setError(`Couldn’t open ${AMAZON_FRESH_LABEL}. Check that a browser or the app is available.`));
  };

  /** Moves to the next item that is still queued and opens it; past the end, the run is over. */
  const goTo = (r: Run, from: number) => {
    let pos = from;
    while (pos < r.ids.length && !itemAt(r, pos)) pos += 1;
    setRun({ ...r, pos });
    const item = pos < r.ids.length ? itemAt(r, pos) : undefined;
    if (item) open(item);
  };

  const start = () => {
    const r = { ids: queued.map((i) => i.id), pos: 0 };
    goTo(r, 0);
  };

  const current = run && run.pos < run.ids.length ? itemAt(run, run.pos) : undefined;
  const finished = !!run && run.pos >= run.ids.length;
  const added = () => {
    if (!run || !current) return;
    void mutate((s) => orderQueuedItem(s, current.id, Date.now()));
    goTo(run, run.pos + 1);
  };

  return (
    <Screen title="Cart queue" right={queued.length ? <Button label="All done" kind="secondary" onPress={() => void mutate((s) => clearQueued(s, Date.now()))} /> : undefined}>
      <FlatList
        data={queued}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={
          <View>
            {queued.length > 0 && !run && (
              <Card>
                <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', marginBottom: 4 }}>Order on {AMAZON_FRESH_LABEL}</Text>
                <Muted style={{ marginBottom: 10 }}>
                  Amazon doesn’t let apps fill your cart, so we open {AMAZON_FRESH_LABEL} to each item in turn. Add it, come back, and tap Next.
                </Muted>
                <Button label={`Start with ${queued.length} ${queued.length === 1 ? 'item' : 'items'}`} onPress={start} />
              </Card>
            )}

            {run && current && (
              <Card>
                <Muted>
                  Item {Math.min(run.pos + 1, run.ids.length)} of {run.ids.length}
                </Muted>
                <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', marginVertical: 4 }}>
                  {current.quantity ? `${current.quantity} ` : ''}
                  {current.name}
                </Text>
                <Muted style={{ marginBottom: 10 }}>Add it to your {AMAZON_FRESH_LABEL} cart, then come back here.</Muted>
                <View style={styles.actions}>
                  <Button label="Added, next item" onPress={added} />
                  <Button label={`Open ${AMAZON_FRESH_LABEL} again`} kind="secondary" onPress={() => open(current)} />
                  <Button label="Skip" kind="secondary" onPress={() => goTo(run, run.pos + 1)} />
                  <Button label="Stop" kind="secondary" onPress={() => setRun(undefined)} />
                </View>
                {error && <Text style={{ color: t.danger, fontSize: 13, marginTop: 8 }}>{error}</Text>}
              </Card>
            )}

            {finished && (
              <Card>
                <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
                  {queued.length ? 'Done with this round' : 'Everything is in your cart'}
                </Text>
                <Muted style={{ marginBottom: 10 }}>
                  {queued.length ? `${queued.length} skipped ${queued.length === 1 ? 'item is' : 'items are'} still in the queue.` : 'Review it and check out on Amazon.'}
                </Muted>
                <View style={styles.actions}>
                  <Button label="Open my Amazon cart" onPress={() => void Linking.openURL(AMAZON_CART_URL)} />
                  <Button label="Close" kind="secondary" onPress={() => setRun(undefined)} />
                </View>
              </Card>
            )}

            {queued.length > 0 && (
              <Muted style={{ marginHorizontal: 20, marginBottom: 10 }}>
                Or tap one item to open it in {AMAZON_FRESH_LABEL} yourself.
              </Muted>
            )}
          </View>
        }
        ListEmptyComponent={
          finished ? undefined : (
            <Card>
              <Text style={{ color: t.text, fontWeight: '700', marginBottom: 4 }}>Queue is empty</Text>
              <Muted>
                With “Send leftovers to my cart” turned on in Settings, you’ll get a notification when you leave a store with
                items left. Tap “Move to cart” and they land here. You can also swipe an item left on your list.
              </Muted>
            </Card>
          )
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
            <Button label={`Open in ${AMAZON_FRESH_LABEL}`} onPress={() => open(item)} />
          </Card>
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { gap: 8 },
});
