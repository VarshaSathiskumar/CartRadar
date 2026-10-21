import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

const TIMEOUT_MS = 60_000;

/**
 * Calls a Supabase Edge Function as the signed-in user (the session token is attached automatically).
 * Failures come back as an Error whose message is the one the function sent, ready to show in the UI.
 */
export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  if (!supabase) throw new Error('Sign-in is not set up, so Bee sync is unavailable');
  const { data, error } = await supabase.functions.invoke<T>(name, { body: body as Record<string, unknown>, timeout: TIMEOUT_MS });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response;
      const sent = (await res.json().catch(() => undefined)) as { error?: string } | undefined;
      throw new Error(sent?.error ?? `${name} failed (${res.status})`);
    }
    throw new Error(`Could not reach ${name}: ${error.message}`);
  }
  return data as T;
}
