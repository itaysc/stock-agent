import type { Alpaca } from '@alpacahq/alpaca-trade-api';
import { createMockAlpaca } from '@alpacahq/alpaca-trade-api/testing';
import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import type { Env } from '../config/env.js';
import { AccountContext } from './account-context.js';
import type { AlpacaAccountDoc } from './alpaca-account.schema.js';
import { AlpacaAccounts } from './alpaca-accounts.service.js';
import { SecretBox } from './secret-box.js';

const KEY = 'k'.repeat(40);
const box = new SecretBox(KEY);
const saved = (id: string, owner: string, keyId: string) => ({
  _id: id,
  name: `Account ${id}`,
  paper: true,
  owner,
  keyHint: keyId.slice(-4),
  keyId: box.seal(keyId),
  secret: box.seal('s'),
});

function setup(docs: Partial<AlpacaAccountDoc>[], secretKey = KEY) {
  const config = {
    get: (k: keyof Env) => ({ ACCOUNTS_SECRET_KEY: secretKey })[k as string],
  } as unknown as ConfigService<Env, true>;
  const model = {
    find: () => ({ sort: () => ({ lean: () => Promise.resolve(docs) }) }),
  } as unknown as Model<AlpacaAccountDoc>;
  const built: string[] = [];
  const factory = (keyId: string) => {
    built.push(keyId);
    return createMockAlpaca([], { retry: false }) as Alpaca;
  };
  return {
    accounts: new AlpacaAccounts(model, null, factory, config),
    built,
  };
}

describe('AlpacaAccounts', () => {
  it('loads the saved accounts with their keys decrypted', async () => {
    const { accounts, built } = setup([
      saved('PA1', 'admin@example.com', 'PKADMIN0001'),
      saved('PA9', 'dana@example.com', 'PKDANA0009'),
    ]);
    await accounts.onModuleInit();
    expect(built).toEqual(['PKADMIN0001', 'PKDANA0009']);
    expect(accounts.list()).toMatchObject([
      { id: 'PA1', owner: 'admin@example.com', keyHint: '0001' },
      { id: 'PA9', name: 'Account PA9', owner: 'dana@example.com' },
    ]);
  });

  it('shows each user their own accounts, and the admin all', async () => {
    const { accounts } = setup([
      saved('PA1', 'admin@example.com', 'PKADMIN0001'),
      saved('PA9', 'dana@example.com', 'PKDANA0009'),
    ]);
    await accounts.onModuleInit();
    const ids = (email: string, admin = false) =>
      accounts.visibleTo({ email, admin }).map((a) => a.id);
    expect(ids('dana@example.com')).toEqual(['PA9']);
    expect(ids('eve@example.com')).toEqual([]);
    expect(ids('admin@example.com', true)).toEqual(['PA1', 'PA9']);
  });

  it('skips accounts it cannot decrypt, without failing startup', async () => {
    const { accounts } = setup(
      [saved('PA1', 'admin@example.com', 'PKADMIN0001')],
      'another-secret-key-of-32-characters!!',
    );
    await expect(accounts.onModuleInit()).resolves.toBeUndefined();
    expect(accounts.list()).toEqual([]);
  });

  it('runs a job once per account, and one failure does not stop the others', async () => {
    const { accounts } = setup([
      saved('PA1', 'a@example.com', 'PKA00000001'),
      saved('PA2', 'b@example.com', 'PKB00000002'),
    ]);
    await accounts.onModuleInit();
    const ran: string[] = [];
    await accounts.forEach('test job', () => {
      ran.push(AccountContext.id());
      if (AccountContext.id() === 'PA1') throw new Error('boom');
      return Promise.resolve();
    });
    expect(ran).toEqual(['PA1', 'PA2']);
  });
});
