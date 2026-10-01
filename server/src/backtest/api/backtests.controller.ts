import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Env } from '../../config/env.js';
import { LlmService } from '../../llm/llm.service.js';
import { listStrategies } from '../../strategies/strategy-registry.js';
import { resolvePeriod } from '../backtest-cli.helpers.js';
import { RESEARCH_GOALS } from '../../research/research.types.js';
import { listBaskets } from '../../research/robustness/baskets.js';
import { ReportJobsService } from '../jobs/report-jobs.service.js';
import { MAX_COMBINATIONS, parseParamSpec } from '../sweep/param-grid.js';
import { SORT_KEYS } from '../sweep/sweep-report.js';
import {
  RunBacktestDto,
  RunSweepDto,
  RunWalkForwardDto,
} from './backtest.dto.js';
import {
  backtestResponse,
  listReports,
  sweepResponse,
  walkForwardResponse,
} from './backtest-responses.js';
import { mapErrors } from './map-errors.js';

const TIMEFRAMES = [
  '1Min',
  '5Min',
  '15Min',
  '30Min',
  '1Hour',
  '4Hour',
  '1Day',
  '1Week',
];
const WALKFORWARD_YEARS = 5;

const asStrings = (params: Record<string, string | number>) =>
  Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]));
/** { fast: "5..30:5" } → { fast: ["5", "10", ...] } */
const gridOf = (params: Record<string, string | number>) =>
  Object.fromEntries(
    Object.entries(asStrings(params)).map(([k, v]) =>
      parseParamSpec(`${k}=${v}`),
    ),
  );

@ApiTags('backtests')
@Controller()
export class BacktestsController {
  constructor(
    private readonly jobs: ReportJobsService,
    private readonly llm: LlmService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get('backtests/options')
  @ApiOperation({
    summary: 'Strategies, params and settings the backtest UI offers',
  })
  options() {
    const feed = this.config.get('ALPACA_DATA_FEED', { infer: true });
    return {
      strategies: listStrategies(),
      timeframes: TIMEFRAMES,
      sortKeys: SORT_KEYS,
      maxCombinations: MAX_COMBINATIONS,
      dataFeed: feed,
      // Earliest bars the feed returns (measured for IEX; SIP goes back to 2016).
      dataStart: feed === 'iex' ? '2020-07-27' : '2016-01-01',
      aiEnabled: this.llm.isConfigured(),
      baskets: listBaskets(),
      defaults: {
        timeframe: '1Day',
        cash: 100_000,
        slippageBps: 5,
        feePerShare: 0,
        cashYieldPct: 3,
        years: 2,
        walkForward: {
          train: '12m',
          test: '3m',
          sort: 'return-dd',
          years: WALKFORWARD_YEARS,
        },
        research: {
          goals: RESEARCH_GOALS,
          holdout: '12m',
          rounds: 5,
          testsPerRound: 3,
          basket: 'megacaps',
          years: WALKFORWARD_YEARS,
        },
      },
    };
  }

  @Post('backtests')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run a backtest, write its HTML report' })
  async runBacktest(@Body() dto: RunBacktestDto) {
    const { from, to } = resolvePeriod(dto.from, dto.to);
    const job = await mapErrors(() =>
      this.jobs.backtest(
        {
          strategy: dto.strategy,
          symbols: dto.symbols,
          params: asStrings(dto.params),
          timeframe: dto.timeframe,
          from: new Date(from),
          to: new Date(to),
          initialCash: dto.cash,
          slippageBps: dto.slippageBps,
          feePerShare: dto.feePerShare,
          cashYieldPct: dto.cashYieldPct,
          newsGateTone: dto.newsGateTone,
        },
        { fresh: dto.fresh, ai: dto.ai },
      ),
    );
    return backtestResponse(job);
  }

  @Post('sweeps')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run a parameter sweep, write its HTML report' })
  async runSweep(@Body() dto: RunSweepDto) {
    const { from, to } = resolvePeriod(dto.from, dto.to);
    const job = await mapErrors(() =>
      this.jobs.sweep(
        {
          strategies: dto.strategies,
          grid: gridOf(dto.params),
          symbols: dto.symbols,
          timeframe: dto.timeframe,
          from: new Date(from),
          to: new Date(to),
          initialCash: dto.cash,
          slippageBps: dto.slippageBps,
          feePerShare: dto.feePerShare,
          cashYieldPct: dto.cashYieldPct,
          newsGateTone: dto.newsGateTone,
        },
        { ai: dto.ai, sort: dto.sort, minTrades: dto.minTrades },
      ),
    );
    return sweepResponse(
      job,
      dto.sort,
      { from, to, timeframe: dto.timeframe },
      dto.cash,
    );
  }

  @Post('walkforwards')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Run a walk-forward test (train → unseen test windows)',
  })
  async runWalkForward(@Body() dto: RunWalkForwardDto) {
    const { from, to } = resolvePeriod(dto.from, dto.to, WALKFORWARD_YEARS);
    const job = await mapErrors(() =>
      this.jobs.walkForward(
        {
          strategies: dto.strategies,
          grid: gridOf(dto.params),
          symbols: dto.symbols,
          timeframe: dto.timeframe,
          from: new Date(from),
          to: new Date(to),
          train: dto.train,
          test: dto.test,
          anchored: dto.anchored,
          sort: dto.sort,
          minTrades: dto.minTrades,
          initialCash: dto.cash,
          slippageBps: dto.slippageBps,
          feePerShare: dto.feePerShare,
          cashYieldPct: dto.cashYieldPct,
          newsGateTone: dto.newsGateTone,
        },
        { ai: dto.ai },
      ),
    );
    return walkForwardResponse(job);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Recent HTML reports, newest first' })
  reports() {
    return listReports();
  }
}
