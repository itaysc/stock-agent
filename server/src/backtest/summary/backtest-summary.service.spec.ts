import { makeBars } from '../../../test/support/bars.js';
import type { LlmService } from '../../llm/llm.service.js';
import type { Strategy } from '../../strategies/strategy.types.js';
import { runBacktest } from '../backtest-engine.js';
import type { SweepResult } from '../sweep/sweep.service.js';
import { formatAiSummary, renderAiSummaryHtml } from './ai-summary.format.js';
import { BacktestSummaryService } from './backtest-summary.service.js';
import { backtestFacts, sweepFacts } from './summary-prompts.js';

// Buys 10 at 100, sells at 120 (+200), buys 10 again at 110, still open at 130 (+200).
function sampleResult() {
  let i = 0;
  const strategy: Strategy = {
    name: 'test',
    symbols: ['AAPL'],
    onBar: (_bar, ctx) => {
      if (i === 0 || i === 3) ctx.buy('AAPL', 10, 'signal');
      if (i === 2) ctx.sell('AAPL', 10, 'signal');
      i++;
    },
  };
  return runBacktest(
    strategy,
    { AAPL: makeBars('AAPL', [[100, 100], 110, 120, 110, 115, 130]) },
    { initialCash: 10_000, slippageBps: 0, feePerShare: 0 },
  );
}
const ctx = { timeframe: '1Day', params: { fast: '10' }, slippageBps: 5 };

function service(answer: unknown, configured = true) {
  const askJson = vi.fn(async () => ({
    data: answer,
    response: { model: 'gpt-4o-mini' },
  }));
  const llm = {
    isConfigured: () => configured,
    askJson,
  } as unknown as LlmService;
  return { summaries: new BacktestSummaryService(llm), askJson };
}

describe('summary prompts', () => {
  it('describes the backtest with the numbers that matter', () => {
    const facts = backtestFacts(sampleResult(), ctx);
    expect(facts).toContain('Strategy: test (params: fast=10)');
    expect(facts).toContain('Total return: +4.00%');
    expect(facts).toContain('Closed trades: 1');
    expect(facts).toContain(
      'Realized P&L from closed trades: $200 | unrealized from open positions: $200',
    );
    expect(facts).toContain('Largest win: $200 (AAPL');
    expect(facts).toContain('Largest loss: none'); // no losing trades
    expect(facts).toContain('Open at the end: 10 AAPL');
    expect(facts).toContain('slippage 5 bps per fill');
  });

  it('describes a sweep per strategy and lists its runs', () => {
    const row = (strategy: string, ret: number) => ({
      strategy,
      params: { fast: String(ret) },
      metrics: {
        totalReturnPct: ret,
        maxDrawdownPct: 5,
        trades: 4,
        profitFactor: 1.5,
      },
      openPositions: ret === 20 ? 1 : 0,
    });
    const facts = sweepFacts(
      {
        symbols: ['AAPL'],
        bars: 100,
        buyAndHoldReturnPct: 12,
        rows: [row('a', 20), row('a', -5), row('a', 8)],
        skipped: [{}],
      } as unknown as SweepResult,
      { timeframe: '1Day', slippageBps: 5, feePerShare: 0 },
    );
    expect(facts).toContain('Runs: 3 (1 invalid combinations skipped)');
    expect(facts).toContain('slippage 5 bps per fill, fees $0 per share');
    expect(facts).toMatch(/fast=20: .*position still open at the end/);
    expect(facts).toMatch(/fast=8: .*flat at the end/);
    expect(facts).toContain(
      'a: 3 runs, median +8.00%, 2 positive, 1 beat buy & hold',
    );
    expect(facts.indexOf('fast=20')).toBeLessThan(facts.indexOf('fast=-5'));
  });
});

