/** The broker's own state (one document): which deployment it runs, and when it last reported. */
export interface BrokerState {
  /** Its paper deployment (null until you start it). */
  deploymentId: string | null;
  /** The algo's current settings (momentum-rotation params). */
  params: Record<string, string>;
  /** Trades and events after this are in the next daily report. */
  lastReportAt: Date | null;
  /** The last completed trading day it reported. */
  lastReportedBarAt: Date | null;
  /** How many of its trades were already sent to you as fill messages. */
  notifiedTrades?: number;
  /** The last monthly check and what it found. */
  lastTune: { at: Date; message: string } | null;
}
