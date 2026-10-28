import type { Alpaca } from '@alpacahq/alpaca-trade-api';
import { ConflictException } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

/** An Alpaca account the app works with (added on the Accounts page). */
export interface ActiveAccount {
  /** Alpaca's account number (e.g. PA3G0TALD8D7): the same account keeps its data when its key changes. */
  id: string;
  name: string;
  paper: boolean;
  /** The user's email (lowercase) who added it. */
  owner: string;
  /**
   * key: an API key and secret; oauth: connected with Log in with Alpaca (no
   * streams); sim: a Bullwether paper account (simulated by the app, no streams).
   */
  auth: 'key' | 'oauth' | 'sim';
  /** The key's last 4 characters, to tell keys apart (the key itself is never shown). */
  keyHint: string;
  client: Alpaca;
}

const storage = new AsyncLocalStorage<ActiveAccount>();

/**
 * The account the current request or job works on. Every API request runs in
 * the account the app sends (X-Account-Id), and every background job once per
 * account, so Alpaca calls and saved records always belong to one account.
 */
export const AccountContext = {
  run<T>(account: ActiveAccount, fn: () => T): T {
    return storage.run(account, fn);
  },

  /** The current account, if any. */
  maybe(): ActiveAccount | undefined {
    return storage.getStore();
  },

  current(): ActiveAccount {
    const account = storage.getStore();
    if (!account)
      throw new ConflictException(
        'No Alpaca account: add one on the Accounts page',
      );
    return account;
  },

  id(): string {
    return AccountContext.current().id;
  },
};
