/** A stock or ETF you can trade. */
export interface Asset {
  symbol: string;
  name: string;
  exchange: string;
  tradable: boolean;
  fractionable: boolean;
}

/** A stock before you trade it. */
export interface Quote {
  symbol: string;
  asset: Asset | null;
  price: number | null;
  priceAt: string | null;
  earnings: { date: string; inDays: number | null; soon: boolean } | null;
  /** Your own shares (Trade page). */
  mine: { symbol: string; qty: number; avgPrice: number } | null;
  /** Shares the broker's investments hold (not yours to sell here). */
  brokerQty: number;
}

export type Point = { t: string; c: number };

export interface MyPosition {
  symbol: string;
  qty: number;
  avgPrice: number;
  openedAt: string | null;
  levels: { stopPrice?: number | null; takeProfitPrice?: number | null } | null;
  lastClose: number | null;
  /** What the shares you hold cost: in dollars, and in shekels at each buy day's Bank of Israel rate (null: no rate yet). */
  paidUsd: number;
  paidIls: number | null;
  /** Closes since a month before the buy. */
  spark: Point[];
}

export interface MyStocksView {
  positions: MyPosition[];
  pending: Array<{
    clientOrderId: string;
    symbol: string;
    side: 'buy' | 'sell';
    qty: number;
    notional?: number;
    submittedAt: string;
  }>;
  watchlist: Array<{ symbol: string; lastClose: number | null; spark: Point[] }>;
  events: Array<{ timestamp: string; message: string }>;
}

export interface Category {
  id: string;
  name: string;
  count: number;
}

export interface Trending {
  symbol: string;
  price: number;
  momentumPct: number;
  threeMonthPct: number;
  aboveTrend: boolean;
  volatilityPct: number;
  spark: Point[];
}

export interface Discovered {
  category: { id: string; name: string };
  items: Trending[];
  note: string;
}

export interface NewsSummary {
  symbol: string;
  summary: string;
  good: string[];
  bad: string[];
  mood: 'positive' | 'mixed' | 'negative' | 'quiet';
  headlines: number;
  from: string;
}

/** A change the sync made to My stocks. */
export interface SyncChange {
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
}

/** What a sync with the Alpaca account changed. */
export interface SyncResult {
  /** Bought outside the app: added. */
  added: SyncChange[];
  /** Sold outside the app: lowered. */
  removed: SyncChange[];
  /** Open orders placed outside the app, now followed. */
  orders: number;
  /** Left alone while an order is on the way. */
  skipped: string[];
}
