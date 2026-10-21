import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dismissWebReminder, useWebReminders } from '../services/webReminders';
import { useTheme } from './theme';

/** In-app reminder cards for stores the user has just arrived at. Web only: phones use system notifications. */
export function ReminderBanner() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { reminders } = useWebReminders();
  if (Platform.OS !== 'web' || reminders.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[s.wrap, { top: insets.top + 8 }]}>
      {reminders.map((r) => (
        <View key={r.key} accessibilityRole="alert" style={[s.card, { backgroundColor: t.card, borderColor: t.accent }]}>
          <Pressable style={{ flex: 1 }} onPress={() => { dismissWebReminder(r.key); router.navigate('/'); }}>
            <Text style={{ color: t.text, fontWeight: '800', fontSize: 15 }}>{r.title}</Text>
            <Text style={{ color: t.muted, fontSize: 14, marginTop: 2 }}>{r.body}</Text>
          </Pressable>
          <Pressable accessibilityLabel="Dismiss reminder" hitSlop={10} onPress={() => dismissWebReminder(r.key)}>
            <Text style={{ color: t.muted, fontSize: 22 }}>×</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 100, gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
});
