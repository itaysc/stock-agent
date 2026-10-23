import { AccountContext } from './account-context.js';
import { fakeAccount } from './testing.js';

describe('AccountContext', () => {
  it('keeps each run in its own account, across awaits', async () => {
    const seen: string[] = [];
    const job = async (ms: number) => {
      await new Promise((r) => setTimeout(r, ms));
      seen.push(AccountContext.id());
    };
    await Promise.all([
      AccountContext.run(fakeAccount('A'), () => job(10)),
      AccountContext.run(fakeAccount('B'), () => job(1)),
    ]);
    expect(seen).toEqual(['B', 'A']);
  });

  it('refuses account work outside any account', () => {
    expect(AccountContext.maybe()).toBeUndefined();
    expect(() => AccountContext.id()).toThrow(/No Alpaca account/);
  });
});
