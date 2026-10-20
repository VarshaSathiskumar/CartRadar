import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './theme';

export function Screen({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  const t = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[s.screen, { backgroundColor: t.bg }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: t.text }]}>{title}</Text>
        {right}
      </View>
      {children}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[s.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={[s.section, { color: t.muted }]}>{children.toUpperCase()}</Text>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  const t = useTheme();
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: primary ? t.accent : 'transparent', borderColor: primary ? t.accent : t.border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[s.buttonText, { color: primary ? t.accentText : t.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, { borderColor: selected ? t.accent : t.border, backgroundColor: selected ? t.accent : 'transparent' }]}
    >
      <Text style={{ color: selected ? t.accentText : t.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  const t = useTheme();
  return <Text style={[{ color: t.muted, fontSize: 13, lineHeight: 18 }, style]}>{children}</Text>;
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, marginHorizontal: 16, marginBottom: 10 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginHorizontal: 20, marginTop: 14, marginBottom: 8 },
  button: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '700' },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
});
