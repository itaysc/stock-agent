import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import { makeBars } from '../../../test/support/bars.js';
import type { StrategyBar } from '../../strategies/strategy.types.js';
import { ENGINE_VERSION } from '../backtest-engine.js';
import { formatReport } from '../backtest-report.js';
import { type BacktestRequest, BacktestService } from '../backtest.service.js';
import { BacktestRun, BacktestRunSchema } from './backtest-run.schema.js';
import {
  BacktestHistoryService,
  MAX_STORED_POINTS,
} from './backtest-history.service.js';

const wave = Array.from({ length: 120 }, (_, i) => 100 + 20 * Math.sin(i / 6));
const request: BacktestRequest = {
  strategy: 'sma-crossover',
  symbols: ['AAPL'],
  params: {},
  timeframe: '1Day',
  from: new Date('2025-01-01'),
  to: new Date('2025-06-01'),
  initialCash: 10_000,
  slippageBps: 5,
  feePerShare: 0,
};
const summary = { headline: 'h', points: [], recommendation: 'r', model: 'm' };

describe('BacktestHistoryService', () => {
  let mongo: MongoMemoryServer;
  let moduleRef: TestingModule;
  let history: BacktestHistoryService;
  let runs: Model<BacktestRun>;
  let bars: Record<string, StrategyBar[]>;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongo.getUri('history-test')),
        MongooseModule.forFeature([
          { name: BacktestRun.name, schema: BacktestRunSchema },
        ]),
      ],
      providers: [
        BacktestHistoryService,
        {
          provide: BacktestService,
          useValue: {
            fetchBars: async () => bars,
            fetchMarket: async () => ({}),
          },
        },
      ],
    }).compile();
    await moduleRef.init();
    history = moduleRef.get(BacktestHistoryService);
    runs = moduleRef.get(getModelToken(BacktestRun.name));
  });
  afterAll(async () => {
    await moduleRef.close();
    await mongo.stop();
  });
  beforeEach(async () => {
    bars = { AAPL: makeBars('AAPL', wave) };
    await runs.deleteMany({});
  });

  const saved = async () => runs.findOne().lean<BacktestRun>();
  const smallParams = { ...request, params: { fast: '5', slow: '15' } };

  it('saves a new test with its versions and data hash', async () => {
    const run = await history.run(smallParams);

    expect(run.status).toEqual({ kind: 'new' });
    const doc = await saved();
    expect(doc).toMatchObject({
      fingerprint: run.fingerprint,
      engineVersion: ENGINE_VERSION,
      strategyVersion: 1,
      strategy: 'sma-crossover',
      params: { fast: 5, slow: 15, allocation: 1 },
      symbols: ['AAPL'],
      requestCount: 1,
    });
    expect(doc?.dataHash).toMatch(/^[0-9a-f]{64}$/);
    expect(doc?.result?.fills.length).toBe(run.result.fills.length);
    expect(doc?.result?.fills[0].timestamp).toBeInstanceOf(Date);
  });

  it('reuses an identical test, counting the request', async () => {
    const first = await history.run(smallParams);
    const second = await history.run(smallParams);

    expect(second.status).toMatchObject({ kind: 'reused' });
    expect(second.result.metrics).toEqual(first.result.metrics);
    // Optional fields come back absent, not null, so reports render the same.
    expect(second.result.fills).toEqual(first.result.fills);
    expect(second.result.fills[0]).not.toHaveProperty('realizedPnl');
    expect(formatReport(second.result)).toBe(formatReport(first.result));
    expect((await saved())?.requestCount).toBe(2);
    expect(await runs.countDocuments()).toBe(1);
  });

  it('treats explicit default params as the same test', async () => {
    await history.run(request);
    const explicit = await history.run({
      ...request,
      params: { fast: '20', slow: '50' },
    });
    expect(explicit.status.kind).toBe('reused');
  });

  it('re-runs and replaces a record from an older engine or strategy version', async () => {
    const { fingerprint } = await history.run(smallParams);
    await history.saveAiSummary(fingerprint, summary);

    await runs.updateOne({}, { $set: { engineVersion: 0 } });
    const engine = await history.run(smallParams);
    expect(engine.status).toEqual({
      kind: 'replaced',
      reason: `engine v0 → v${ENGINE_VERSION}`,
    });
    expect(await saved()).toMatchObject({ engineVersion: ENGINE_VERSION });
    expect((await saved())?.aiSummary).toBeUndefined(); // old summary described the old result

    await runs.updateOne({}, { $set: { strategyVersion: 0 } });
    const strategy = await history.run(smallParams);
    expect(strategy.status).toEqual({
      kind: 'replaced',
      reason: 'sma-crossover v0 → v1',
    });
    expect(await runs.countDocuments()).toBe(1);
  });

  it('re-runs when the market data changed', async () => {
    await history.run(smallParams);
    bars = {
      AAPL: makeBars(
        'AAPL',
        wave.map((p) => p * 1.01),
      ),
    };
    const run = await history.run(smallParams);
    expect(run.status).toEqual({
      kind: 'replaced',
      reason: 'the market data changed',
    });
  });

  it('re-runs on --fresh', async () => {
    await history.run(smallParams);
    expect((await history.run(smallParams, { fresh: true })).status).toEqual({
      kind: 'forced',
    });
  });

  it('returns the saved AI summary with a reused run', async () => {
    const { fingerprint } = await history.run(smallParams);
    await history.saveAiSummary(fingerprint, summary);
    expect((await history.run(smallParams)).aiSummary).toEqual(summary);
  });

  it('keeps only metrics for results too large to store, and re-runs them', async () => {
    const long = Array.from(
      { length: MAX_STORED_POINTS + 1 },
      (_, i) => 100 + Math.sin(i / 9),
    );
    bars = { AAPL: makeBars('AAPL', long, '1900-01-01') };
    await history.run(smallParams);

    const doc = await saved();
    expect(doc?.result).toBeUndefined();
    expect(doc?.metrics.totalReturnPct).toEqual(expect.any(Number));
    expect((await history.run(smallParams)).status).toEqual({
      kind: 'replaced',
      reason: 'the saved record had no full result',
    });
  });
});
