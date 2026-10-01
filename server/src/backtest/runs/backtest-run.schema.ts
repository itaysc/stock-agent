import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import type { BacktestMetrics } from '../backtest-metrics.js';
import type { BacktestResult } from '../backtest-engine.js';
import type { AiSummary } from '../summary/ai-summary.types.js';

/**
 * One saved backtest, keyed by the fingerprint of its setup. It is reused only
 * while engineVersion, strategyVersion and dataHash still match; otherwise the
 * test is re-run and this document replaced.
 */
@Schema({ collection: 'backtest_runs', timestamps: true })
export class BacktestRun {
  @Prop({ type: String, required: true, unique: true })
  fingerprint: string;

  @Prop({ type: Number, required: true })
  engineVersion: number;

  @Prop({ type: Number, required: true })
  strategyVersion: number;

  /** Hash of the bars the run used (adjusted prices can change later). */
  @Prop({ type: String, required: true })
  dataHash: string;

  @Prop({ type: String, required: true, index: true })
  strategy: string;

  /** Every param value, defaults included. */
  @Prop({ type: Object, required: true })
  params: Record<string, number>;

  @Prop({ type: [String], required: true, index: true })
  symbols: string[];

  @Prop({ type: String, required: true })
  timeframe: string;

  @Prop({ type: Date, required: true })
  from: Date;

  @Prop({ type: Date, required: true })
  to: Date;

  @Prop({ type: Number, required: true })
  initialCash: number;

  @Prop({ type: Number, required: true })
  slippageBps: number;

  @Prop({ type: Number, required: true })
  feePerShare: number;

  /** Yearly interest on idle cash, in percent. */
  @Prop({ type: Number, default: 0 })
  cashYieldPct: number;

  @Prop({ type: Object, required: true })
  metrics: BacktestMetrics;

  @Prop({ type: Number, required: true })
  finalEquity: number;

  /** Full result (fills, equity curve, ...); omitted when too large to store. */
  @Prop({ type: Object })
  result?: BacktestResult;

  @Prop({ type: Object })
  aiSummary?: AiSummary;

  /** How many times this exact test was requested (a measure of how much we tried). */
  @Prop({ type: Number, required: true, default: 1 })
  requestCount: number;

  createdAt: Date;
  updatedAt: Date;
}

export type BacktestRunDocument = HydratedDocument<BacktestRun>;
export const BacktestRunSchema = SchemaFactory.createForClass(BacktestRun);
