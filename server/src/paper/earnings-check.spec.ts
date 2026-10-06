import type { CycleDeps, EarningsResult } from './deployment-events.js';
import type { Deployment, StagedBuy } from './deployment.types.js';
import { earningsGate, readReport, watchEarnings } from './earnings-check.js';
import { emptyLedger } from './sleeve-ledger.js';

const at = (iso: string) => new Date(iso);
const broker = (positions: Record<string, number> = {}) => {
  const ledger = emptyLedger(1000);
  for (const [symbol, qty] of Object.entries(positions))
    ledger.positions[symbol] = { symbol, qty, avgPrice: 100 };
  return {
    name: 'Aggressive · $1,000',
    status: 'active',
    source: { kind: 'broker' },
    ledgers: [ledger],
    events: [],
  } as unknown as Deployment;
};
const deps = (o: {
  next?: string | null;
  last?: EarningsResult | null;
  ai?: { avoid: boolean; reason: string } | null;
}) => {
  const notify = vi.fn(async () => undefined);
  const d = {
    nextEarnings: async () => o.next ?? null,
    lastEarnings: async () => o.last ?? null,
    aiEarningsCheck: async () => o.ai ?? null,
    recentNews: async () => [],
    notify,
  } as unknown as CycleDeps;
  return { d, notify };
};
const miss: EarningsResult = {
  date: '2026-10-20',
  reportedEps: 0.8,
  estimatedEps: 1,
  surprisePct: -20,
};

describe('earnings: a buy waits for the report', () => {
  const buy = (): StagedBuy => ({
    symbol: 'AAA',
    qty: 1,
    signalAt: at('2026-10-17'),
  });

  it('waits when the report is a few days away, and logs it once', async () => {
    const d = broker();
    const b = buy();
    const { d: dd } = deps({ next: '2026-10-20' });
    expect(await earningsGate(d, dd, b, at('2026-10-18T13:00Z'))).toBe('wait');
    expect(await earningsGate(d, dd, b, at('2026-10-19T13:00Z'))).toBe('wait');
    expect(b.waitFor).toBe('2026-10-20');
    expect(d.events).toHaveLength(1);
  });

  it('goes when the report is far away', async () => {
    const { d } = deps({ next: '2026-11-30' });
    expect(
      await earningsGate(broker(), d, buy(), at('2026-10-18T13:00Z')),
    ).toBe('go');
  });

  it('after the report: skips a bad one (and keeps the stock out), buys after a fine one', async () => {
    const waited = { ...buy(), waitFor: '2026-10-20' };
    const bad = broker();
    const r = await earningsGate(
      bad,
      deps({
        last: miss,
        ai: { avoid: true, reason: 'missed and cut its forecast' },
      }).d,
      waited,
      at('2026-10-21T13:00Z'),
    );
    expect(r).toEqual({
      skip: expect.stringMatching(/missed and cut its forecast/),
    });
    expect(bad.noBuyUntil?.AAA).toBeDefined();
    const fine = await earningsGate(
      broker(),
      deps({ last: miss, ai: { avoid: false, reason: 'beat, forecast kept' } })
        .d,
      { ...waited },
      at('2026-10-21T13:00Z'),
    );
    expect(fine).toBe('go');
  });

  it('leaves research deployments alone', async () => {
    const d = { ...broker(), source: { kind: 'research' } } as Deployment;
    expect(
      await earningsGate(
        d,
        deps({ next: '2026-10-19' }).d,
        buy(),
        at('2026-10-18'),
      ),
    ).toBe('go');
  });
});

describe('earnings: reading a report', () => {
  it('waits for the numbers for up to 2 days, then reads the headlines alone', async () => {
    const old = { ...miss, date: '2026-07-20' };
    const { d } = deps({ last: old, ai: { avoid: false, reason: 'fine' } });
    expect(
      await readReport(d, 'AAA', '2026-10-20', at('2026-10-21T01:00Z')),
    ).toBeNull();
    expect(
      await readReport(d, 'AAA', '2026-10-20', at('2026-10-23T01:00Z')),
    ).toMatchObject({
      avoid: false,
    });
  });

  it('without the AI, only a clear miss counts', async () => {
    const { d } = deps({ last: miss });
    expect(
      (await readReport(d, 'AAA', '2026-10-20', at('2026-10-21T01:00Z')))
        ?.avoid,
    ).toBe(true);
    const small = deps({ last: { ...miss, surprisePct: -3 } }).d;
    expect(
      (await readReport(small, 'AAA', '2026-10-20', at('2026-10-21T01:00Z')))
        ?.avoid,
    ).toBe(false);
  });
});

describe('earnings: held stocks', () => {
  it('learns the date, then after the report sells on a bad one, once, and tells you', async () => {
    const d = broker({ AAA: 2 });
    const { d: dd, notify } = deps({
      next: '2026-10-20',
      last: miss,
      ai: { avoid: true, reason: 'clear miss, forecast lowered' },
    });
    expect(await watchEarnings(d, dd, at('2026-10-19T13:00Z'))).toEqual([]); // learns the date
    expect(await watchEarnings(d, dd, at('2026-10-20T15:00Z'))).toEqual([]); // not out yet
    const sells = await watchEarnings(d, dd, at('2026-10-21T01:00Z'));
    expect(sells).toEqual([
      { sleeve: 0, symbol: 'AAA', qty: 2, why: 'a bad earnings report' },
    ]);
    expect(notify).toHaveBeenCalledWith(
      expect.stringMatching(/clear miss, forecast lowered/),
    );
    expect(d.noBuyUntil?.AAA).toBeDefined();
    expect(await watchEarnings(d, dd, at('2026-10-21T02:00Z'))).toEqual([]); // read once
  });

  it('keeps a stock after a fine report, quietly', async () => {
    const d = broker({ AAA: 2 });
    const { d: dd, notify } = deps({
      next: '2026-10-20',
      last: { ...miss, surprisePct: 8 },
      ai: { avoid: false, reason: 'beat, forecast raised' },
    });
    await watchEarnings(d, dd, at('2026-10-19T13:00Z'));
    expect(await watchEarnings(d, dd, at('2026-10-21T01:00Z'))).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
    expect(d.events.at(-1)?.message).toMatch(/beat, forecast raised/);
  });
});
