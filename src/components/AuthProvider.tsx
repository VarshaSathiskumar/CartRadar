import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authEnabled, onSessionEnded, restoreSession, signOut as signOutRequest, type User } from '../services/auth';
import { startCloudSync } from '../services/cloudSync';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthValue {
  status: Status;
  user: User | null;
  signedIn: (user: User) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(authEnabled ? 'loading' : 'signedIn');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!authEnabled) return;
    void restoreSession().then((u) => {
      setUser(u);
      setStatus(u ? 'signedIn' : 'signedOut');
    });
    return onSessionEnded(() => {
      setUser(null);
      setStatus('signedOut');
    });
  }, []);

  // Keeps the list, settings and stores in step with the account while signed in.
  const userId = user?.id;
  useEffect(() => (userId ? startCloudSync(userId) : undefined), [userId]);

  const signedIn = useCallback((u: User) => {
    setUser(u);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    await signOutRequest();
    setUser(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo(() => ({ status, user, signedIn, signOut }), [status, user, signedIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
