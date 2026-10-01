import {
  infoNeeds,
  usesMarket,
} from '../../strategies/rules/rules-validate.js';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import {
  createStrategy,
  resolveStrategyParams,
  strategyVersion,
} from '../../strategies/strategy-registry.js';
import type { StrategyBar } from '../../strategies/strategy.types.js';
import {
  type BacktestResult,
  ENGINE_VERSION,
  runBacktest,
} from '../backtest-engine.js';
import {
  type BacktestRequest,
  BacktestService,
  validateRequest,
} from '../backtest.service.js';
import type { AiSummary } from '../summary/ai-summary.types.js';
import { BacktestRun } from './backtest-run.schema.js';
import {
  dataHash,
  type RunConfig,
  runFingerprint,
  stripUndefined,
} from './run-fingerprint.js';

/** Results with more points than this aren't stored in full (MongoDB 16 MB document limit). */
export const MAX_STORED_POINTS = 50_000;

export type RunStatus =
  | { kind: 'new' }
  | { kind: 'reused'; savedAt: Date }
  | { kind: 'replaced'; reason: string }
  | { kind: 'forced' };

export interface HistoryRun {
  result: BacktestResult;
  bars: Record<string, StrategyBar[]>;
  fingerprint: string;
  status: RunStatus;
  /** Saved AI summary (only when the run was reused). */
  aiSummary: AiSummary | null;
}

/**
 * Backtests with a saved history: an identical test is reused while its
 * engine version, strategy version and data still match the current ones;
 * otherwise it is re-run and the saved record replaced.
 */
@Injectable()
export class BacktestHistoryService {
  constructor(
    @InjectModel(BacktestRun.name) private readonly runs: Model<BacktestRun>,
    private readonly backtests: BacktestService,
  ) {}

  async run(
    request: BacktestRequest,
    options: { fresh?: boolean } = {},
  ): Promise<HistoryRun> {
    validateRequest(request);
    const symbols = request.symbols.map((s) => s.trim().toUpperCase());
    const config: RunConfig = {
      strategy: request.strategy,
      params: resolveStrategyParams(request.strategy, symbols, request.params),
      symbols,
      timeframe: request.timeframe,
      from: request.from,
      to: request.to,
      initialCash: request.initialCash,
      slippageBps: request.slippageBps,
      feePerShare: request.feePerShare,
      cashYieldPct: request.cashYieldPct ?? 0,
      newsGateTone: request.newsGateTone ?? 0,
    };
    const fingerprint = runFingerprint(config);
    const current = {
      engineVersion: ENGINE_VERSION,
      strategyVersion: strategyVersion(request.strategy),
    };

    const bars = await this.backtests.fetchBars(
      symbols,
      request,
      infoNeeds([request.strategy], config.params, request.newsGateTone),
    );
    const market = await this.backtests.fetchMarket(
      usesMarket([request.strategy], config.params),
      request,
    );
    // Market bars (SPY for the market filter) count too: if they change, so may the result.
    const hash = dataHash({
      ...bars,
      ...Object.fromEntries(
        Object.entries(market).map(([s, list]) => [`market:${s}`, list]),
      ),
    });
    const saved = await this.runs.findOne({ fingerprint }).lean<BacktestRun>();

    const stale = saved ? this.staleReason(saved, current, hash) : null;
    if (saved?.result && !stale && !options.fresh) {
      await this.runs.updateOne({ fingerprint }, { $inc: { requestCount: 1 } });
      return {
        result: saved.result,
        bars,
        fingerprint,
        status: { kind: 'reused', savedAt: saved.updatedAt },
        aiSummary: saved.aiSummary ?? null,
      };
    }

    const result = runBacktest(
      createStrategy(config.strategy, symbols, request.params),
      bars,
      request,
      { market },
    );
    const storable = result.equityCurve.length <= MAX_STORED_POINTS;
    await this.runs.updateOne(
      { fingerprint },
      {
        $set: {
          ...config,
          ...current,
          dataHash: hash,
          metrics: result.metrics,
          finalEquity: result.finalEquity,
          result: storable ? stripUndefined(result) : undefined,
        },
        $unset: { aiSummary: 1, ...(storable ? {} : { result: 1 }) },
        $inc: { requestCount: 1 },
      },
      { upsert: true },
    );
    const status: RunStatus = !saved
      ? { kind: 'new' }
      : options.fresh
        ? { kind: 'forced' }
        : {
            kind: 'replaced',
            reason: stale ?? 'the saved record had no full result',
          };
    return { result, bars, fingerprint, status, aiSummary: null };
  }

  async saveAiSummary(fingerprint: string, summary: AiSummary): Promise<void> {
    await this.runs.updateOne(
      { fingerprint },
      { $set: { aiSummary: summary } },
    );
  }

  private staleReason(
    saved: BacktestRun,
    current: { engineVersion: number; strategyVersion: number },
    hash: string,
  ): string | null {
    if (saved.engineVersion !== current.engineVersion) {
      return `engine v${saved.engineVersion} → v${current.engineVersion}`;
    }
    if (saved.strategyVersion !== current.strategyVersion) {
      return `${saved.strategy} v${saved.strategyVersion} → v${current.strategyVersion}`;
    }
    if (saved.dataHash !== hash) return 'the market data changed';
    return null;
  }
}
