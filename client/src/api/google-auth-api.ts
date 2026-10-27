import type { AuthUser } from './account-types';
import { request } from './client';

/** Who is waiting for the terms step of a sign-up with Google. */
export interface GooglePending {
  email: string;
  name?: string;
}

/** Continue with Google (OAuth): the server does the trip to Google and back. */
export const googleAuthApi = {
  /** Whether it's set up on the server, and a sign-up waiting for the terms. */
  status: () => request<{ enabled: boolean; pending: GooglePending | null }>('/api/v1/auth/google'),
  /** The terms step of a sign-up with Google. */
  complete: (acceptTerms: boolean) =>
    request<{ user: AuthUser }>('/api/v1/auth/google/complete', {
      method: 'POST',
      body: JSON.stringify({ acceptTerms }),
    }),
};

/** Leaves for Google's sign-in. */
export const goToGoogle = () => {
  window.location.href = '/api/v1/auth/google/start';
};
