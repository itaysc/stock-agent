import { type Alpaca, streaming } from '@alpacahq/alpaca-trade-api';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { filter, Observable, Subject } from 'rxjs';
import type { Env } from '../config/env.js';
import { ALPACA_CLIENT, ALPACA_STREAM_OPTIONS } from './alpaca.constants.js';
import {
  CHANNEL_METHODS,
  type ChannelEvents,
  type MarketDataChannel,
  type StreamOptions,
  type StreamsStatus,
} from './alpaca-stream.types.js';
import { logStreamLifecycle } from './stream-lifecycle.js';
import { SymbolRefCounter } from './symbol-ref-counter.js';

/**
 * Real-time Alpaca streams, exposed as RxJS observables.
 *
 * - `tradeUpdates$`: every order event on the account (new, fill, partial_fill,
 *   canceled, ...). Connected at startup.
 * - `bars()` / `quotes()` / `trades()`: live market data for the given symbols.
 *   The market data socket opens on first use. Symbols are reference-counted,
 *   so a symbol stays subscribed until every observer of it unsubscribes.
 *
 * Both sockets reconnect forever with backoff and re-subscribe automatically.
 */
@Injectable()
export class AlpacaStreamService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AlpacaStreamService.name);
  private readonly enabled: boolean;
  private readonly feed: Env['ALPACA_DATA_FEED'];

  private tradingStream?: streaming.TradingStream;
  private marketDataStream?: streaming.StockDataStream;

  private readonly tradeUpdates = new Subject<streaming.TradeUpdate>();
  readonly tradeUpdates$ = this.tradeUpdates.asObservable();

  private readonly channels: {
    [C in MarketDataChannel]: Subject<ChannelEvents[C]>;
  } = {
    bars: new Subject<streaming.StreamBar>(),
    quotes: new Subject<streaming.StreamQuote>(),
    trades: new Subject<streaming.StreamTrade>(),
  };
  private readonly refCounts: Record<MarketDataChannel, SymbolRefCounter> = {
    bars: new SymbolRefCounter(),
    quotes: new SymbolRefCounter(),
    trades: new SymbolRefCounter(),
  };

  constructor(
    @Inject(ALPACA_CLIENT) private readonly client: Alpaca,
    @Inject(ALPACA_STREAM_OPTIONS) private readonly options: StreamOptions,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('ALPACA_STREAMS_ENABLED', { infer: true });
    this.feed = config.get('ALPACA_DATA_FEED', { infer: true });
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) {
      this.logger.log('Alpaca streams disabled (ALPACA_STREAMS_ENABLED=false)');
      return;
    }

    const stream = this.client.trading.stream(this.streamOptions());
    logStreamLifecycle(stream, 'Trading', this.logger);
    stream.onTradeUpdate((update) => this.tradeUpdates.next(update));
    stream.subscribeTradeUpdates();
    stream.connect();
    this.tradingStream = stream;
  }

  onApplicationShutdown(): void {
    this.tradingStream?.disconnect();
    this.marketDataStream?.disconnect();
    this.tradeUpdates.complete();
    Object.values(this.channels).forEach((subject) => subject.complete());
  }

  status(): StreamsStatus {
    if (!this.enabled) return { trading: 'disabled', marketData: 'disabled' };
    return {
      trading: this.tradingStream?.getState() ?? 'idle',
      marketData: this.marketDataStream?.getState() ?? 'idle',
    };
  }

  /** Live minute bars for the given symbols. */
  bars(symbols: string[]): Observable<streaming.StreamBar> {
    return this.watch('bars', symbols);
  }

  /** Live top-of-book quotes for the given symbols. */
  quotes(symbols: string[]): Observable<streaming.StreamQuote> {
    return this.watch('quotes', symbols);
  }

  /** Live trades (prints) for the given symbols. */
  trades(symbols: string[]): Observable<streaming.StreamTrade> {
    return this.watch('trades', symbols);
  }

  private watch<C extends MarketDataChannel>(
    channel: C,
    symbols: string[],
  ): Observable<ChannelEvents[C]> {
    const wanted = [
      ...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
    ];

    return new Observable<ChannelEvents[C]>((subscriber) => {
      if (!this.enabled) {
        subscriber.error(
          new Error(
            'Alpaca streams are disabled (ALPACA_STREAMS_ENABLED=false)',
          ),
        );
        return;
      }
      if (wanted.length === 0) {
        subscriber.error(new Error(`No symbols given for ${channel} stream`));
        return;
      }

      const wantedSet = new Set(wanted);
      const subject: Subject<ChannelEvents[C]> = this.channels[channel];
      const subscription = subject
        .pipe(filter((event) => wantedSet.has(event.symbol)))
        .subscribe(subscriber);

      const added = this.refCounts[channel].acquire(wanted);
      if (added.length > 0) {
        this.getMarketDataStream()[CHANNEL_METHODS[channel][0]](added);
      }

      return () => {
        subscription.unsubscribe();
        const removed = this.refCounts[channel].release(wanted);
        if (removed.length > 0 && this.marketDataStream) {
          this.marketDataStream[CHANNEL_METHODS[channel][1]](removed);
        }
      };
    });
  }

  private getMarketDataStream(): streaming.StockDataStream {
    if (this.marketDataStream) return this.marketDataStream;

    const stream = this.client.marketData.stockStream({
      ...this.streamOptions(),
      feed: this.feed,
    });
    logStreamLifecycle(stream, 'Market data', this.logger);
    stream.onBar((bar) => this.channels.bars.next(bar));
    stream.onQuote((quote) => this.channels.quotes.next(quote));
    stream.onTrade((trade) => this.channels.trades.next(trade));
    stream.connect();
    this.marketDataStream = stream;
    return stream;
  }

  private streamOptions(): StreamOptions {
    return {
      maxReconnectAttempts: streaming.UNLIMITED_RECONNECT_ATTEMPTS,
      ...this.options,
    };
  }
}
