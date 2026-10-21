import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../components/AuthProvider';
import { useTheme } from '../components/theme';
import { Muted } from '../components/ui';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { googleSignInAvailable, googleWebClientId, signInWithGoogle } from '../services/auth';

export default function LoginScreen() {
  const t = useTheme();
  const { signedIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const google = async (idToken: string) => {
    setBusy(true);
    setError(undefined);
    try {
      signedIn(await signInWithGoogle(idToken));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]}>
      <View style={styles.body}>
        <Text style={styles.logo}>🛒</Text>
        <Text style={[styles.title, { color: t.text }]}>CartRadar</Text>
        <Muted style={{ textAlign: 'center', marginBottom: 24 }}>Sign in with your Google account to keep your list on every device.</Muted>

        {googleSignInAvailable ? (
          <GoogleSignInButton clientId={googleWebClientId} onIdToken={(token) => void google(token)} onError={setError} />
        ) : (
          <Muted style={{ textAlign: 'center' }}>Google sign-in is only available in the browser for now. Open the app on the web to sign in.</Muted>
        )}
        {busy && <Muted style={{ textAlign: 'center' }}>Signing in...</Muted>}
        {error && <Text style={[styles.error, { color: t.danger }]}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 10 },
  logo: { fontSize: 44, textAlign: 'center' },
  title: { fontSize: 30, fontWeight: '800', textAlign: 'center' },
  error: { textAlign: 'center', fontWeight: '600', marginTop: 6 },
});
