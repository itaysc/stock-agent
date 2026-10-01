import { Injectable } from '@nestjs/common';
import { BacktestService } from '../backtest/backtest.service.js';
import type { TestPlan } from '../backtest/plans/test-plan.js';
import {
  type Bars,
  WalkForwardService,
} from '../backtest/walkforward/walkforward.service.js';
import type { WalkForwardResult } from '../backtest/walkforward/walkforward.types.js';
import { RESEARCH_AGENT_LLM } from '../llm/llm.presets.js';
import { LlmService } from '../llm/llm.service.js';
import {
  AGENT_SYSTEM_PROMPT,
  type Baseline,
  roundPrompt,
  VERDICT_SYSTEM_PROMPT,
  verdictPrompt,
} from './research-prompts.js';
import { baselineOf, barsBefore, walkForwardRequest } from './research-runs.js';
import { reviewProposals } from './research-review.js';
import { basketSymbols, listBaskets } from './robustness/baskets.js';
import { RobustnessService } from './robustness/robustness.service.js';
import type { RobustnessResult } from './robustness/robustness.types.js';
import { MIN_TRADES, outcomeOf, ranked, scoreOf } from './research-score.js';
import type { Experiment, ResearchSession } from './research.types.js';

interface AgentAnswer {
  thinking?: unknown;
  tests?: unknown;
  done?: unknown;
  ideas?: unknown;
}
interface RawVerdict {
  headline?: unknown;
  points?: unknown;
  recommendation?: unknown;
}

const text = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';
const texts = (v: unknown, max: number, count: number) =>
  (Array.isArray(v) ? v : [])
    .map((x) => text(x, max))
    .filter(Boolean)
    .slice(0, count);

/**
 * The research loop: the AI proposes walk-forward tests from the test menu,
 * the system runs and scores them on the research period, the AI learns from
 * the results and proposes more. The best test then runs once on the holdout,
 * which no test has seen, and the AI writes the verdict.
 */
@Injectable()
export class ResearchAgent {
  constructor(
    private readonly backtests: BacktestService,
    private readonly walkForwards: WalkForwardService,
    private readonly llm: LlmService,
    private readonly robustness: RobustnessService,
  ) {}

  /** Fills in `session`, calling `save` after every step. Returns the holdout run (for the report). */
  async run(
    session: ResearchSession,
    save: () => Promise<void>,
  ): Promise<WalkForwardResult | null> {
    const r = session.request;
    if (!this.llm.isConfigured()) {
      throw new Error('The research agent needs OPENAI_API_KEY in .env');
    }
    // News (and earnings, when available) in case the agent tries those blocks.
    const rules = r.strategies.includes('rules');
    const bars = await this.backtests.fetchBars(r.symbols, r, {
      news: rules || (r.newsGateTone ?? 0) > 0,
      earnings: rules && this.backtests.earningsAvailable,
    });
    // SPY for the market filter, in case the agent turns it on.
    const market = await this.backtests.fetchMarket(
      r.strategies.includes('rules'),
      r,
    );
    const researchBars = barsBefore(bars, session.researchTo);
    const researchMarket = barsBefore(market, session.researchTo);
    const baseline = baselineOf(researchBars, r, session.researchTo);
    const seen = new Set<string>();
    let idle = 0;

    for (let round = 1; round <= r.rounds && !session.stoppedBecause; round++) {
      const answer = await this.plan(session, round, baseline);
      const { accepted, rejected } = reviewProposals(
        answer.tests,
        session,
        seen,
      );
      session.rounds.push({
        round,
        thinking: text(answer.thinking, 1_200),
        rejected,
        ideas: texts(answer.ideas, 300, 3),
      });
      await save();
      for (const plan of accepted) {
        session.experiments.push(
          await this.experiment(
            session,
            round,
            plan,
            researchBars,
            researchMarket,
          ),
        );
        await save();
      }
      idle = accepted.length ? 0 : idle + 1;
      if (answer.done === true && ranked(session.experiments).length) {
        session.stoppedBecause = 'the agent found nothing more worth testing';
      } else if (idle >= 2) {
        session.stoppedBecause = 'two rounds without a valid new test';
      }
    }
    session.stoppedBecause ??= `used all ${r.rounds} rounds`;

    const champion = ranked(session.experiments)[0];
    if (!champion)
      throw new Error(
        'No test ran successfully, so there is nothing to check on the holdout',
      );
    session.championId = champion.id;
    const holdout = await this.walkForwards.run(
      walkForwardRequest(champion.plan, r, {
        researchTo: session.researchTo,
        holdout: true,
      }),
      bars,
      market,
    );
    const outcome = outcomeOf(holdout);
    session.holdout = { outcome, score: scoreOf(r.goal, outcome) };
    await save();
    session.robustness = await this.checkBasket(session, champion.plan);
    session.candidate =
      session.holdout.score > 0 && session.robustness?.summary.passed === true;
    await save();
    session.verdict = await this.verdict(session);
    return holdout;
  }

