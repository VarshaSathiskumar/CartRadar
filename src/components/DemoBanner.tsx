import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { disableDemo } from '../services/demo';
import { useAppState } from '../services/store';
import { useTheme } from './theme';

/** Strip under the top bar while demo mode is on: says the data is mock and turns it off (clearing the demo data). */
export function DemoBanner() {
  const t = useTheme();
  const { state } = useAppState();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!state.settings.demoMode) return null;

  const turnOff = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await disableDemo();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View accessibilityRole="alert" style={[s.bar, { backgroundColor: t.warnBg, borderBottomColor: t.warn }]}>
      <View style={[s.badge, { backgroundColor: t.warn }]}>
        <Text style={{ color: t.warnBg, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>DEMO</Text>
      </View>
      <Text numberOfLines={1} style={{ flex: 1, color: t.text, fontSize: 13, fontWeight: '600' }}>
        {failed ? 'Could not turn off. Try again.' : busy ? 'Clearing demo data...' : 'Showing mock data'}
      </Text>
      {busy ? (
        <ActivityIndicator color={t.warn} />
      ) : (
        <Switch
          accessibilityLabel="Demo mode"
          value
          onValueChange={() => void turnOff()}
          trackColor={{ true: t.warn }}
          style={{ transform: [{ scale: 0.85 }] }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  badge: { borderRadius: 6, paddingVertical: 3, paddingHorizontal: 7 },
});
