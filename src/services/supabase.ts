import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

/**
 * The anon key is public by design: what a user can read or change is limited by the
 * row level security policies in supabase/migrations, not by hiding the key.
 */
export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        // The session JSON is bigger than SecureStore's value limit, so it lives in AsyncStorage.
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/** Without a Supabase project configured the app skips login and keeps everything on the device. */
export const supabaseEnabled = supabase !== null;
