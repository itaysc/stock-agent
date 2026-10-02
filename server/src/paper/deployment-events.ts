import type { InfoNeeds } from '../info/info.service.js';
import type { StrategyBar } from '../strategies/strategy.types.js';
import type { OrderStatus } from './reconcile.js';
import type { Deployment } from './deployment.types.js';

const MAX_EVENTS = 200;

/** What the daily cycle needs from the outside world (Alpaca, the order service, a clock). */
export interface CycleDeps {
  /** Daily bars in [from, to) per symbol, with news/earnings when `needs` asks. */
  fetchDaily(
    symbols: string[],
    from: Date,
    to: Date,
    needs?: InfoNeeds,
  ): Promise<Record<string, StrategyBar[]>>;
  /** Bars before this time are complete (the session has closed). */
  completedBefore(): Promise<Date>;
  getOrder(clientOrderId: string): Promise<OrderStatus | null>;
  /** Sends a market order (through the risk checks); throws when refused. */
  placeOrder(order: {
    clientOrderId: string;
    symbol: string;
    side: 'buy' | 'sell';
    qty: number;
  }): Promise<void>;
  now(): Date;
  /** Headlines about a symbol published after `since`, newest first. */
  recentNews(symbol: string, since: Date): Promise<Headline[]>;
  /** The AI's reading of the headlines (null when the AI is not available). company: events at the company; market: market-wide emergencies (for funds). */
  aiNewsCheck(
    symbol: string,
    headlines: Headline[],
    purpose: 'buy' | 'hold',
    mode: 'company' | 'market',
  ): Promise<{ avoid: boolean; reason: string } | null>;
  /** Official facts: a trading halt now, and 8-K filings since `since`. */
  officialEvents(symbol: string, since: Date): Promise<OfficialEvents>;
  /** True when the market opens within the pre-open window, or is open. */
  opensSoon(): Promise<boolean>;
  /** Sends a notification (no-op when none is configured). */
  /** A message to you (Telegram buttons send `data` back to the bot). */
  notify(
    text: string,
    buttons?: Array<{ text: string; data: string }>,
  ): Promise<void>;
}

export interface OfficialEvents {
  halt: { reasonCode: string; reason: string } | null;
  filings: Array<{
    form: string;
    items: string[];
    acceptedAt: Date;
    url: string;
  }>;
}

export interface Headline {
  headline: string;
  createdAt: Date;
}

/** Adds a line to the deployment's log (keeps the latest 200). */
export function logEvent(d: Deployment, message: string, at: Date): void {
  d.events.push({ timestamp: at, message });
  if (d.events.length > MAX_EVENTS)
    d.events.splice(0, d.events.length - MAX_EVENTS);
}
