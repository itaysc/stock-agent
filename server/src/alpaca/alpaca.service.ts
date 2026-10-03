import {
  type Alpaca,
  type OrdersApi,
  type marketDataShapes,
  type orders,
  type trading,
  type values,
} from '@alpacahq/alpaca-trade-api';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { ALPACA_CLIENT } from './alpaca.constants.js';

/**
 * Network/timeout failure (no HTTP response). Checked by name rather than
 * `instanceof`, which breaks when the SDK is loaded from more than one entry
 * point (e.g. the `/testing` bundle).
 */
export function isFetchError(err: unknown): err is Error {
  return err instanceof Error && err.name === 'FetchError';
}

/**
 * An order request. `clientOrderId` is mandatory: it must be stable and unique
 * per order so an ambiguous failure can be reconciled instead of re-placed.
 */
export type PlaceOrderInput = orders.OrderInput & { clientOrderId: string };

export type ListOrdersInput = Parameters<OrdersApi['getAllOrders']>[0];

/** Waits before retrying a rate-limited request (the limit resets every minute). */
const RATE_LIMIT_WAITS_S = [5, 20, 40];

/** Alpaca's "too many requests" (HTTP 429): its error, not the app's own 429s (e.g. the login lockout). */
export function isRateLimited(err: unknown): boolean {
  if (err instanceof HttpException) return false;
  const e = err as { name?: string; status?: number };
  return e?.name === 'RateLimitError' || e?.status === 429;
}

export interface GetBarsInput {
  timeframe: values.TimeFrameString;
  start?: Date;
  end?: Date;
  limit?: number;
  /** Price adjustment for corporate actions. Backtests should use 'all' (splits + dividends). */
  adjustment?: 'raw' | 'split' | 'dividend' | 'all';
}

/**
 * App-facing wrapper around the Alpaca SDK. Covers what the app uses today;
 * anything else is reachable through `client`.
 */
@Injectable()
export class AlpacaService implements OnModuleInit {
  private readonly logger = new Logger(AlpacaService.name);
  private readonly feed: Env['ALPACA_DATA_FEED'];

  constructor(
    @Inject(ALPACA_CLIENT) readonly client: Alpaca,
    config: ConfigService<Env, true>,
  ) {
    this.feed = config.get('ALPACA_DATA_FEED', { infer: true });
  }

  get isPaper(): boolean {
    return this.client.paper;
  }

  private get mode(): string {
    return this.isPaper ? 'PAPER' : 'LIVE';
  }

  /** Verifies credentials at boot; bad keys fail startup instead of the first trade. */
  async onModuleInit(): Promise<void> {
    if (!this.isPaper) {
      this.logger.warn('ALPACA_PAPER=false: LIVE trading with real money');
    }

    const check = await this.client.trading.validateConnection();
    if (check.ok) {
      this.logger.log(
        `Connected to Alpaca (${this.mode}), account status: ${check.account.status}`,
      );
      return;
    }

    if (check.status === 401 || check.status === 403) {
      throw new Error(
        `Alpaca rejected the credentials (${check.status}) in ${this.mode} mode: ${check.message.replace(/\.$/, '')}. ` +
          'Check ALPACA_API_KEY / ALPACA_API_SECRET, and that ALPACA_PAPER matches the key type ' +
          '(paper keys only work with ALPACA_PAPER=true, live keys with false).',
      );
    }
    this.logger.warn(`Could not reach Alpaca at startup: ${check.message}`);
  }

  // --- Account ------------------------------------------------------------

  getAccount(): Promise<trading.Account> {
    return this.client.trading.account.getAccount();
  }

  getClock(): Promise<trading.LegacyClock> {
    return this.client.trading.clock.legacyClock();
  }

  // --- Positions ----------------------------------------------------------

  getPositions(): Promise<trading.Position[]> {
    return this.client.trading.positions.getAllOpenPositions();
  }

  getPosition(symbol: string): Promise<trading.Position> {
    return this.client.trading.positions.getOpenPosition({
      symbolOrAssetId: symbol,
    });
  }

  closePosition(symbol: string): Promise<trading.Order> {
    this.logger.log(`Closing position ${symbol} (${this.mode})`);
    return this.client.trading.positions.deleteOpenPosition({
      symbolOrAssetId: symbol,
    });
  }

