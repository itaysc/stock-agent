import { rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createMockAlpaca } from '@alpacahq/alpaca-trade-api/testing';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ALPACA_CLIENT } from '../src/alpaca/alpaca.constants.js';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { REPORTS_DIR } from '../src/backtest/jobs/report-paths.js';

/** 120 daily bars of a wave, so the SMA crossover trades. */
function barsFor(symbol: string) {
  return Array.from({ length: 120 }, (_, i) => {
    const close = 100 + 20 * Math.sin(i / 6);
    const t = new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString();
    return {
      t,
      o: close,
      h: close + 1,
      l: close - 1,
      c: close,
      v: 1000,
      S: symbol,
    };
  });
}

describe('Backtest API (e2e)', () => {
  let app: INestApplication<App>;
  const written: string[] = [];

  beforeAll(async () => {
    const alpaca = createMockAlpaca([
      {
        path: '/v2/account',
        body: {
          id: 'acc-1',
          status: 'ACTIVE',
          cash: '100000',
          equity: '100000',
        },
      },
      { path: '/v2/positions', body: [] },
      { path: '/v1beta1/news', body: { news: [], next_page_token: null } },
      {
        path: '/v2/stocks/bars',
        respond: ({ url }) => {
          const symbols = (url.searchParams.get('symbols') ?? '').split(',');
          return {
            bars: Object.fromEntries(symbols.map((s) => [s, barsFor(s)])),
            next_page_token: null,
          };
        },
      },
    ]);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ALPACA_CLIENT)
      .useValue(alpaca)
      .compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await Promise.all(
      written.map((f) => rm(join(REPORTS_DIR, f), { force: true })),
    );
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('GET /api/v1/backtests/options lists strategies and settings', async () => {
    const res = await http().get('/api/v1/backtests/options').expect(200);
    expect(res.body.strategies.map((s: { name: string }) => s.name)).toEqual([
      'sma-crossover',
      'rsi-reversion',
      'rules',
      'momentum-rotation',
    ]);
    expect(res.body.strategies[0].params).toContainEqual(
      expect.objectContaining({
        name: 'fast',
        default: 20,
        min: 1,
        lessThan: 'slow',
      }),
    );
    expect(res.body).toMatchObject({
      aiEnabled: false,
      dataFeed: 'iex',
      maxCombinations: 2000,
    });
  });

  it('rejects invalid input with 400 before doing any work', async () => {
    const bad = await http()
      .post('/api/v1/backtests')
      .send({ symbols: ['not a symbol'], timeframe: '1d' })
      .expect(400);
    expect(bad.body.message).toEqual(
      expect.arrayContaining([
        'invalid symbol',
        'timeframe like 15Min, 1Hour, 1Day',
      ]),
    );
    const unknown = await http()
      .post('/api/v1/backtests')
      .send({
        symbols: ['AAPL'],
        strategy: 'nope',
        from: '2025-01-01',
        to: '2025-06-01',
      })
      .expect(400);
    expect(unknown.body.message).toMatch(/Unknown strategy "nope"/);
  });

  it('runs a backtest, saves it, and serves its report with a strict CSP', async () => {
    const body = {
      symbols: ['aapl'],
      params: { fast: 5, slow: 15 }, // full allocation: gap-up buys get reduced, not rejected
      from: '2025-01-01',
      to: '2025-06-01',
    };
    const res = await http().post('/api/v1/backtests').send(body).expect(200);
    written.push(basename(res.body.reportUrl));

    expect(res.body).toMatchObject({
      kind: 'backtest',
      history: { kind: 'new' },
      symbols: ['AAPL'],
      aiSummary: null,
      aiSkipped: expect.stringContaining('OPENAI_API_KEY'),
    });
    expect(res.body.metrics.trades).toBeGreaterThan(0);
    expect(
      (await http().post('/api/v1/backtests').send(body)).body.history.kind,
    ).toBe('reused');

    const report = await http().get(res.body.reportUrl).expect(200);
    expect(report.text).toContain(
      '<title>Backtest: sma-crossover on AAPL</title>',
    );
    expect(report.headers['content-security-policy']).toContain(
      "script-src 'unsafe-inline'",
    );
    expect(report.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
  });

  it('runs a sweep from range specs and lists reports newest first', async () => {
    const res = await http()
      .post('/api/v1/sweeps')
      .send({
        symbols: ['AAPL'],
        params: { fast: '3..9:3', slow: '20' },
        from: '2025-01-01',
        to: '2025-06-01',
      })
      .expect(200);
    written.push(basename(res.body.reportUrl));
    expect(res.body).toMatchObject({ kind: 'sweep', runs: 3, skipped: 0 });
    expect(res.body.top[0]).not.toHaveProperty('command');

    const reports = await http().get('/api/v1/reports').expect(200);
    expect(reports.body[0]).toMatchObject({
      kind: 'sweep',
      url: res.body.reportUrl,
      symbols: ['AAPL'],
    });
  });

  it('turns a bad sweep grid into a 400', async () => {
    const res = await http()
      .post('/api/v1/sweeps')
      .send({ symbols: ['AAPL'], params: { fast: '1..100000' } })
      .expect(400);
    expect(res.body.message).toMatch(/combinations/);
  });

  it('runs a walk-forward test and serves its report', async () => {
    const res = await http()
      .post('/api/v1/walkforwards')
      .send({
        symbols: ['AAPL'],
        params: { fast: '3,5', slow: '10,20' },
        train: '2m',
        test: '1m',
        from: '2025-01-01',
        to: '2025-05-01',
      })
      .expect(200);
    written.push(basename(res.body.reportUrl));
    expect(res.body).toMatchObject({
      kind: 'walkforward',
      symbols: ['AAPL'],
      setup: 'train 2 months, test 1 month (rolling), best by return-dd',
      oosFrom: '2025-03-01T00:00:00.000Z',
      aiSkipped: expect.stringContaining('OPENAI_API_KEY'),
    });
    expect(res.body.windows).toHaveLength(2);
    expect(res.body.windows[0].chosen.params).toHaveProperty('fast');

    const report = await http().get(res.body.reportUrl).expect(200);
    expect(report.text).toContain(
      '<title>Walk-forward: sma-crossover on AAPL</title>',
    );
    const reports = await http().get('/api/v1/reports').expect(200);
    expect(reports.body[0]).toMatchObject({
      kind: 'walkforward',
      strategy: 'sma-crossover',
    });
  });

  it('validates walk-forward windows', async () => {
    const bad = await http()
      .post('/api/v1/walkforwards')
      .send({ symbols: ['AAPL'], train: '12 months' })
      .expect(400);
    expect(bad.body.message).toContain('train like 90d, 26w, 12m or 2y');
    const short = await http()
      .post('/api/v1/walkforwards')
      .send({ symbols: ['AAPL'], from: '2025-01-01', to: '2025-06-01' })
      .expect(400);
    expect(short.body.message).toMatch(/too short/);
  });

  it('starts a research session in the background and reports its outcome', async () => {
    const res = await http()
      .post('/api/v1/research')
      .send({
        symbols: ['aapl'],
        from: '2020-01-01',
        to: '2025-06-01',
        rounds: 2,
      })
      .expect(202);
    expect(res.body).toMatchObject({
      status: 'running',
      request: {
        symbols: ['AAPL'],
        goal: 'risk-adjusted',
        holdout: '12m',
        rounds: 2,
      },
      researchTo: '2024-06-01T00:00:00.000Z',
    });
    expect(res.body.request.strategies).toContain('rules');

    // No OPENAI_API_KEY in tests: the session fails with a clear reason.
    let session = res.body;
    for (let i = 0; i < 20 && session.status === 'running'; i++) {
      await new Promise((r) => setTimeout(r, 50));
      session = (
        await http().get(`/api/v1/research/${res.body.id}`).expect(200)
      ).body;
    }
    expect(session).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('OPENAI_API_KEY'),
    });
    const list = await http().get('/api/v1/research').expect(200);
    expect(list.body[0]).toMatchObject({
      id: res.body.id,
      status: 'failed',
      symbols: ['AAPL'],
    });
    await http().get('/api/v1/research/nope').expect(404);
  });

  it('validates research settings', async () => {
    const bad = await http()
      .post('/api/v1/research')
      .send({ symbols: ['AAPL'], holdout: 'a year', rounds: 50 })
      .expect(400);
    expect(bad.body.message).toEqual(
      expect.arrayContaining([
        'holdout like 6m, 12m or 1y',
        'rounds must not be greater than 10',
      ]),
    );
    const short = await http()
      .post('/api/v1/research')
      .send({ symbols: ['AAPL'], from: '2024-01-01', to: '2025-06-01' })
      .expect(400);
    expect(short.body.message).toMatch(/research period .* needs at least 9/);
  });

  it('runs the multi-symbol check, each symbol on its own', async () => {
    const options = await http().get('/api/v1/backtests/options').expect(200);
    expect(options.body.baskets.map((b: { id: string }) => b.id)).toEqual([
      'megacaps',
      'sectors',
      'indexes',
    ]);
    const res = await http()
      .post('/api/v1/robustness')
      .send({
        symbols: ['AAPL', 'MSFT'],
        strategies: ['sma-crossover'],
        params: { fast: '3,5', slow: '10' },
        train: '2m',
        test: '1m',
        from: '2025-01-01',
        to: '2025-05-01',
      })
      .expect(200);
    expect(res.body.rows.map((r: { symbol: string }) => r.symbol)).toEqual([
      'AAPL',
      'MSFT',
    ]);
    expect(res.body.summary).toMatchObject({
      tested: 2,
      verdict: expect.stringMatching(/of 2 symbols/),
    });
    expect(res.body.label).toContain('sma-crossover fast=3,5 slow=10');
  });

  it('runs a portfolio of sleeves and validates the shares', async () => {
    const res = await http()
      .post('/api/v1/portfolios')
      .send({
        sleeves: [
          {
            strategy: 'sma-crossover',
            symbols: ['aapl'],
            params: { fast: 5, slow: 15 },
            weightPct: 50,
          },
          {
            strategy: 'rsi-reversion',
            symbols: ['MSFT'],
            params: { trend: 0 },
            weightPct: 30,
          },
        ],
        maxDrawdownPct: 10,
        from: '2025-01-01',
        to: '2025-06-01',
      })
      .expect(200);
    written.push(basename(res.body.reportUrl));
    expect(res.body).toMatchObject({
      kind: 'portfolio',
      reserve: { allocated: 20_000 },
      risk: { maxDrawdownPct: 10, cooldownDays: 20 },
    });
    expect(res.body.sleeves.map((s: { label: string }) => s.label)).toEqual([
      '50% sma-crossover on AAPL (fast=5 slow=15)',
      '30% rsi-reversion on MSFT (trend=0)',
    ]);
    expect(res.body.correlation).toHaveLength(2);
    const report = await http().get(res.body.reportUrl).expect(200);
    expect(report.text).toContain('<title>Portfolio: 2 sleeves</title>');

    const bad = await http()
      .post('/api/v1/portfolios')
      .send({
        sleeves: [{ strategy: 'rules', symbols: ['AAPL'], weightPct: 150 }],
      })
      .expect(400);
    expect(bad.body.message).toEqual(
      expect.arrayContaining([
        'sleeves.0.weightPct must not be greater than 100',
      ]),
    );
  });

  it('deploys to the paper account, one owner per symbol, within the free cash', async () => {
    const sleeves = [
      {
        strategy: 'sma-crossover',
        symbols: ['NVDA'],
        params: { fast: 5, slow: 15 },
        weightPct: 80,
      },
    ];
    const res = await http()
      .post('/api/v1/paper/deployments')
      .send({ name: 'Test deploy', capital: 20_000, sleeves })
      .expect(201);
    expect(res.body).toMatchObject({
      name: 'Test deploy',
      status: 'active',
      capital: 20_000,
      equity: 20_000,
      reserve: 4_000,
      health: 'warming-up',
      sleeves: [
        { label: '80% sma-crossover on NVDA (fast=5 slow=15)', cash: 16_000 },
      ],
    });
    expect(res.body.expectation.maxDrawdownPct).toBeGreaterThanOrEqual(0);
    expect(res.body.maxDrawdownPct).toBeGreaterThanOrEqual(10);
    expect(res.body.events[0].message).toMatch(
      /^Deployed with \$20,000 of paper money/,
    );

    const clash = await http()
      .post('/api/v1/paper/deployments')
      .send({ capital: 1_000, sleeves })
      .expect(400);
    expect(clash.body.message).toBe(
      'Already traded by another deployment: NVDA',
    );
    const tooBig = await http()
      .post('/api/v1/paper/deployments')
      .send({ capital: 90_000, sleeves: [{ ...sleeves[0], symbols: ['AMD'] }] })
      .expect(400);
    expect(tooBig.body.message).toMatch(
      /Not enough free paper cash: \$80,000 left/,
    );

    const account = await http().get('/api/v1/paper/account').expect(200);
    expect(account.body).toMatchObject({
      paper: true,
      runnerOn: false,
      committed: 20_000,
      free: 80_000,
    });

    const id = res.body.id;
    await http().post(`/api/v1/paper/deployments/${id}/resume`).expect(400); // not paused
    expect(
      (await http().post(`/api/v1/paper/deployments/${id}/pause`).expect(200))
        .body.status,
    ).toBe('paused');
    expect(
      (await http().post(`/api/v1/paper/deployments/${id}/resume`).expect(200))
        .body.status,
    ).toBe('active');
    const stopped = await http()
      .post(`/api/v1/paper/deployments/${id}/stop`)
      .expect(200);
    expect(stopped.body).toMatchObject({
      status: 'stopped',
      statusReason: expect.stringContaining('Stopped by you'),
    });
    const list = await http().get('/api/v1/paper/deployments').expect(200);
    expect(list.body[0]).toMatchObject({ id, status: 'stopped' });

    await http()
      .post('/api/v1/paper/deployments/from-research')
      .send({
        researchId: '00000000-0000-4000-8000-000000000000',
        capital: 1_000,
      })
      .expect(404);
  });

  it('configures and runs the autopilot (off until turned on)', async () => {
    const initial = await http().get('/api/v1/autopilot').expect(200);
    expect(initial.body).toMatchObject({
      settings: { enabled: false, everyDays: 7, maxDeployments: 3 },
      running: null,
      schedulerOn: false,
      notifyOn: false,
    });
    const updated = await http()
      .put('/api/v1/autopilot')
      .send({ enabled: true, watchlist: ['spy'], symbolsPerRun: 1 })
      .expect(200);
    expect(updated.body.settings).toMatchObject({
      enabled: true,
      watchlist: ['SPY'],
      symbolsPerRun: 1,
    });
    await http()
      .put('/api/v1/autopilot')
      .send({ maxDeployments: 99 })
      .expect(400);

    const run = await http().post('/api/v1/autopilot/run').expect(202);
    expect(run.body).toMatchObject({ trigger: 'manual', status: 'running' });
    let state = updated.body;
    for (
      let i = 0;
      i < 40 && (state.running || state.runs[0]?.id !== run.body.id);
      i++
    ) {
      await new Promise((r) => setTimeout(r, 50));
      state = (await http().get('/api/v1/autopilot')).body;
    }
    // No OpenAI key in tests: the research fails, and the run says so.
    expect(state.runs[0]).toMatchObject({ id: run.body.id, status: 'done' });
    expect(state.runs[0].decisions).toContainEqual(
      expect.objectContaining({
        kind: 'error',
        message: expect.stringContaining('OPENAI_API_KEY'),
      }),
    );
    await http().put('/api/v1/autopilot').send({ enabled: false }).expect(200);
  });
});
