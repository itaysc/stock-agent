import type { ProfileId } from './profiles.js';

/** The broker's own state (one document): which deployment it runs, and when it last reported. */
export interface BrokerState {
  /** Older single investment (investments are now every live 'broker' deployment). */
  deploymentId: string | null;
  /** The risk profile it runs (aggressive / balanced / careful). */
  profile?: ProfileId;
  /** The algo's current settings (momentum-rotation params). */
  params: Record<string, string>;
  /** Trades and events after this are in the next daily report. */
  lastReportAt: Date | null;
  /** The last completed trading day it reported. */
  lastReportedBarAt: Date | null;
  /** Older single investment: how many of its trades were sent as fill messages. */
  notifiedTrades?: number;
  /** Per investment: how many of its trades were already sent to you as fill messages. */
  notified?: Record<string, number>;
  /** The last monthly check and what it found. */
  lastTune: { at: Date; message: string } | null;
}
