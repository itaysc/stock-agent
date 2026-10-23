import type { AuthUser, NewInvite, UsersView } from './account-types';
import { request } from './client';

/** Sign-up with an invite link, and the admin's users and invites. */
export const usersApi = {
  checkInvite: (token: string) =>
    request<{ ok: true }>(`/api/v1/auth/invites/${encodeURIComponent(token)}`),
  signUp: (body: { token: string; email: string; password: string }) =>
    request<{ user: AuthUser }>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  list: () => request<UsersView>('/api/v1/users'),
  invite: (note: string) =>
    request<NewInvite>('/api/v1/users/invites', { method: 'POST', body: JSON.stringify({ note }) }),
  revokeInvite: (id: string) =>
    request<null>(`/api/v1/users/invites/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  remove: (email: string) =>
    request<null>(`/api/v1/users/${encodeURIComponent(email)}`, { method: 'DELETE' }),
};

/** The sign-up link for an invite's token. */
export const inviteLink = (token: string) =>
  `${window.location.origin}/?invite=${encodeURIComponent(token)}`;
