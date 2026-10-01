import { makeBars } from '../../../test/support/bars.js';
import type {
  StrategyBar,
  StrategyContext,
} from '../../strategies/strategy.types.js';
import type { BacktestService } from '../backtest.service.js';
import { WalkForwardService } from './walkforward.service.js';

/** Every strategy instance the service creates, with the latest bar it was shown. */
const probes = vi.hoisted(() => [] as Array<{ latest: number }>);

vi.mock('../../strategies/strategy-registry.js', () => ({
  strategyParamNames: () => ['x', 'allocation'],
  createStrategy: (
    _name: string,
    symbols: string[],
    params: Record<string, string>,
  ) => {
    const probe = { latest: 0 };
    probes.push(probe);
    let i = 0;
    return {
      name: 'probe',
      symbols,
      onBar: (bar: StrategyBar, ctx: StrategyContext) => {
        probe.latest = Math.max(probe.latest, bar.timestamp.getTime());
        // Trade a little so settings differ.
        if (i++ % (Number(params.x) + 2) === 0) {
          if (ctx.position(bar.symbol))
            ctx.sell(bar.symbol, ctx.position(bar.symbol)?.qty ?? 0);
          else ctx.buy(bar.symbol, 1);
        }
      },
    };
  },
}));

describe('walk-forward look-ahead guard', () => {
  it('never shows a training run any bar from its test period', async () => {
    const closes = Array.from(
      { length: 400 },
      (_, i) => 100 + 10 * Math.sin(i / 7),
    );
    const bars = { AAPL: makeBars('AAPL', closes, '2023-01-01') };
    const service = new WalkForwardService({
      fetchBars: async () => bars,
      fetchMarket: async () => ({}),
    } as unknown as BacktestService);

    const result = await service.run({
      strategies: ['probe'],
      grid: { x: ['1', '2', '3'] },
      symbols: ['AAPL'],
      timeframe: '1Day',
      from: new Date('2023-01-01'),
      to: new Date('2024-02-01'),
      train: '6m',
      test: '2m',
      sort: 'return',
      initialCash: 10_000,
      slippageBps: 0,
      feePerShare: 0,
    });

    // Per window: 3 training runs, then 1 test run, in that order.
    expect(probes).toHaveLength(result.windows.length * 4);
    result.windows.forEach((w, i) => {
      const [t1, t2, t3, test] = probes.slice(i * 4, i * 4 + 4);
      for (const train of [t1, t2, t3]) {
        expect(train.latest).toBeLessThan(w.trainTo.getTime());
      }
      expect(test.latest).toBeLessThan(w.testTo.getTime());
      expect(test.latest).toBeGreaterThanOrEqual(w.testFrom.getTime());
    });
  });
});
