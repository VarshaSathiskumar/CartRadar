import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { supabase, supabaseEnabled } from './supabase';

export interface User {
  id: string;
  name: string | null;
  email: string;
}

export const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
/** The Google button needs a web client id and a browser; phones are not supported yet. */
export const googleSignInAvailable = Platform.OS === 'web' && !!googleWebClientId;

/** Without Supabase configured the app skips the login screen. */
export const authEnabled = supabaseEnabled;

function client() {
  if (!supabase) throw new Error('Sign-in is not set up');
  return supabase;
}

function toUser(u: SupabaseUser): User {
  const meta = u.user_metadata as { name?: string; full_name?: string } | undefined;
  return { id: u.id, name: meta?.name ?? meta?.full_name ?? null, email: u.email ?? '' };
}

/** Trades the ID token from Google's button for a Supabase session; Supabase checks it with Google. */
export async function signInWithGoogle(idToken: string): Promise<User> {
  const { data, error } = await client().auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error || !data.user) throw new Error(error?.message ?? 'Google sign-in failed');
  return toUser(data.user);
}

/** The signed-in user for the stored session, or null when there is none or it has expired. */
export async function restoreSession(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ? toUser(data.session.user) : null;
}

/** Calls back when the session ends outside a sign-out button (expired or revoked). */
export function onSessionEnded(listener: () => void): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') listener();
  });
  return () => data.subscription.unsubscribe();
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut().catch(() => undefined);
}
