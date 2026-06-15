import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { api, setSession } from './api';

export type User = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
};

type Status = 'loading' | 'signedIn' | 'signedOut';

type AuthValue = {
  status: Status;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const STORE_KEY = 'reunitepets.session';
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  // Restore a saved session on launch.
  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setSession({ token: saved.token, cookieName: saved.cookieName });
          setUser(saved.user);
          setStatus('signedIn');
          return;
        }
      } catch {
        // fall through to signed-out
      }
      setStatus('signedOut');
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await api.post('/api/mobile/auth/login', { email, password });
    const saved = { token: data.token, cookieName: data.cookieName, user: data.user };
    setSession({ token: saved.token, cookieName: saved.cookieName });
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(saved));
    setUser(saved.user);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    setSession(null);
    setUser(null);
    await SecureStore.deleteItemAsync(STORE_KEY);
    setStatus('signedOut');
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
