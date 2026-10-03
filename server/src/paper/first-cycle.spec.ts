import { makeBars } from '../../test/support/bars.js';
import { runCycle } from './deployment-cycle.js';
import type { CycleDeps } from './deployment-events.js';
import { createRuntime } from './deployment-runtime.js';
import type { Deployment } from './deployment.types.js';
import { emptyLedger } from './sleeve-ledger.js';

const up = (start: number) =>
  Array.from({ length: 12 }, (_, i) => start * 1.01 ** i);
const bars = {
  AAA: makeBars('AAA', up(10), '2026-01-01'),
  BBB: makeBars(
    'BBB',
    up(20).map((x, i) => x * 0.995 ** i),
    '2026-01-01',
  ),
};

describe('a new deployment', () => {
  it('acts on the latest completed day right away (orders for the next open)', async () => {
    const d = {
      id: 'abcdef12-0000',
      name: 'Broker',
      status: 'active',
      statusReason: null,
      source: { kind: 'broker' },
      timeframe: '1Day',
      capital: 1_000,
      sleeves: [
        {
          strategy: 'momentum-rotation',
          symbols: ['AAA', 'BBB'],
          params: {
            lookback: '3',
            topN: '1',
            rebalanceDays: '5',
            volLookback: '5',
            fractional: '1',
          },
          weightPct: 100,
        },
      ],
      ledgers: [emptyLedger(1_000)],
      maxDrawdownPct: 0,
      expectation: null,
      lastBarAt: null,
      peakEquity: 1_000,
      snapshots: [],
      events: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Deployment;
    const sent: Array<{ symbol: string; side: string; notional?: number }> = [];
    const cutoff = new Date(bars.AAA.at(-1)!.timestamp.getTime() + 86_400_000);
    const deps = {
      fetchDaily: async () => bars,
      completedBefore: async () => cutoff,
      getOrder: async () => null,
      placeOrder: async (o: {
        symbol: string;
        side: string;
        notional?: number;
      }) => void sent.push(o),
      now: () => cutoff,
      notify: async () => undefined,
    } as unknown as CycleDeps;
    await runCycle(d, createRuntime(d), deps);
    expect(sent).toEqual([
      expect.objectContaining({ symbol: 'AAA', side: 'buy' }),
    ]);
    // Fractional: a dollar amount, nearly all of it (it fills at the open for exactly that).
    expect(sent[0].notional).toBeGreaterThan(995);
    expect(sent[0].notional).toBeLessThanOrEqual(1_000);
    expect(d.lastBarAt).toEqual(bars.AAA.at(-1)!.timestamp);
  });
});
