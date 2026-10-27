import type { AuthUser } from './account-types';
import { request } from './client';

/** Log in / sign up / connect with Alpaca (OAuth): the server does the trip to Alpaca and back. */
export const alpacaAuthApi = {
  /** Whether it's set up on the server, and a sign-up waiting for its email (its account number). */
  status: () => request<{ enabled: boolean; pending: string | null }>('/api/v1/auth/alpaca'),
  /** The email step of a sign-up with Alpaca. */
  complete: (email: string, acceptTerms: boolean) =>
    request<{ user: AuthUser }>('/api/v1/auth/alpaca/complete', {
      method: 'POST',
      body: JSON.stringify({ email, acceptTerms }),
    }),
};

/** Leaves for Alpaca's sign-in (login), or to add another account (connect). */
export const goToAlpaca = (mode: 'login' | 'connect') => {
  window.location.href = `/api/v1/auth/alpaca/start?mode=${mode}`;
};
