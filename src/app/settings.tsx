import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { syncFromBee } from '../bee/sync';
import { useAuth } from '../components/AuthProvider';
import { useTheme } from '../components/theme';
import { Button, Card, Chip, Muted, Screen, SectionTitle, Toggle } from '../components/ui';
import { updateSettings } from '../core/listLogic';
import type { CartProviderId } from '../core/types';
import { CART_PROVIDERS } from '../services/cart';
import { clearBeeToken, getBeeToken, setBeeToken } from '../services/secrets';
import { mutate, useAppState } from '../services/store';

export default function SettingsScreen() {
  const t = useTheme();
  const { state } = useAppState();
  const { user, signOut } = useAuth();
  const { settings, stores } = state;

  const [token, setToken] = useState('');
  const [rescan, setRescan] = useState<{ busy: boolean; message?: string }>({ busy: false });
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    void getBeeToken().then((v) => setHasToken(!!v));
  }, []);

  const patch = (p: Parameters<typeof updateSettings>[1]) => mutate((s) => updateSettings(s, p));

  // Forgets which lines were already read so the current extractor re-reads recent conversations.
  const rescanConversations = async () => {
    setRescan({ busy: true });
    try {
      await mutate((s) => ({ ...s, seenUtteranceIds: [] }));
      const r = await syncFromBee();
      setRescan({ busy: false, message: r.added.length ? `Added ${r.added.map((i) => i.name).join(', ')}.` : `Read ${r.processed} lines, nothing new to add.` });
    } catch (e) {
      setRescan({ busy: false, message: e instanceof Error ? e.message : 'Re-scan failed' });
    }
  };

  const saveToken = async () => {
    if (!token.trim()) return;
    await setBeeToken(token);
    setToken('');
    setHasToken(true);
    try {
      const r = await syncFromBee();
      Alert.alert('Connected', `Checked ${r.processed} new lines of conversation.`);
    } catch (e) {
      Alert.alert('Saved, but Bee didn’t respond', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  return (
    <Screen title="Settings">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {user && (
          <>
            <SectionTitle>Account</SectionTitle>
            <Card>
              {user.name && <Text style={[styles.label, { color: t.text }]}>{user.name}</Text>}
              <Muted>{user.email}</Muted>
              <Muted style={{ marginBottom: 10 }}>{user.mobile}</Muted>
              <Button label="Sign out" kind="secondary" onPress={() => void signOut()} />
            </Card>
          </>
        )}

        <SectionTitle>Bee wearable</SectionTitle>
        <Card>
          <Text style={[styles.label, { color: t.text }]}>{hasToken || process.env.EXPO_PUBLIC_BEE_PROXY_URL ? 'Connected' : 'Not connected'}</Text>
          <TextInput
            value={token}
            onChangeText={setToken}
            placeholder={hasToken ? 'Paste a new access token to replace' : 'Paste your Bee access token'}
            placeholderTextColor={t.muted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={[styles.input, { color: t.text, borderColor: t.border }]}
          />
          <View style={styles.rowGap}>
            <Button label="Save token" onPress={() => void saveToken()} disabled={!token.trim()} />
            {hasToken && (
              <Button
                label="Disconnect"
                kind="secondary"
                onPress={() => void clearBeeToken().then(() => setHasToken(false))}
              />
            )}
          </View>
          <View style={{ marginTop: 10 }}>
            <Button label={rescan.busy ? 'Re-scanning…' : 'Re-scan recent conversations'} kind="secondary" onPress={() => void rescanConversations()} disabled={rescan.busy} />
            {rescan.message && <Muted style={{ marginTop: 6 }}>{rescan.message}</Muted>}
          </View>
        </Card>
        <Card>
          <Toggle
            title="Demo mode"
            description="Feeds a scripted conversation instead of reading from Bee, so you can try the whole flow."
            value={settings.demoMode}
            onChange={(v) => void patch({ demoMode: v })}
          />
        </Card>

        <SectionTitle>Location</SectionTitle>
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/location')}>
          <Card style={styles.linkRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: t.text }]}>Zip code and stores</Text>
              <Muted>
                {stores.length
                  ? `${settings.zip ? `Near ${settings.zip}` : 'Near your current location'} · ${stores.filter((st) => st.enabled).length} of ${stores.length} stores on`
                  : 'Not set up yet'}
              </Muted>
            </View>
            <Text style={{ color: t.muted, fontSize: 22 }}>›</Text>
          </Card>
        </Pressable>

        <SectionTitle>Reminders</SectionTitle>
        <Card>
          <Toggle
            title="Remind me near a store"
            description="A notification listing what’s on your list when you arrive."
            value={settings.remindersEnabled}
            onChange={(v) => void patch({ remindersEnabled: v })}
          />
        </Card>

        <SectionTitle>Items I didn’t buy</SectionTitle>
        <Card>
          <Toggle
            title="Send leftovers to my cart"
            description={
              settings.leftoversToCart
                ? `When you leave a store, anything not checked off goes to your Cart queue so you can order it from ${CART_PROVIDERS[settings.cartProvider].label}.`
                : 'When you leave a store, anything not checked off stays on your list for the next trip.'
            }
            value={settings.leftoversToCart}
            onChange={(v) => void patch({ leftoversToCart: v })}
          />
          {settings.leftoversToCart && (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.label, { color: t.text }]}>Shopping app</Text>
              <View style={styles.rowGap}>
                {(Object.keys(CART_PROVIDERS) as CartProviderId[]).map((id) => (
                  <Chip key={id} label={CART_PROVIDERS[id].label} selected={settings.cartProvider === id} onPress={() => void patch({ cartProvider: id })} />
                ))}
              </View>
            </View>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 16, marginBottom: 10 },
  rowGap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