  private async plan(
    session: ResearchSession,
    round: number,
    baseline: Baseline,
  ): Promise<AgentAnswer> {
    try {
      const { data } = await this.llm.askJson<AgentAnswer>({
        ...RESEARCH_AGENT_LLM,
        systemMsg: AGENT_SYSTEM_PROMPT,
        prompt: roundPrompt(
          session,
          round,
          baseline,
          this.backtests.earningsAvailable
            ? []
            : [
                'The earnings blocks (earningsAvoid, earningsExit, surpriseMin) are NOT available in this session (no earnings data): leave them at 0.',
              ],
        ),
      });
      return data ?? {};
    } catch (err) {
      return {
        thinking: `(The AI request failed: ${(err as Error).message})`,
        tests: [],
      };
    }
  }

  private async experiment(
    session: ResearchSession,
    round: number,
    plan: TestPlan,
    bars: Bars,
    market: Bars,
  ): Promise<Experiment> {
    const r = session.request;
    const e: Experiment = { id: session.experiments.length + 1, round, plan };
    try {
      const result = await this.walkForwards.run(
        walkForwardRequest(plan, r, { researchTo: session.researchTo }),
        bars,
        market,
      );
      e.outcome = outcomeOf(result);
      e.score = scoreOf(r.goal, e.outcome);
      e.weak = e.outcome.trades < MIN_TRADES;
    } catch (err) {
      e.error = (err as Error).message;
    }
    return e;
  }

  /** The multi-symbol check of the best test (null when skipped or it failed to run). */
  private async checkBasket(
    session: ResearchSession,
    plan: TestPlan,
  ): Promise<RobustnessResult | null> {
    const r = session.request;
    if (!r.basket) return null;
    try {
      if (plan.strategies.includes('momentum-rotation')) {
        // A rotation works on a group: check it on the other groups instead.
        const own = [...r.symbols].sort().join();
        const universes = listBaskets()
          .filter((b) => [...b.symbols].sort().join() !== own)
          .map((b) => ({ label: b.name, symbols: b.symbols }));
        return await this.robustness.runUniverses(
          { ...r, plan, symbols: [] },
          universes,
        );
      }
      return await this.robustness.run({
        ...r,
        plan,
        symbols: basketSymbols(r.basket),
      });
    } catch {
      return null;
    }
  }

  private async verdict(
    session: ResearchSession,
  ): Promise<ResearchSession['verdict']> {
    try {
      const { data, response } = await this.llm.askJson<RawVerdict>({
        ...RESEARCH_AGENT_LLM,
        reasoningEffort: 'low',
        systemMsg: VERDICT_SYSTEM_PROMPT,
        prompt: verdictPrompt(session),
      });
      return {
        headline: text(data.headline, 300),
        points: texts(data.points, 300, 5),
        recommendation: text(data.recommendation, 600),
        model: response.model,
      };
    } catch {
      return null;
    }
  }
}
