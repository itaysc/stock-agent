import { Center, Loader } from '@mantine/core';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import type { AuthUser } from '../../api/account-types';
import { alpacaAuthApi } from '../../api/alpaca-auth-api';
import { api, AUTH_REQUIRED } from '../../api/client';
import { type GooglePending, googleAuthApi } from '../../api/google-auth-api';
import { CookieBanner } from '../../consent/CookieBanner';
import { AlpacaEmailStep } from './AlpacaEmailStep';
import { GoogleTermsStep } from './GoogleTermsStep';
import { LoginPage } from './LoginPage';
import { SignupPage } from './SignupPage';

/** The token of an invite link (/?invite=…), if the page was opened from one. */
const inviteToken = () => new URLSearchParams(window.location.search).get('invite');

interface Auth {
  /** The logged-in user (null when the server needs no login). */
  user: AuthUser | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<Auth>({ user: null, logout: async () => undefined });
export const useAuth = () => useContext(AuthContext);

/** Shows the login page while the server needs a login and nobody is logged in; the app otherwise. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'login' | 'in'>('checking');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [invite, setInvite] = useState(inviteToken);
  const [alpaca, setAlpaca] = useState<{ enabled: boolean; pending: string | null }>({
    enabled: false,
    pending: null,
  });
  const [google, setGoogle] = useState<{ enabled: boolean; pending: GooglePending | null }>({
    enabled: false,
    pending: null,
  });
  const check = useCallback(async () => {
    try {
      const off = { enabled: false, pending: null };
      const [me, alpacaStatus, googleStatus] = await Promise.all([
        api.authMe(),
        alpacaAuthApi.status().catch(() => off),
        googleAuthApi.status().catch(() => off),
      ]);
      setUser(me.user);
      setAlpaca(alpacaStatus);
      setGoogle(googleStatus);
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
  // The cookie banner: on the login screens the choice stays on this device; in the app, the user's.
  const banner = <CookieBanner key={state} loggedIn={state === 'in'} />;
  if (state === 'login' && invite)
    return withBanner(
      banner,
      <SignupPage
        token={invite}
        onDone={() => {
          // The link is used up: drop it from the address.
          window.history.replaceState(null, '', window.location.pathname);
          setInvite(null);
          void check();
        }}
      />,
    );
  // Signed up with Alpaca: their email first.
  if (state === 'login' && alpaca.pending)
    return withBanner(
      banner,
      <AlpacaEmailStep account={alpaca.pending} onDone={() => void check()} />,
    );
  // Signed up with Google: the terms first.
  if (state === 'login' && google.pending)
    return withBanner(
      banner,
      <GoogleTermsStep pending={google.pending} onDone={() => void check()} />,
    );
  if (state === 'login')
    return withBanner(
      banner,
      <LoginPage onLoggedIn={() => void check()} alpaca={alpaca.enabled} google={google.enabled} />,
    );
  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
      {banner}
    </AuthContext.Provider>
  );
}

const withBanner = (banner: ReactNode, screen: ReactNode) => (
  <>
    {screen}
    {banner}
  </>
);
