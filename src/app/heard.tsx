import { FlatList, Text, View } from 'react-native';
import { useTheme } from '../components/theme';
import { Card, Chip, Muted, Screen } from '../components/ui';
import { useAppState } from '../services/store';

export default function HeardScreen() {
  const t = useTheme();
  const { state } = useAppState();

  return (
    <Screen title="What CartRadar heard">
      <Muted style={{ marginHorizontal: 20, marginBottom: 10 }}>
        Only phrases that added something to your list are kept (last 50). Everything else Bee hears is discarded
        on your phone immediately.
      </Muted>
      <FlatList
        data={state.heard}
        keyExtractor={(h) => h.id}
        ListEmptyComponent={
          <Card>
            <Muted>Nothing yet.</Muted>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={{ color: t.text, fontSize: 15 }}>“{item.text}”</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
              {item.found.map((f) => (
                <Chip key={f} label={`+ ${f}`} selected />
              ))}
            </View>
            <Muted>{new Date(item.at).toLocaleString()}</Muted>
          </Card>
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </Screen>
  );
}
