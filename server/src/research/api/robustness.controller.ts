import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { RunWalkForwardDto } from '../../backtest/api/backtest.dto.js';
import { mapErrors } from '../../backtest/api/map-errors.js';
import { resolvePeriod } from '../../backtest/backtest-cli.helpers.js';
import { planLabel } from '../../backtest/plans/plan-menu.js';
import { RESEARCH_GOALS, type ResearchGoal } from '../research.types.js';
import { RobustnessService } from '../robustness/robustness.service.js';

/** The walk-forward setup plus the goal; `symbols` = the basket, each tested on its own. */
export class RunRobustnessDto extends RunWalkForwardDto {
  @ApiPropertyOptional({ enum: RESEARCH_GOALS })
  @IsIn(RESEARCH_GOALS)
  goal: ResearchGoal = 'risk-adjusted';
}

@ApiTags('research')
@Controller('robustness')
export class RobustnessController {
  constructor(private readonly robustness: RobustnessService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Multi-symbol check: run one walk-forward setup on each symbol on its own',
  })
  async run(@Body() dto: RunRobustnessDto) {
    const { from, to } = resolvePeriod(dto.from, dto.to, 5);
    const result = await mapErrors(() =>
      this.robustness.run({
        plan: {
          kind: 'walkforward',
          strategies: dto.strategies,
          params: Object.fromEntries(
            Object.entries(dto.params).map(([k, v]) => [k, String(v)]),
          ),
          train: dto.train,
          test: dto.test,
          anchored: dto.anchored,
          sort: dto.sort,
          minTrades: dto.minTrades,
          why: '',
        },
        symbols: dto.symbols,
        timeframe: dto.timeframe,
        from: new Date(from),
        to: new Date(to),
        goal: dto.goal,
        initialCash: dto.cash,
        slippageBps: dto.slippageBps,
        feePerShare: dto.feePerShare,
        cashYieldPct: dto.cashYieldPct,
        newsGateTone: dto.newsGateTone,
      }),
    );
    return { ...result, label: planLabel(result.plan), initialCash: dto.cash };
  }
}
