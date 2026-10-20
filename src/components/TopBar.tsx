import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './theme';

/** Greeting on the left, tappable location chip on the right (opens the Location settings). */
export function TopBar({ name, subtitle, location }: { name: string; subtitle: string; location: string }) {
  const t = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: t.card, borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth }}>
      <View style={s.row}>
        <View style={[s.avatar, { backgroundColor: t.accent }]}>
          <Text style={{ color: t.accentText, fontWeight: '800', fontSize: 16 }}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={s.greeting}>
          <Text numberOfLines={1} style={[s.hi, { color: t.text }]}>
            Hi, {name}
          </Text>
          <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12 }}>
            {subtitle}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Location: ${location}. Open location settings`}
          onPress={() => router.navigate('/location')}
          style={({ pressed }) => [s.chip, { borderColor: t.border, backgroundColor: t.bg, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={{ fontSize: 13 }}>📍</Text>
          <Text numberOfLines={1} style={{ color: t.text, fontSize: 13, fontWeight: '600', maxWidth: 110 }}>
            {location}
          </Text>
          <Text style={{ color: t.muted, fontSize: 14 }}>›</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  greeting: { flex: 1 },
  hi: { fontSize: 18, fontWeight: '800' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
});
