import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authEnabled, restoreSession, signOut as signOutRequest, type User } from '../services/auth';

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
  }, []);

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
