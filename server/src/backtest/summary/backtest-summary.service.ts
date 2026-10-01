import { Injectable } from '@nestjs/common';
import { BACKTEST_SUMMARY_LLM } from '../../llm/llm.presets.js';
import { LlmService } from '../../llm/llm.service.js';
import type { BacktestResult } from '../backtest-engine.js';
import type { SweepResult } from '../sweep/sweep.service.js';
import type { WalkForwardResult } from '../walkforward/walkforward.types.js';
import { describePlanMenu, type PlanContext } from '../plans/plan-menu.js';
import { checkPlan, type TestPlan } from '../plans/test-plan.js';
import type { PortfolioResult } from '../portfolio/portfolio.types.js';
import { portfolioFacts } from './portfolio-facts.js';
import { walkForwardFacts } from './walkforward-facts.js';
import type { AiSummary, AiSummaryOutcome } from './ai-summary.types.js';
import {
  backtestFacts,
  SUMMARY_SYSTEM_PROMPT,
  type SummaryContext,
  sweepFacts,
  type SweepSummaryContext,
} from './summary-prompts.js';

interface RawSummary {
  headline?: unknown;
  points?: unknown;
  recommendation?: unknown;
  nextTests?: unknown;
}

/** Valid, distinct AI-proposed tests (invalid ones are dropped). */
function validTests(raw: unknown, symbols: string[]): TestPlan[] {
  return (Array.isArray(raw) ? raw : [])
    .map((plan) => checkPlan(plan, symbols))
    .flatMap((check) => ('plan' in check ? [check.plan] : []))
    .slice(0, 3);
}

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/**
 * Short AI review (headline, key points, research recommendation) of a
 * backtest or sweep. Never throws: a missing key or API error becomes a
 * `skipped` reason, so reports still work without the LLM.
 */
@Injectable()
export class BacktestSummaryService {
  constructor(private readonly llm: LlmService) {}

  summarizeBacktest(
    result: BacktestResult,
    ctx: SummaryContext,
    plan?: PlanContext,
  ): Promise<AiSummaryOutcome> {
    return this.summarize(
      `Summarize this backtest.\n\n${backtestFacts(result, ctx)}`,
      plan,
    );
  }

  summarizeSweep(
    result: SweepResult,
    ctx: SweepSummaryContext,
    plan?: PlanContext,
  ): Promise<AiSummaryOutcome> {
    if (result.rows.length === 0) {
      return Promise.resolve({ skipped: 'no valid runs to summarize' });
    }
    return this.summarize(
      `Summarize this parameter sweep.\n\n${sweepFacts(result, ctx)}`,
      plan,
    );
  }

  summarizeWalkForward(
    result: WalkForwardResult,
    plan?: PlanContext,
  ): Promise<AiSummaryOutcome> {
    return this.summarize(
      `Summarize this walk-forward test.\n\n${walkForwardFacts(result)}`,
      plan,
    );
  }

  summarizePortfolio(result: PortfolioResult): Promise<AiSummaryOutcome> {
    return this.summarize(
      `Summarize this portfolio backtest.\n\n${portfolioFacts(result)}`,
    );
  }

  /** With a plan context, the model also proposes next tests from the test menu. */
  private async summarize(
    prompt: string,
    plan?: PlanContext,
  ): Promise<AiSummaryOutcome> {
    if (!this.llm.isConfigured()) {
      return {
        skipped: 'OPENAI_API_KEY is not set (add it to .env, or pass --no-ai)',
      };
    }
    try {
      const { data, response } = await this.llm.askJson<RawSummary>({
        ...BACKTEST_SUMMARY_LLM,
        systemMsg: SUMMARY_SYSTEM_PROMPT,
        prompt: plan
          ? `${prompt}\n\n${describePlanMenu(['walkforward', 'sweep'])}`
          : prompt,
      });
      const summary: AiSummary = {
        headline: text(data.headline, 300),
        points: (Array.isArray(data.points) ? data.points : [])
          .map((p) => text(p, 300))
          .filter(Boolean)
          .slice(0, 5),
        recommendation: text(data.recommendation, 600),
        model: response.model,
      };
      if (plan) {
        summary.nextTests = validTests(data.nextTests, plan.symbols);
        summary.testContext = plan;
      }
      if (!summary.headline && !summary.recommendation) {
        return { skipped: 'the model returned an empty summary' };
      }
      return { summary };
    } catch (err) {
      return { skipped: `AI summary failed: ${(err as Error).message}` };
    }
  }
}
