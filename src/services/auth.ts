import { deleteSecret, getSecret, setSecret } from './secureStorage';

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL;
const TOKEN_KEY = 'cartradar.session';

export interface User {
  id: string;
  name: string | null;
  mobile: string;
  email: string;
}

/** Without an auth service configured the app skips the login screen. */
export const authEnabled = !!AUTH_URL;

const storage = {
  get: () => getSecret(TOKEN_KEY),
  set: (v: string) => setSecret(TOKEN_KEY, v),
  clear: () => deleteSecret(TOKEN_KEY),
};

async function call<T>(path: string, init: { body?: object; token?: string | null } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${AUTH_URL}${path}`, {
      method: init.body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new Error('Could not reach the login service');
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

export const requestCode = (mobile: string, email: string) => call<{ ok: true }>('/auth/request-code', { body: { mobile, email } });

export async function verifyCode(details: { mobile: string; email: string; code: string; name?: string }): Promise<User> {
  const { token, user } = await call<{ token: string; user: User }>('/auth/verify', { body: details });
  await storage.set(token);
  return user;
}

/** The signed-in user for the stored session, or null when there is none or it has expired. */
export async function restoreSession(): Promise<User | null> {
  const token = await storage.get();
  if (!token) return null;
  try {
    return (await call<{ user: User }>('/auth/me', { token })).user;
  } catch {
    await storage.clear();
    return null;
  }
}

export async function signOut(): Promise<void> {
  const token = await storage.get();
  await storage.clear();
  if (token) await call('/auth/logout', { body: {}, token }).catch(() => undefined);
}
