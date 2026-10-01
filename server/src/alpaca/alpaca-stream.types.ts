import type { streaming } from '@alpacahq/alpaca-trade-api';

export type StreamOptions = Partial<
  Omit<streaming.AlpacaWebSocketOptions, 'credentials' | 'url' | 'codec'>
>;

export type MarketDataChannel = 'bars' | 'quotes' | 'trades';

export interface ChannelEvents {
  bars: streaming.StreamBar;
  quotes: streaming.StreamQuote;
  trades: streaming.StreamTrade;
}

/** 'disabled' = ALPACA_STREAMS_ENABLED=false, 'idle' = not opened yet (market data opens on first use). */
export type StreamState = streaming.STATE | 'disabled' | 'idle';

export interface StreamsStatus {
  trading: StreamState;
  marketData: StreamState;
}

/** SDK subscribe / unsubscribe method names per channel. */
export const CHANNEL_METHODS = {
  bars: ['subscribeForBars', 'unsubscribeFromBars'],
  quotes: ['subscribeForQuotes', 'unsubscribeFromQuotes'],
  trades: ['subscribeForTrades', 'unsubscribeFromTrades'],
} as const satisfies Record<
  MarketDataChannel,
  readonly [keyof streaming.StockDataStream, keyof streaming.StockDataStream]
>;
