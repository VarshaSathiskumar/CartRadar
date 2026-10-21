import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../components/AuthProvider';
import { useTheme } from '../components/theme';
import { Button, Muted } from '../components/ui';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { googleSignInAvailable, googleWebClientId, requestEmailCode, signInWithGoogle, verifyEmailCode } from '../services/auth';

export default function LoginScreen() {
  const t = useTheme();
  const { signedIn } = useAuth();
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await requestEmailCode(email);
      setCode('');
      setStep('code');
    });

  const google = (idToken: string) => run(async () => signedIn(await signInWithGoogle(idToken)));

  const verify = () => run(async () => signedIn(await verifyEmailCode({ email, code, name: name.trim() || undefined })));

  const input = [styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
        <Text style={styles.logo}>🛒</Text>
        <Text style={[styles.title, { color: t.text }]}>CartRadar</Text>
        <Muted style={{ textAlign: 'center', marginBottom: 24 }}>
          {step === 'details' ? 'Sign in with your email. We will send you a code.' : `Enter the 6-digit code we sent to ${email}.`}
        </Muted>

        {step === 'details' ? (
          <>
            <TextInput value={name} onChangeText={setName} placeholder="Your name (new accounts)" placeholderTextColor={t.muted} autoComplete="name" style={input} />
            <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={t.muted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" style={input} />
            <Button label={busy ? 'Sending...' : 'Send code'} onPress={() => void sendCode()} disabled={busy || !email.trim()} />
            {googleSignInAvailable && (
              <>
                <View style={styles.or}>
                  <View style={[styles.rule, { backgroundColor: t.border }]} />
                  <Muted>or</Muted>
                  <View style={[styles.rule, { backgroundColor: t.border }]} />
                </View>
                <GoogleSignInButton clientId={googleWebClientId} onIdToken={(token) => void google(token)} onError={setError} />
              </>
            )}
          </>
        ) : (
          <>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              placeholderTextColor={t.muted}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
              style={[...input, styles.code]}
            />
            <Button label={busy ? 'Checking...' : 'Verify and sign in'} onPress={() => void verify()} disabled={busy || code.length !== 6} />
            <View style={styles.links}>
              <Button label="Resend code" kind="secondary" onPress={() => void sendCode()} disabled={busy} />
              <Button label="Change details" kind="secondary" onPress={() => setStep('details')} disabled={busy} />
            </View>
          </>
        )}
        {error && <Text style={[styles.error, { color: t.danger }]}>{error}</Text>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 10 },
  logo: { fontSize: 44, textAlign: 'center' },
  title: { fontSize: 30, fontWeight: '800', textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
  code: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  links: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 4 },
  error: { textAlign: 'center', fontWeight: '600', marginTop: 6 },
});
