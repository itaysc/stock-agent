import { Injectable } from '@nestjs/common';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import {
  createStrategy,
  type StrategyParams,
} from '../strategies/strategy-registry.js';
import type { StrategyBar } from '../strategies/strategy.types.js';
import { InfoService, type InfoNeeds } from '../info/info.service.js';
import {
  infoNeeds,
  MARKET_SYMBOL,
  usesMarket,
} from '../strategies/rules/rules-validate.js';
import { parseTimeframe } from '../strategies/timeframe.js';
import { type BacktestResult, runBacktest } from './backtest-engine.js';
import type { BrokerOptions } from './simulated-broker.js';

export interface BacktestRequest extends BrokerOptions {
  strategy: string;
  symbols: string[];
  params?: StrategyParams;
  /** e.g. 1Day, 1Hour, 15Min */
  timeframe: string;
  from: Date;
  to: Date;
}

export function validateRequest(
  request: Omit<BacktestRequest, 'strategy' | 'symbols'>,
): void {
  const { from, to, initialCash, slippageBps, feePerShare, cashYieldPct } =
    request;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('from/to must be valid dates (YYYY-MM-DD)');
  }
  if (from >= to) throw new Error('from must be before to');
  if (!(initialCash > 0)) throw new Error('cash must be a positive number');
  if (!(slippageBps >= 0)) throw new Error('slippage must be >= 0');
  if (!(feePerShare >= 0)) throw new Error('fee must be >= 0');
  if (
    cashYieldPct !== undefined &&
    !(cashYieldPct >= 0 && cashYieldPct <= 20)
  ) {
    throw new Error('cash yield must be between 0 and 20 (% a year)');
  }
}

/** The result plus the bars it ran on (for charts). */
export interface BacktestRun {
  result: BacktestResult;
  bars: Record<string, StrategyBar[]>;
}

/** Price bars are reused for this long (e.g. a plan preview clicked twice, the broker page polling). */
const CACHE_MS = 10 * 60_000;
const CACHE_MAX = 30;

@Injectable()
export class BacktestService {
  private readonly cache = new Map<
    string,
    { at: number; bars: Record<string, StrategyBar[]> }
  >();

  constructor(
    private readonly alpaca: AlpacaService,
    private readonly info: InfoService,
  ) {}

  /** Whether the earnings blocks can get data (ALPHAVANTAGE_API_KEY is set). */
  get earningsAvailable(): boolean {
    return this.info.earningsAvailable;
  }

  async run(request: BacktestRequest): Promise<BacktestRun> {
    validateRequest(request);
    const symbols = request.symbols.map((s) => s.trim().toUpperCase());
    const strategy = createStrategy(request.strategy, symbols, request.params);
    const bars = await this.fetchBars(
      symbols,
      request,
      infoNeeds([request.strategy], request.params ?? {}, request.newsGateTone),
    );
    const market = await this.fetchMarket(
      usesMarket([request.strategy], request.params ?? {}),
      request,
    );
    return { result: runBacktest(strategy, bars, request, { market }), bars };
  }

  /** SPY bars for the market filter when `needed`; none otherwise. */
  fetchMarket(
    needed: boolean,
    request: Pick<BacktestRequest, 'timeframe' | 'from' | 'to'>,
  ): Promise<Record<string, StrategyBar[]>> {
    return needed
      ? this.fetchBars([MARKET_SYMBOL], request)
      : Promise.resolve({});
  }

  /**
   * Split/dividend-adjusted bars per symbol (symbols already normalized),
   * with news tone and earnings attached when `needs` asks for them.
   */
  async fetchBars(
    symbols: string[],
    request: Pick<BacktestRequest, 'timeframe' | 'from' | 'to'>,
    needs: InfoNeeds = {},
  ): Promise<Record<string, StrategyBar[]>> {
    const timeframe = parseTimeframe(request.timeframe);
    const key = [
      symbols.join(','),
      timeframe,
      new Date(request.from).toISOString(),
      new Date(request.to).toISOString(),
    ].join('|');
    let prices = this.cache.get(key);
    if (!prices || Date.now() - prices.at > CACHE_MS) {
      // One combined request for every symbol (not one each: Alpaca rate-limits).
      const fetched = await this.alpaca.getBarsMany(symbols, {
        timeframe,
        start: request.from,
        end: request.to,
        // Split/dividend-adjusted, so a split does not look like a crash.
        adjustment: 'all',
      });
      prices = {
        at: Date.now(),
        bars: Object.fromEntries(
          symbols.map((symbol) => [
            symbol,
            (fetched[symbol] ?? []).map((bar) => ({ ...bar, symbol })),
          ]),
        ),
      };
      this.cache.set(key, prices);
      if (this.cache.size > CACHE_MAX)
        this.cache.delete(this.cache.keys().next().value as string);
    }
    // Copies: news and earnings are attached to the bars below.
    const bars: Record<string, StrategyBar[]> = Object.fromEntries(
      Object.entries(prices.bars).map(([s, list]) => [
        s,
        list.map((b) => ({ ...b })),
      ]),
    );
    if (needs.news || needs.earnings)
      await this.info.enrich(bars, request, needs);
    return bars;
  }
}
