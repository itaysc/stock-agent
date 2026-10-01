import type { DeploymentView } from './paper-types';

type Expectation = NonNullable<DeploymentView['expectation']>;

interface BrokerBase {
  /** The algo in one sentence. */
  algo: string;
  params: Record<string, string>;
  lastTune: { at: string; message: string } | null;
  /** What the starting settings did on data they never saw. */
  tested: string;
  universe: string[];
}

export interface BrokerHolding {
  symbol: string;
  qty: number;
  boughtAt: string | null;
  /** Average buy price. */
  entryPrice: number;
  /** Latest close. */
  price: number;
  highSinceBuy: number;
  /** It sells when a close falls below this: the higher of the automatic stop and yours. */
  stopPrice: number | null;
  /** The automatic trailing stop alone. */
  autoStopPrice: number | null;
  stopIsYours: boolean;
  takeProfitPrice: number | null;
  takeIsYours: boolean;
  /** Its rank now (1 = strongest), when known. */
  rank: number | null;
  tone: 'good' | 'watch' | 'danger' | 'neutral';
  /** e.g. "Strong", "Weakening", "Near stop". */
  label: string;
  text: string;
  value: number;
  weightPct: number;
  gainPct: number;
  why: string;
}

export interface BrokerPlanned {
  side: 'buy' | 'sell';
  symbol: string;
  qty: number;
  why: string;
  when: string;
}

export interface BrokerActivity {
  timestamp: string;
  kind: 'buy' | 'sell' | 'note';
  text: string;
}

export type BrokerView =
  | ({ status: 'off' } & BrokerBase)
  | ({
      status: 'active' | 'paused' | 'stopped';
      statusReason: string | null;
      deploymentId: string;
      startedAt: string;
      capital: number;
      equity: number;
      cash: number;
      pnl: number;
      pnlPct: number;
      /** SPY over the same time, to compare with. */
      spyPct: number | null;
      maxDrawdownPct: number;
      expectation: Expectation | null;
      holdings: BrokerHolding[];
      planned: BrokerPlanned[];
      /** Stocks you sold: it does not buy them again before these dates. */
      noBuyUntil: Array<{ symbol: string; until: string }>;
      activity: BrokerActivity[];
    } & BrokerBase);

/** What it would buy now with an amount (nothing is bought yet). */
export interface BrokerPlan {
  capital: number;
  asOf: string;
  rows: Array<{
    symbol: string;
    weightPct: number;
    amount: number;
    qty: number;
    price: number;
    stopPrice: number | null;
    why: string;
  }>;
  cash: number;
}

export interface StockChartData {
  symbol: string;
  closes: Array<{ time: string; close: number }>;
  trades: Array<{ time: string; side: 'buy' | 'sell'; qty: number; price: number; why: string }>;
  entryPrice: number | null;
  boughtAt: string | null;
  highSinceBuy: number | null;
  stopPrice: number | null;
  takeProfitPrice: number | null;
}
