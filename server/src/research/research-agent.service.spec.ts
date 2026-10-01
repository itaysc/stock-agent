import { makeBars } from '../../test/support/bars.js';
import type { BacktestService } from '../backtest/backtest.service.js';
import { WalkForwardService } from '../backtest/walkforward/walkforward.service.js';
import type { LlmService } from '../llm/llm.service.js';
import { ResearchAgent } from './research-agent.service.js';
import { RobustnessService } from './robustness/robustness.service.js';
import { holdoutStart } from './research-runs.js';
import type { ResearchRequest, ResearchSession } from './research.types.js';

// 5 years of daily bars: a wavy uptrend, so strategies trade and differ.
const closes = Array.from(
  { length: 1_826 },
  (_, i) => 100 + i * 0.05 + 12 * Math.sin(i / 15) + 5 * Math.sin(i / 4),
);
const bars = { AAPL: makeBars('AAPL', closes, '2021-01-01') };

const request: ResearchRequest = {
  symbols: ['AAPL'],
  timeframe: '1Day',
  from: new Date('2021-01-01'),
  to: new Date('2026-01-01'),
  holdout: '12m',
  strategies: ['sma-crossover', 'rsi-reversion', 'rules'],
  goal: 'risk-adjusted',
  rounds: 4,
  testsPerRound: 2,
  initialCash: 10_000,
  slippageBps: 5,
  feePerShare: 0,
  cashYieldPct: 3,
  basket: null,
};

const wf = (strategies: string[], params: Record<string, string>) => ({
  kind: 'walkforward',
  strategies,
  params,
  train: '12m',
  test: '3m',
  sort: 'return-dd',
  minTrades: 0,
  why: 'test',
});
const sma = wf(['sma-crossover'], { fast: '5,10', slow: '30,50' });

function setup(answers: unknown[], configured = true) {
  const askJson = vi.fn();
  for (const data of answers)
    askJson.mockResolvedValueOnce({ data, response: { model: 'test-model' } });
  const llm = {
    isConfigured: () => configured,
    askJson,
  } as unknown as LlmService;
  const backtests = {
    fetchBars: async () => bars,
    fetchMarket: async () => ({}),
  } as unknown as BacktestService;
  const walkForwards = new WalkForwardService(backtests);
  const run = vi.spyOn(walkForwards, 'run');
  const robustness = new RobustnessService(backtests, walkForwards);
  const agent = new ResearchAgent(backtests, walkForwards, llm, robustness);
  const session: ResearchSession = {
    id: 'test',
    status: 'running',
    request,
    researchTo: holdoutStart(request),
    rounds: [],
    experiments: [],
    championId: null,
    holdout: null,
    robustness: null,
    candidate: false,
    verdict: null,
    stoppedBecause: null,
    reportUrl: null,
    error: null,
    startedAt: new Date(),
    finishedAt: null,
  };
  return { agent, session, askJson, run };
}

describe('ResearchAgent', () => {
  it('runs rounds of AI-proposed tests, then checks the best one on the holdout', async () => {
    const { agent, session, askJson, run } = setup([
      {
        thinking: 'Start broad.',
        tests: [
          sma,
          wf(['magic'], {}),
          sma,
          wf(['rules'], { trendSma: '0,100', trailingStop: '8,12' }),
          wf(['rsi-reversion'], {}),
        ],
        ideas: ['Try a MACD block'],
      },
      {
        thinking: 'Refine.',
        tests: [wf(['rsi-reversion'], { oversold: '25,35' })],
        done: true,
      },
      {
        headline: 'Did not hold up.',
        points: ['one'],
        recommendation: 'Test other symbols.',
      },
    ]);
    const save = vi.fn(async () => undefined);
    const holdout = await agent.run(session, save);

    expect(session.rounds.map((r) => r.thinking)).toEqual([
      'Start broad.',
      'Refine.',
    ]);
    expect(session.rounds[0].ideas).toEqual(['Try a MACD block']);
    expect(session.rounds[0].rejected).toEqual([
      expect.stringMatching(/^proposal 2: unknown strategy "magic"/),
      'proposal 3: already tested',
      'proposal 5: over the 2 tests per round',
    ]);
    expect(session.experiments.map((e) => e.plan.strategies[0])).toEqual([
      'sma-crossover',
      'rules',
      'rsi-reversion',
    ]);
    expect(
      session.experiments.every(
        (e) => e.outcome && e.outcome.to <= session.researchTo,
      ),
    ).toBe(true);
    expect(session.stoppedBecause).toBe(
      'the agent found nothing more worth testing',
    );

    // The champion is the best-ranked test, and only it runs on the holdout.
    const best = [...session.experiments].sort(
      (a, b) =>
        Number(a.weak) - Number(b.weak) || (b.score ?? 0) - (a.score ?? 0),
    )[0];
    expect(session.championId).toBe(best.id);
    expect(session.holdout?.outcome.from).toEqual(session.researchTo);
    expect(session.holdout?.outcome.to).toEqual(request.to);
    expect(holdout?.strategies).toEqual(best.plan.strategies);
    expect(session.robustness).toBeNull(); // no basket in this session
    expect(session.candidate).toBe(false);
    expect(session.verdict).toMatchObject({
      headline: 'Did not hold up.',
      model: 'test-model',
    });

    // Research tests only ever get bars from before the holdout.
    const calls = run.mock.calls;
    for (const [, given] of calls.slice(0, -1)) {
      expect(
        Math.max(...(given?.AAPL ?? []).map((b) => b.timestamp.getTime())),
      ).toBeLessThan(session.researchTo.getTime());
    }
    // The agent saw its results and rejections in the next round.
    const [, [round2]] = askJson.mock.calls as unknown as [
      unknown,
      [{ prompt: string }],
    ];
    expect(round2.prompt).toContain('EXPERIMENTS SO FAR (best first):');
    expect(round2.prompt).toContain('REJECTED LAST ROUND');
    expect(round2.prompt).toContain(
      '#1 (round 1) sma-crossover fast=5,10 slow=30,50',
    );
    expect(save.mock.calls.length).toBeGreaterThanOrEqual(6);
  });

  it('stops after two rounds without a valid test, and fails when nothing ran', async () => {
    const { agent, session } = setup([
      { tests: [] },
      { tests: [wf(['magic'], {})] },
    ]);
    await expect(agent.run(session, async () => undefined)).rejects.toThrow(
      /No test ran successfully/,
    );
    expect(session.stoppedBecause).toBe('two rounds without a valid new test');
    expect(session.rounds).toHaveLength(2);
  });

  it('needs the OpenAI key', async () => {
    const { agent, session } = setup([], false);
    await expect(agent.run(session, async () => undefined)).rejects.toThrow(
      /OPENAI_API_KEY/,
    );
  });
});