  // --- Orders -------------------------------------------------------------

  listOrders(input?: ListOrdersInput): Promise<trading.Order[]> {
    return this.client.trading.orders.getAllOrders(input);
  }

  getOrder(orderId: string): Promise<trading.Order> {
    return this.client.trading.orders.getOrderByOrderID({ orderId });
  }

  getOrderByClientOrderId(clientOrderId: string): Promise<trading.Order> {
    return this.client.trading.orders.getOrderByClientOrderId({
      clientOrderId,
    });
  }

  /**
   * Places an order once; order POSTs are never retried. If the network fails
   * mid-request the order may still have been accepted, so we look it up by
   * `clientOrderId` before surfacing the error.
   */
  async placeOrder(input: PlaceOrderInput): Promise<trading.Order> {
    this.logger.log(
      `Placing ${input.type} ${input.side} ${input.symbol} (${this.mode}), clientOrderId=${input.clientOrderId}`,
    );
    try {
      return await this.client.trading.orders.submit(input);
    } catch (err) {
      if (!isFetchError(err)) throw err;
      this.logger.warn(
        `Order placement ambiguous (${err.message}), reconciling clientOrderId=${input.clientOrderId}`,
      );
      try {
        return await this.getOrderByClientOrderId(input.clientOrderId);
      } catch {
        // Not found (yet) does not prove the order failed; surface the original error.
        throw err;
      }
    }
  }

  cancelOrder(orderId: string): Promise<void> {
    this.logger.log(`Canceling order ${orderId} (${this.mode})`);
    return this.client.trading.orders.deleteOrderByOrderID({ orderId });
  }

  /** Cancels all open orders, then market-sells/covers every position. */
  closeAllPositions(): Promise<trading.PositionClosedReponse[]> {
    this.logger.warn(`Closing ALL positions (${this.mode})`);
    return this.client.trading.closeAllPositions({ cancelOrders: true });
  }

  cancelAllOrders(): Promise<trading.CanceledOrderResponse[]> {
    this.logger.log(`Canceling all open orders (${this.mode})`);
    return this.client.trading.orders.deleteAllOrders();
  }

  // --- Market data --------------------------------------------------------

  getBars(
    symbol: string,
    input: GetBarsInput,
  ): Promise<marketDataShapes.Bar[]> {
    return this.client.marketData.getStockBarsFor(symbol, {
      ...input,
      feed: this.feed,
    });
  }

  /**
   * Bars for many symbols in one combined request (pages of up to 10,000
   * bars), instead of one request per symbol: Alpaca's free plan allows about
   * 200 requests a minute. Waits and retries when it is rate-limited anyway.
   */
  async getBarsMany(
    symbols: string[],
    input: GetBarsInput,
  ): Promise<Record<string, marketDataShapes.Bar[]>> {
    if (!symbols.length) return {};
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.client.marketData.getStockBars({
          ...input,
          symbols,
          feed: this.feed,
          limit: input.limit ?? 10_000,
        });
      } catch (err) {
        if (!isRateLimited(err) || attempt >= RATE_LIMIT_WAITS_S.length)
          throw err;
        const wait = RATE_LIMIT_WAITS_S[attempt];
        this.logger.warn(`Alpaca rate limit: retrying the bars in ${wait}s`);
        await new Promise((r) => setTimeout(r, wait * 1000));
      }
    }
  }

  /** Historical news articles (headline, time, symbols), one page at a time. */
  getNews(req: {
    symbols: string;
    start: Date;
    end: Date;
    pageToken?: string;
    /** Newest first (default oldest first). */
    newestFirst?: boolean;
  }): Promise<{
    news: Array<{ headline: string; createdAt: Date }>;
    nextPageToken: string | null;
  }> {
    const { newestFirst, ...rest } = req;
    return this.client.marketData.news.news({
      ...rest,
      limit: 50,
      sort: newestFirst ? 'desc' : 'asc',
    });
  }

  getLatestPrice(symbol: string): Promise<number | undefined> {
    return this.client.marketData.getLatestPrice(symbol, { feed: this.feed });
  }
}
