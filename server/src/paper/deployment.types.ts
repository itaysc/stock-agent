import type { Sleeve } from '../backtest/portfolio/portfolio.types.js';
import type { Position } from '../strategies/strategy.types.js';

export type DeploymentStatus = 'active' | 'paused' | 'stopped';

/** One trade of a sleeve, as filled on the paper account. */
export interface LedgerTrade {
  timestamp: Date;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  reason?: string;
  /** Profit/loss of a sell. */
  realizedPnl?: number;
}

/** An order the sleeve sent that isn't done yet. */
export interface PendingOrder {
  clientOrderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  reason?: string;
  submittedAt: Date;
  /** Quantity already booked into the ledger (for partial fills). */
  bookedQty: number;
}

/** A buy that waits for the pre-open news check before it's sent. */
export interface StagedBuy {
  symbol: string;
  qty: number;
  reason?: string;
  /** When the strategy asked for it (after a close). */
  signalAt: Date;
}

/** Real-time news checks of a deployment (live only: news tone + optionally the AI). */
export interface NewsCheck {
  /** Skip a buy when the headlines since the signal average this negative or worse (0 = off). */
  tone: number;
  /** Also let the AI read the headlines (and confirm severe news) when OPENAI_API_KEY is set. */
  ai: boolean;
  /** Severe news about a held symbol: just log and notify, or also sell it. */
  watch: 'off' | 'alert' | 'sell';
}

export const DEFAULT_NEWS_CHECK: NewsCheck = {
  tone: 0.3,
  ai: true,
  watch: 'alert',
};

/**
 * A sleeve's own sub-account inside the shared paper account: its cash,
 * positions and trades. Symbols belong to one sleeve only, so its positions
 * are also the account's positions in those symbols.
 */
export interface SleeveLedger {
  cash: number;
  positions: Record<string, Position>;
  trades: LedgerTrade[];
  pending: PendingOrder[];
  /** Buys waiting for the pre-open news check (older deployments: absent). */
  staged?: StagedBuy[];
  realizedPnl: number;
  /** Last close per symbol, for valuing positions. */
  lastPrices: Record<string, number>;
}

/** What the backtest of this setup over recent years expected. */
export interface Expectation {
  from: Date;
  to: Date;
  annualPct: number | null;
  maxDrawdownPct: number;
  tradesPerYear: number;
  holdAnnualPct: number | null;
}

export interface Snapshot {
  timestamp: Date;
  equity: number;
}

export interface Deployment {
  id: string;
  name: string;
  status: DeploymentStatus;
  /** Why it was paused or stopped (by you or a guard). */
  statusReason: string | null;
  source: {
    kind: 'manual' | 'research' | 'portfolio' | 'autopilot';
    researchId?: string;
  };
  timeframe: '1Day';
  capital: number;
  sleeves: Sleeve[];
  ledgers: SleeveLedger[];
  /** Pause when the deployment is this % below its peak. */
  maxDrawdownPct: number;
  /** Absent on older deployments: no news checks. */
  newsCheck?: NewsCheck;
  /** Until when held symbols' news was watched. */
  newsCheckedAt?: Date | null;
  expectation: Expectation | null;
  /** Latest daily bar fed to the strategies (bars after it are new). */
  lastBarAt: Date | null;
  peakEquity: number;
  snapshots: Snapshot[];
  /** What happened, newest last (fills, orders sent or refused, guard pauses). */
  events: Array<{ timestamp: Date; message: string }>;
  createdAt: Date;
  updatedAt: Date;
}
