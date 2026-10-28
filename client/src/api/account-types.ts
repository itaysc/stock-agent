import type { SyncResult } from './trade-types';

/** An account the app works with: an Alpaca account (its key is never sent to the browser), or a Bullwether paper account. */
export interface Account {
  /** Alpaca's account number, e.g. PA3G0TALD8D7. */
  id: string;
  name: string;
  paper: boolean;
  /** The key's last 4 characters. */
  keyHint: string;
  /** key: added with an API key; oauth: connected with Log in with Alpaca; sim: a Bullwether paper account (virtual money). */
  auth: 'key' | 'oauth' | 'sim';
  /** Who added it (only the admin sees this). */
  owner?: string;
}

export interface AccountList {
  accounts: Account[];
  /** False until ACCOUNTS_SECRET_KEY is set on the server. */
  canAdd: boolean;
  /** Only the admin adds an account by pasting an API key; others connect with Alpaca. */
  keyAllowed: boolean;
  /** The user has no Bullwether paper account yet, and one can open. */
  canOpenPaper: boolean;
}

/** A newly added account, with what it already held (brought into the Trade page). */
export type AddedAccount = Account & { synced: SyncResult | null };

/** Who is logged in. */
export interface AuthUser {
  email: string;
  /** The admin sees every user's accounts and invites new users. */
  admin: boolean;
}

export interface UsersView {
  users: Array<{ email: string; joinedAt: string }>;
  /** Invites not used yet. */
  invites: Array<{ id: string; note: string; expiresAt: string; expired: boolean }>;
}

/** A new invite: its token is shown only once. */
export interface NewInvite {
  id: string;
  token: string;
  note: string;
  expiresAt: string;
}
