import { Center, Loader } from '@mantine/core';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, AUTH_REQUIRED } from '../../api/client';
import { LoginPage } from './LoginPage';

interface Auth {
  /** The logged-in user (null when the server needs no login). */
  user: { email: string } | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<Auth>({ user: null, logout: async () => undefined });
export const useAuth = () => useContext(AuthContext);

/** Shows the login page while the server needs a login and nobody is logged in; the app otherwise. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'login' | 'in'>('checking');
  const [user, setUser] = useState<{ email: string } | null>(null);
  const check = useCallback(async () => {
    try {
      const me = await api.authMe();
      setUser(me.user);
      setState(me.loginRequired && !me.user ? 'login' : 'in');
    } catch {
      setState('in'); // an older server without the login, or unreachable: the app shows its own error
    }
  }, []);
  useEffect(() => {
    void check();
    const onRequired = () => setState('login');
    window.addEventListener(AUTH_REQUIRED, onRequired);
    return () => window.removeEventListener(AUTH_REQUIRED, onRequired);
  }, [check]);
  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
    setState('login');
  }, []);

  if (state === 'checking')
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  if (state === 'login') return <LoginPage onLoggedIn={() => void check()} />;
  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}
