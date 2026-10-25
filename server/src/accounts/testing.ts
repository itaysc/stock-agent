import type { Alpaca } from '@alpacahq/alpaca-trade-api';
import { AccountContext, type ActiveAccount } from './account-context.js';

/** A paper account for unit tests (its client is whatever the test passes). */
export const fakeAccount = (
  id: string,
  client: unknown = {},
): ActiveAccount => ({
  id,
  name: id,
  paper: true,
  owner: '',
  auth: 'key',
  keyHint: '0000',
  client: client as Alpaca,
});

/** Runs `fn` as account `id` (unit tests of account-scoped code). */
export const asAccount = <T>(id: string, fn: () => T): T =>
  AccountContext.run(fakeAccount(id), fn);

/** `target` with every property read and method call run as `account` (as an API request does). */
export function inAccount<T extends object>(
  target: T,
  account: ActiveAccount = fakeAccount('PA1'),
): T {
  const run = <R>(fn: () => R) => AccountContext.run(account, fn);
  return new Proxy(target, {
    get: (t, key) =>
      run(() => {
        const value: unknown = Reflect.get(t, key);
        return typeof value === 'function'
          ? (...args: unknown[]) =>
              run(() => (value as (...a: unknown[]) => unknown).apply(t, args))
          : value;
      }),
  });
}
