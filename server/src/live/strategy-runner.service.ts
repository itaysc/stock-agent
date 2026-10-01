import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { concatMap, type Subscription } from 'rxjs';
import { AlpacaStreamService } from '../alpaca/alpaca-stream.service.js';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import type { Env } from '../config/env.js';
import type { LiveStrategyConfig } from '../config/trading.env.js';
import { OrdersService } from '../orders/orders.service.js';
import { createStrategy } from '../strategies/strategy-registry.js';
import type { Strategy, StrategyBar } from '../strategies/strategy.types.js';
import { parseTimeframe, timeframeMinutes } from '../strategies/timeframe.js';
import { BarAggregator } from './bar-aggregator.js';
import { LiveContext } from './live-context.js';

interface Run {
  config: LiveStrategyConfig;
  strategy: Strategy;
  context: LiveContext;
  subscriptions: Subscription[];
}

/** US regular session is ~390 minutes a day; fetch generously to cover weekends/holidays. */
const lookbackMs = (bars: number, minutes: number) =>
  (Math.ceil((bars * minutes) / 390) * 2 + 5) * 86_400_000;

/**
 * Runs the strategies listed in LIVE_STRATEGIES against the live bar stream,
 * with the same Strategy code the backtester runs. Orders go through
 * OrdersService (risk checks + order log).
 */
@Injectable()
export class StrategyRunnerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(StrategyRunnerService.name);
  private readonly runs: Run[] = [];

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly alpaca: AlpacaService,
    private readonly streams: AlpacaStreamService,
    private readonly orders: OrdersService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const configs = this.config.get('LIVE_STRATEGIES', { infer: true });
    if (configs.length === 0) return;

    if (
      !this.alpaca.isPaper &&
      !this.config.get('STRATEGIES_ALLOW_LIVE', { infer: true })
    ) {
      this.logger.error(
        'Not starting strategies: this is a LIVE account. Set STRATEGIES_ALLOW_LIVE=true to trade real money.',
      );
      return;
    }
    if (!this.config.get('ALPACA_STREAMS_ENABLED', { infer: true })) {
      this.logger.error(
        'Not starting strategies: ALPACA_STREAMS_ENABLED=false',
      );
      return;
    }

    for (const config of configs) {
      await this.start(config).catch((err: Error) =>
        this.logger.error(`Failed to start ${config.strategy}: ${err.message}`),
      );
    }
  }

  onApplicationShutdown(): void {
    for (const run of this.runs) {
      run.subscriptions.forEach((s) => s.unsubscribe());
    }
    this.runs.length = 0;
  }

  status() {
    return this.runs.map(({ config, context }) => ({
      ...config,
      acceptingOrders: context.acceptingOrders,
    }));
  }

  private async start(config: LiveStrategyConfig): Promise<void> {
    const minutes = timeframeMinutes(config.timeframe);
    const symbols = config.symbols.map((s) => s.trim().toUpperCase());
    const strategy = createStrategy(config.strategy, symbols, config.params);
    const context = new LiveContext(
      strategy.name,
      this.alpaca,
      this.orders,
      this.logger,
    );
    await context.refresh();

    await this.warmUp(strategy, context, config.timeframe, minutes);
    context.acceptingOrders = true;

    // The bucket in progress at startup is missing its first minutes: skip it
    // rather than feed the strategy a bar with the wrong open/high/low.
    const bucketMs = minutes * 60_000;
    const firstFullBucket =
      minutes === 1 ? 0 : (Math.floor(Date.now() / bucketMs) + 1) * bucketMs;
    // Market symbols (e.g. SPY for a market filter) are streamed too, never traded.
    const market = strategy.marketSymbols ?? [];
    const streamed = [...new Set([...symbols, ...market])];
    const aggregators = new Map(
      streamed.map((s) => [s, new BarAggregator(minutes)]),
    );
    const subscriptions = [
      this.streams.bars(streamed).subscribe((minuteBar) => {
        for (const bar of aggregators.get(minuteBar.symbol)?.add(minuteBar) ??
          []) {
          if (bar.timestamp.getTime() < firstFullBucket) continue;
          if (market.includes(bar.symbol)) this.onMarketBar(strategy, bar);
          if (symbols.includes(bar.symbol)) this.onBar(strategy, context, bar);
        }
      }),
      this.streams.tradeUpdates$
        .pipe(concatMap((update) => context.onTradeUpdate(update)))
        .subscribe((fill) => fill && strategy.onFill?.(fill, context)),
    ];
    this.runs.push({ config, strategy, context, subscriptions });
    this.logger.log(
      `Started ${strategy.name} on ${symbols.join(', ')} (${config.timeframe}, ${this.alpaca.isPaper ? 'PAPER' : 'LIVE'})`,
    );
  }

  /** Replays recent completed bars so indicators are ready; orders are ignored meanwhile. */
  private async warmUp(
    strategy: Strategy,
    context: LiveContext,
    timeframe: string,
    minutes: number,
  ): Promise<void> {
    const count = strategy.warmupBars ?? 0;
    if (count === 0) return;
    const now = Date.now();
    const currentBucketStart =
      Math.floor(now / (minutes * 60_000)) * minutes * 60_000;

    const market = strategy.marketSymbols ?? [];
    // Market bars first, so the market filter is ready when the traded bars replay.
    for (const symbol of new Set([...market, ...strategy.symbols])) {
      const bars = await this.alpaca.getBars(symbol, {
        timeframe: parseTimeframe(timeframe),
        start: new Date(now - lookbackMs(count, minutes)),
        end: new Date(now),
        adjustment: 'all',
      });
      const completed = bars
        .filter((b) => b.timestamp.getTime() < currentBucketStart)
        .slice(-count);
      for (const bar of completed) {
        if (market.includes(symbol))
          this.onMarketBar(strategy, { ...bar, symbol });
        if (strategy.symbols.includes(symbol))
          this.onBar(strategy, context, { ...bar, symbol });
      }
      this.logger.log(
        `Warmed up ${strategy.name} ${symbol} with ${completed.length} bars`,
      );
    }
  }

  private onMarketBar(strategy: Strategy, bar: StrategyBar): void {
    try {
      strategy.onMarketBar?.(bar);
    } catch (err) {
      this.logger.error(
        `${strategy.name} failed on market bar ${bar.symbol}: ${(err as Error).message}`,
      );
    }
  }

  private onBar(
    strategy: Strategy,
    context: LiveContext,
    bar: StrategyBar,
  ): void {
    try {
      strategy.onBar(bar, context);
    } catch (err) {
      this.logger.error(
        `${strategy.name} failed on ${bar.symbol} bar: ${(err as Error).message}`,
      );
    }
  }
}