describe('BacktestSummaryService', () => {
  it('returns a cleaned-up summary from the model', async () => {
    const { summaries, askJson } = service({
      headline: '  Beat nothing. ',
      points: ['a', '', 42, 'b'],
      recommendation: 'Test more periods.',
    });
    const out = await summaries.summarizeBacktest(sampleResult(), ctx);

    expect(out).toEqual({
      summary: {
        headline: 'Beat nothing.',
        points: ['a', 'b'],
        recommendation: 'Test more periods.',
        model: 'gpt-4o-mini',
      },
    });
    const [[params]] = askJson.mock.calls as unknown as [
      [{ prompt: string; systemMsg: string }],
    ];
    expect(params.prompt).toContain('Summarize this backtest.');
    expect(params.systemMsg).toContain('Never tell the user to buy or sell');
  });

  it('keeps only valid next tests from the menu, with the run’s context', async () => {
    const plan = {
      kind: 'walkforward',
      strategies: ['rules'],
      params: { trendSma: '100,200', trailingStop: '8,12' },
      train: '12m',
      test: '3m',
      sort: 'return-dd',
      minTrades: 2,
      why: 'Does a trend filter help?',
    };
    const { summaries, askJson } = service({
      headline: 'Weak.',
      points: [],
      recommendation: 'Validate it.',
      nextTests: [
        plan,
        { ...plan, strategies: ['magic'] },
        { ...plan, train: '5y' },
      ],
    });
    const testContext = {
      symbols: ['AAPL'],
      from: '2024-01-01',
      to: '2026-01-01',
      timeframe: '1Day',
      initialCash: 100_000,
      slippageBps: 5,
      feePerShare: 0,
      cashYieldPct: 3,
    };
    const out = await summaries.summarizeBacktest(
      sampleResult(),
      ctx,
      testContext,
    );

    if (!('summary' in out)) throw new Error('expected a summary');
    expect(out.summary.nextTests).toEqual([{ ...plan, anchored: false }]);
    expect(out.summary.testContext).toEqual(testContext);
    const [[params]] = askJson.mock.calls as unknown as [[{ prompt: string }]];
    expect(params.prompt).toContain('TEST MENU');
    expect(formatAiSummary(out)).toContain(
      '1. Does a trend filter help?\n     npm run walkforward -- AAPL --strategy rules --param trendSma=100,200 --param trailingStop=8,12',
    );
    expect(renderAiSummaryHtml(out.summary)).toContain(
      '<h3>Suggested next tests</h3>',
    );
  });

  it('asks for no next tests without a run context', async () => {
    const { summaries, askJson } = service({
      headline: 'x',
      recommendation: 'y',
      nextTests: [{}],
    });
    const out = await summaries.summarizeBacktest(sampleResult(), ctx);
    expect(out).toEqual({
      summary: expect.not.objectContaining({ nextTests: expect.anything() }),
    });
    const [[params]] = askJson.mock.calls as unknown as [[{ prompt: string }]];
    expect(params.prompt).not.toContain('TEST MENU');
  });

  it('skips without a key, on errors, and for empty sweeps', async () => {
    const off = await service({}, false).summaries.summarizeBacktest(
      sampleResult(),
      ctx,
    );
    expect(off).toEqual({
      skipped: expect.stringContaining('OPENAI_API_KEY is not set'),
    });

    const { summaries, askJson } = service({});
    askJson.mockRejectedValueOnce(new Error('429 rate limited'));
    expect(await summaries.summarizeBacktest(sampleResult(), ctx)).toEqual({
      skipped: 'AI summary failed: 429 rate limited',
    });
    expect(await summaries.summarizeBacktest(sampleResult(), ctx)).toEqual({
      skipped: 'the model returned an empty summary',
    });
    expect(
      await summaries.summarizeSweep({ rows: [] } as unknown as SweepResult, {
        timeframe: '1Day',
        slippageBps: 5,
        feePerShare: 0,
      }),
    ).toEqual({ skipped: 'no valid runs to summarize' });
  });
});

describe('AI summary output', () => {
  const summary = {
    headline: 'Lagged <b>buy & hold</b>',
    points: ['Few trades'],
    recommendation: 'Sweep params.',
    model: 'gpt-4o-mini',
  };

  it('formats for the terminal', () => {
    expect(formatAiSummary({ summary })).toContain('• Few trades');
    expect(formatAiSummary({ skipped: 'no key' })).toBe(
      'AI summary skipped: no key',
    );
  });

  it('renders escaped HTML, or nothing without a summary', () => {
    const html = renderAiSummaryHtml(summary);
    expect(html).toContain('Lagged &#60;b&#62;buy &#38; hold&#60;/b&#62;');
    expect(html).toContain('<strong>Recommendation:</strong> Sweep params.');
    expect(renderAiSummaryHtml(null)).toBe('');
  });
});
