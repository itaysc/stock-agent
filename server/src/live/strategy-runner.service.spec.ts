import type { streaming } from '@alpacahq/alpaca-trade-api';
import type { ConfigService } from '@nestjs/config';
import { Subject } from 'rxjs';
import type { AlpacaStreamService } from '../alpaca/alpaca-stream.service.js';
import type { AlpacaService } from '../alpaca/alpaca.service.js';
import type { Env } from '../config/env.js';
import type { OrdersService } from '../orders/orders.service.js';
import type {
  StrategyBar,
  StrategyContext,
} from '../strategies/strategy.types.js';
import { StrategyRunnerService } from './strategy-runner.service.js';

/** Records bars and buys on every bar it sees, to observe what the runner forwards. */
const recorder = vi.hoisted(() => ({
  bars: [] as StrategyBar[],
  market: [] as StrategyBar[],
}));
vi.mock('../strategies/strategy-registry.js', () => ({
  createStrategy: (name: string, symbols: string[]) => ({
    name,
    symbols,
    warmupBars: 2,
    // 'market-test' also reads SPY (like the rules strategy's market filter).
    marketSymbols: name === 'market-test' ? ['SPY'] : [],
    onMarketBar: (bar: StrategyBar) => recorder.market.push(bar),
    onBar: (bar: StrategyBar, ctx: StrategyContext) => {
      recorder.bars.push(bar);
      ctx.buy(bar.symbol, 1);
    },
  }),
}));

const minute = (iso: string, close: number): StrategyBar => ({
  symbol: 'AAPL',
  timestamp: new Date(iso),
  open: close,
  high: close,
  low: close,
  close,
  volume: 1,
});

function setup(env: Partial<Record<keyof Env, unknown>> = {}, isPaper = true) {
  const bars$ = new Subject<streaming.StreamBar>();
  const config = {
    get: (key: keyof Env) =>
      ({
        LIVE_STRATEGIES: [
          {
            strategy: 'test',
            symbols: ['aapl'],
            timeframe: '15Min',
            params: {},
          },
        ],
        STRATEGIES_ALLOW_LIVE: false,
        ALPACA_STREAMS_ENABLED: true,
        ...env,
      })[key],
  } as unknown as ConfigService<Env, true>;
  const alpaca = {
    isPaper,
    getAccount: vi.fn(async () => ({ cash: '10000' })),
    getPositions: vi.fn(async () => []),
    getBars: vi.fn(async () => [
      minute('2026-09-28T13:30:00Z', 1),
      minute('2026-09-28T13:45:00Z', 2),
      minute('2026-09-28T14:00:00Z', 3), // bucket in progress: not warm-up
    ]),
  };
  const streams = {
    bars: vi.fn(() => bars$.asObservable()),
    tradeUpdates$: new Subject<streaming.TradeUpdate>(),
  };
  const orders = { placeOrder: vi.fn(async () => ({})) };
  const runner = new StrategyRunnerService(
    config,
    alpaca as unknown as AlpacaService,
    streams as unknown as AlpacaStreamService,
    orders as unknown as OrdersService,
  );
  return { runner, bars$, alpaca, streams, orders };
}

describe('StrategyRunnerService', () => {
  beforeEach(() => {
    recorder.bars.length = 0;
    recorder.market.length = 0;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T14:07:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('warms up on completed history without ordering, then trades live bars', async () => {
    const { runner, bars$, orders, streams } = setup();
    await runner.onApplicationBootstrap();

    expect(recorder.bars.map((b) => b.close)).toEqual([1, 2]);
    expect(orders.placeOrder).not.toHaveBeenCalled();
    expect(streams.bars).toHaveBeenCalledWith(['AAPL']);

    // 14:07-14:14: the bucket that was in progress at startup is skipped.
    for (let m = 7; m <= 14; m++) {
      bars$.next(minute(`2026-09-28T14:${String(m).padStart(2, '0')}:00Z`, 5));
    }
    expect(recorder.bars).toHaveLength(2);

    // 14:15-14:29: first full 15-minute bar.
    for (let m = 15; m <= 29; m++)
      bars$.next(minute(`2026-09-28T14:${m}:00Z`, m));
    expect(recorder.bars.at(-1)).toMatchObject({ open: 15, close: 29 });
    expect(orders.placeOrder).toHaveBeenCalledTimes(1);
    expect(runner.status()).toEqual([
      expect.objectContaining({ strategy: 'test', acceptingOrders: true }),
    ]);
  });

  it('refuses to run strategies on a live account unless allowed', async () => {
    const live = setup({}, false);
    await live.runner.onApplicationBootstrap();
    expect(live.runner.status()).toEqual([]);
    expect(live.streams.bars).not.toHaveBeenCalled();

    const allowed = setup({ STRATEGIES_ALLOW_LIVE: true }, false);
    await allowed.runner.onApplicationBootstrap();
    expect(allowed.runner.status()).toHaveLength(1);
  });

  it('does nothing when no strategies are configured', async () => {
    const { runner, alpaca } = setup({ LIVE_STRATEGIES: [] });
    await runner.onApplicationBootstrap();
    expect(alpaca.getBars).not.toHaveBeenCalled();
  });

  it('keeps other strategies running when one fails to start', async () => {
    const { runner } = setup({
      LIVE_STRATEGIES: [
        { strategy: 'test', symbols: ['AAPL'], timeframe: '1Day', params: {} },
        { strategy: 'test', symbols: ['MSFT'], timeframe: '1Min', params: {} },
      ],
    });
    await runner.onApplicationBootstrap();
    expect(runner.status().map((s) => s.symbols)).toEqual([['MSFT']]);
  });

  it('streams and warms up market symbols without trading them', async () => {
    const { runner, bars$, orders, streams, alpaca } = setup({
      LIVE_STRATEGIES: [
        {
          strategy: 'market-test',
          symbols: ['AAPL'],
          timeframe: '15Min',
          params: {},
        },
      ],
    });
    await runner.onApplicationBootstrap();

    expect(streams.bars).toHaveBeenCalledWith(['AAPL', 'SPY']);
    expect(alpaca.getBars.mock.calls.map(([symbol]) => symbol)).toEqual([
      'SPY',
      'AAPL',
    ]);
    expect(recorder.market.map((b) => [b.symbol, b.close])).toEqual([
      ['SPY', 1],
      ['SPY', 2],
    ]);
    expect(recorder.bars.map((b) => b.symbol)).toEqual(['AAPL', 'AAPL']);

    for (let m = 15; m <= 29; m++) {
      bars$.next({ ...minute(`2026-09-28T14:${m}:00Z`, m), symbol: 'SPY' });
    }
    expect(recorder.market.at(-1)).toMatchObject({ symbol: 'SPY', close: 29 });
    expect(recorder.bars).toHaveLength(2); // SPY never reaches onBar
    expect(orders.placeOrder).not.toHaveBeenCalled();
  });
});
