/** Shapes of the paper-trading endpoints (/api/v1/paper). */
import type { SleeveInput } from './types';

export interface PaperAccount {
  paper: boolean;
  /** False when PAPER_TRADING_ENABLED=false or the account is live. */
  runnerOn: boolean;
  cash: number;
  equity: number;
  committed: number;
  free: number;
  deploymentsEquity: number;
  newsSources: { headlines: boolean; halts: boolean; secFilings: boolean; ai: boolean };
}

export type Health = 'warming-up' | 'on-track' | 'behind' | 'deeper-drop';

export interface LedgerTrade {
  timestamp: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  reason?: string;
  realizedPnl?: number;
  sleeve: number;
}

export interface DeploymentView {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'stopped';
  statusReason: string | null;
  source: { kind: 'manual' | 'research' | 'portfolio' | 'autopilot'; researchId?: string };
  capital: number;
  equity: number;
  pnl: number;
  pnlPct: number;
  drawdownPct: number;
  maxDrawdownPct: number;
  newsCheck: { tone: number; ai: boolean; watch: 'off' | 'alert' | 'sell' } | null;
  daysLive: number;
  liveAnnualPct: number | null;
  expectation: {
    from: string;
    to: string;
    annualPct: number | null;
    maxDrawdownPct: number;
    tradesPerYear: number;
    holdAnnualPct: number | null;
  } | null;
  health: Health;
  healthText: string;
  reserve: number;
  sleeves: Array<{
    label: string;
    sleeve: SleeveInput;
    equity: number;
    cash: number;
    realizedPnl: number;
    positions: Array<{ symbol: string; qty: number; avgPrice: number; lastPrice: number | null }>;
    pending: Array<{
      clientOrderId: string;
      symbol: string;
      side: string;
      qty: number;
      submittedAt: string;
    }>;
    /** Buys waiting for the news check before the open. */
    staged: Array<{ symbol: string; qty: number; reason?: string; signalAt: string }>;
    trades: number;
  }>;
  lastBarAt: string | null;
  createdAt: string;
  /** Only in the detail (GET /deployments/:id). */
  snapshots?: Array<{ timestamp: string; equity: number }>;
  events?: Array<{ timestamp: string; message: string }>;
  trades?: LedgerTrade[];
}

/** What a "Paper trade this" button deploys. */
export type DeployTarget =
  | { kind: 'sleeves'; sleeves: SleeveInput[]; name: string }
  | { kind: 'research'; researchId: string; name: string; candidate: boolean };

export interface AutopilotSettings {
  enabled: boolean;
  watchlist: string[];
  everyDays: number;
  symbolsPerRun: number;
  goal: 'risk-adjusted' | 'beat-hold' | 'return';
  rounds: number;
  testsPerRound: number;
  holdout: string;
  basket: string;
  capitalPerDeployment: number;
  maxDeployments: number;
  retireBehindAfterDays: number;
  /** Groups researched as a whole, one per run (e.g. sector ETFs, for rotation strategies). */
  groups: string[];
  nextIndex: number;
  nextGroup: number;
  lastRunAt: string | null;
}

export interface AutopilotRun {
  id: string;
  trigger: 'schedule' | 'manual' | 'review';
  status: 'running' | 'done' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  decisions: Array<{
    kind: 'retired' | 'kept' | 'researched' | 'deployed' | 'skipped' | 'error';
    message: string;
    deploymentId?: string;
    researchId?: string;
  }>;
  error: string | null;
}

export interface AutopilotState {
  settings: AutopilotSettings;
  running: AutopilotRun | null;
  nextRunAt: string | null;
  /** False when AUTOPILOT_SCHEDULER_ENABLED=false (only "Run now" works). */
  schedulerOn: boolean;
  notifyOn: boolean;
  runs: AutopilotRun[];
}
