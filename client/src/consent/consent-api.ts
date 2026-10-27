import { request } from '../api/client';
import type { CookieConsent } from './cookie-consent';

/** The logged-in user's cookie choice, saved on the server. */
export const consentApi = {
  get: () => request<{ consent: CookieConsent | null }>('/api/v1/consent/cookies'),
  save: (c: { functional: boolean; policyVersion: string }) =>
    request<{ consent: CookieConsent }>('/api/v1/consent/cookies', {
      method: 'PUT',
      body: JSON.stringify(c),
    }),
};
