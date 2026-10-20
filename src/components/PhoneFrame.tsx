import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useTheme } from './theme';

/** On the web the app is shown as a phone-sized screen centred in the window. Native renders it as is. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const t = useTheme();
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={[s.backdrop, { backgroundColor: t.border }]}>
      <View style={[s.phone, { backgroundColor: t.bg, borderColor: t.text }]}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  phone: {
    width: '100%',
    maxWidth: 400,
    height: '100%',
    maxHeight: 860,
    borderRadius: 36,
    borderWidth: 8,
    overflow: 'hidden',
  },
});
