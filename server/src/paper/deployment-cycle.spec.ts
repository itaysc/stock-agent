import { makeBars } from '../../test/support/bars.js';
import { runCycle } from './deployment-cycle.js';
import type { CycleDeps } from './deployment-events.js';
import { createRuntime } from './deployment-runtime.js';
import type { Deployment } from './deployment.types.js';
import type { OrderStatus } from './reconcile.js';
import { emptyLedger } from './sleeve-ledger.js';

// Flat, a breakout at bar 6 (12), then a fall.
const bars = makeBars(
  'AAA',
  [10, 10, 10, 10, 10, 10, 12, 13, 14, 12, 11, 10],
  '2026-01-01',
);
const dayAfter = (i: number) =>
  new Date(bars[i].timestamp.getTime() + 86_400_000);

function setup(over: Partial<Deployment> = {}) {
  const d: Deployment = {
    id: 'abcdef12-0000',
    name: 'test',
    status: 'active',
    statusReason: null,
    source: { kind: 'manual' },
    timeframe: '1Day',
    capital: 10_000,
    sleeves: [
      {
        strategy: 'rules',
        symbols: ['AAA'],
        params: { breakout: '3', trailingStop: '10', allocation: '1' },
        weightPct: 100,
      },
    ],
    ledgers: [emptyLedger(10_000)],
    maxDrawdownPct: 0,
    expectation: null,
    lastBarAt: null,
    peakEquity: 10_000,
    snapshots: [],
    events: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
  const orders: Record<string, OrderStatus> = {};
  const sent: Array<{
    clientOrderId: string;
    side: string;
    qty?: number;
    notional?: number;
  }> = [];
  let cutoff = dayAfter(5);
  let news: Array<{ headline: string; createdAt: Date }> = [];
  let opensSoon = false;
  const deps: CycleDeps = {
    fetchDaily: async (_symbols, from, to) => ({
      AAA: bars.filter((b) => b.timestamp >= from && b.timestamp < to),
    }),
    completedBefore: async () => cutoff,
    getOrder: async (id) => orders[id] ?? null,
    placeOrder: async (o) => {
      sent.push(o);
      orders[o.clientOrderId] = {
        status: 'accepted',
        filledQty: 0,
        filledAvgPrice: null,
      };
    },
    cashToBuy: async () => 1_000_000,
    nextEarnings: async () => null,
    lastEarnings: async () => null,
    aiEarningsCheck: async () => null,
    now: () => cutoff,
    recentNews: async () => news,
    aiNewsCheck: async () => null,
    opensSoon: async () => opensSoon,
    officialEvents: async () => ({ halt: null, filings: [] }),
    notify: async () => undefined,
  };
  const fill = (price: number) => {
    const last = sent.at(-1);
    if (last)
      orders[last.clientOrderId] = {
        status: 'filled',
        filledQty: last.qty ?? (last.notional ?? 0) / price,
        filledAvgPrice: price,
      };
  };
  return {
    d,
    deps,
    sent,
    fill,
    setCutoff: (i: number) => (cutoff = dayAfter(i)),
    setNews: (headlines: string[]) =>
      (news = headlines.map((headline) => ({ headline, createdAt: cutoff }))),
    setOpensSoon: (v: boolean) => (opensSoon = v),
  };
}

describe('paper deployment daily cycle', () => {
  it('warms up without orders, then trades each new completed day like the backtest', async () => {
    const { d, deps, sent, fill, setCutoff } = setup();
    const runtime = createRuntime(d);

    await runCycle(d, runtime, deps); // bars 0-5 completed: warm-up only
    expect(sent).toEqual([]);
    expect(d.lastBarAt).toEqual(bars[5].timestamp);

    setCutoff(6); // the breakout day closes
    await runCycle(d, runtime, deps);
    expect(sent).toEqual([
      expect.objectContaining({
        side: 'buy',
        qty: 825,
        clientOrderId: expect.stringMatching(/^dep-abcdef12-0-AAA-/),
      }),
    ]);
    expect(d.ledgers[0].pending).toHaveLength(1);

    fill(12.05); // filled at the next open
    setCutoff(7);
    await runCycle(d, runtime, deps);
    expect(d.ledgers[0].positions.AAA).toEqual({
      symbol: 'AAA',
      qty: 825,
      avgPrice: expect.closeTo(12.05),
    });
    expect(d.ledgers[0].cash).toBeCloseTo(10_000 - 825 * 12.05);
    expect(d.ledgers[0].pending).toEqual([]);
    expect(d.events.map((e) => e.message)).toContain(
      'Bought 825 AAA at $12.05',
    );

    setCutoff(10); // 3 days at once (runner was off): 14 → 12 → 11, trailing stop hit
    await runCycle(d, runtime, deps);
    expect(sent.at(-1)).toMatchObject({ side: 'sell', qty: 825 });
    expect(sent).toHaveLength(2); // one order, from the latest day only
    fill(10.9);
    await runCycle(d, runtime, deps);
    expect(d.ledgers[0].positions).toEqual({});
    expect(d.ledgers[0].realizedPnl).toBeCloseTo(825 * (10.9 - 12.05));
    expect(d.snapshots.at(-1)?.equity).toBeCloseTo(d.ledgers[0].cash);
  });

  it('after a restart, replays history without re-sending old orders', async () => {
    const { d, deps, sent, setCutoff } = setup({
      lastBarAt: bars[6].timestamp,
    });
    setCutoff(6);
    await runCycle(d, createRuntime(d), deps); // fresh runtime, nothing new since lastBarAt
    expect(sent).toEqual([]);
  });

  it('pauses and sells everything when the guard trips; paused deployments send no new orders', async () => {
    const { d, deps, sent, fill, setCutoff } = setup({ maxDrawdownPct: 5 });
    const runtime = createRuntime(d);
    await runCycle(d, runtime, deps);
    setCutoff(6);
    await runCycle(d, runtime, deps);
    fill(12);
    setCutoff(9); // 14 → 12: peak equity at 14, now 12 = -12%
    await runCycle(d, runtime, deps);
    expect(d.status).toBe('paused');
    expect(d.statusReason).toMatch(/below its peak \(limit 5%\)/);
    expect(sent.at(-1)).toMatchObject({ side: 'sell', qty: 825 });

    const count = sent.length;
    fill(11.9);
    setCutoff(11);
    await runCycle(d, runtime, deps);
    expect(sent).toHaveLength(count); // no new orders while paused
    expect(d.ledgers[0].positions).toEqual({}); // the guard's sell was booked
  });

  it('with the news check, a buy waits for the pre-open check and goes out only on clean news', async () => {
    const { d, deps, sent, setCutoff, setNews, setOpensSoon } = setup({
      newsCheck: { tone: 0.3, ai: false, watch: 'off' },
    });
    const runtime = createRuntime(d);
    await runCycle(d, runtime, deps);
    setCutoff(6); // breakout: the buy is staged, not sent
    await runCycle(d, runtime, deps);
    expect(sent).toEqual([]);
    expect(d.ledgers[0].staged).toEqual([
      expect.objectContaining({ symbol: 'AAA', qty: 825 }),
    ]);

    setOpensSoon(true);
    setNews(['AAA plunges after fraud probe, shares fall']);
    await runCycle(d, runtime, deps);
    expect(sent).toEqual([]);
    expect(d.ledgers[0].staged).toEqual([]);
    expect(d.events.at(-1)?.message).toMatch(
      /^Skipped buying 825 AAA: the news since the signal is negative/,
    );
  });

  it('sends the waiting buy when the news is fine', async () => {
    const { d, deps, sent, setCutoff, setNews, setOpensSoon } = setup({
      newsCheck: { tone: 0.3, ai: false, watch: 'off' },
    });
    const runtime = createRuntime(d);
    await runCycle(d, runtime, deps);
    setCutoff(6);
    await runCycle(d, runtime, deps);
    setOpensSoon(true);
    setNews(['AAA to present at a conference']);
    await runCycle(d, runtime, deps);
    expect(sent).toEqual([expect.objectContaining({ side: 'buy', qty: 825 })]);
    expect(d.events.at(-1)?.message).toMatch(/passed the news check$/);
  });
});
