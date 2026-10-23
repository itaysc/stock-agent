import { streaming } from '@alpacahq/alpaca-trade-api';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { filter, Observable, Subject, type Subscription } from 'rxjs';
import {
  AccountContext,
  type ActiveAccount,
} from '../accounts/account-context.js';
import { AlpacaAccounts } from '../accounts/alpaca-accounts.service.js';
import type { Env } from '../config/env.js';
import { ALPACA_STREAM_OPTIONS } from './alpaca.constants.js';
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
 * - `tradeUpdates$`: every order event on every account (new, fill,
 *   partial_fill, canceled, ...), each delivered inside its account
 *   (AccountContext). One socket per account, connected at startup or when
 *   the account is added.
 * - `bars()` / `quotes()` / `trades()`: live market data for the given symbols.
 *   The market data socket opens on first use. Symbols are reference-counted,
 *   so a symbol stays subscribed until every observer of it unsubscribes.
 *   One socket, on the first account (Alpaca allows one per account).
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

  private readonly tradingStreams = new Map<string, streaming.TradingStream>();
  private accountChanges?: Subscription;
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
    private readonly accounts: AlpacaAccounts,
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

    this.accounts.list().forEach((a) => this.openTrading(a));
    this.accountChanges = this.accounts.changes$.subscribe((change) =>
      'added' in change
        ? this.openTrading(change.added)
        : this.closeTrading(change.removed),
    );
  }

  onApplicationShutdown(): void {
    this.accountChanges?.unsubscribe();
    this.tradingStreams.forEach((stream) => stream.disconnect());
    this.marketDataStream?.disconnect();
    this.tradeUpdates.complete();
    Object.values(this.channels).forEach((subject) => subject.complete());
  }

  private openTrading(account: ActiveAccount): void {
    this.closeTrading(account);
    const stream = account.client.trading.stream(this.streamOptions());
    logStreamLifecycle(stream, `Trading ${account.id}`, this.logger);
    stream.onTradeUpdate((update) =>
      AccountContext.run(account, () => this.tradeUpdates.next(update)),
    );
    stream.subscribeTradeUpdates();
    stream.connect();
    this.tradingStreams.set(account.id, stream);
  }

  private closeTrading(account: ActiveAccount): void {
    this.tradingStreams.get(account.id)?.disconnect();
    this.tradingStreams.delete(account.id);
  }

  status(): StreamsStatus {
    if (!this.enabled) return { trading: 'disabled', marketData: 'disabled' };
    // The worst account's state: any socket not authenticated shows.
    const states = [...this.tradingStreams.values()].map((s) => s.getState());
    return {
      trading:
        states.find((s) => s !== streaming.STATE.AUTHENTICATED) ??
        states[0] ??
        'idle',
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

    const account = this.accounts.first() ?? AccountContext.current();
    const stream = account.client.marketData.stockStream({
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
