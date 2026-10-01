import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { RunSettingsDto } from '../../backtest/api/backtest.dto.js';
import { RESEARCH_GOALS, type ResearchGoal } from '../research.types.js';
import { BASKET_IDS, type BasketId } from '../robustness/baskets.js';

export class RunResearchDto extends RunSettingsDto {
  @ApiPropertyOptional({
    description: 'Strategies the agent may use (default: all)',
  })
  @IsArray()
  @IsString({ each: true })
  strategies: string[] = [];

  @ApiPropertyOptional({ enum: RESEARCH_GOALS })
  @IsIn(RESEARCH_GOALS)
  goal: ResearchGoal = 'risk-adjusted';

  @ApiPropertyOptional({
    example: '12m',
    description:
      'Final stretch no test sees; default `from`: 5 years before `to`',
  })
  @Matches(/^[1-9]\d*[dwmy]$/, { message: 'holdout like 6m, 12m or 1y' })
  holdout = '12m';

  @ApiPropertyOptional({
    enum: [...BASKET_IDS, 'none'],
    description: 'Basket for the multi-symbol check of the best test',
  })
  @IsIn([...BASKET_IDS, 'none'])
  basket: BasketId | 'none' = 'megacaps';

  @ApiPropertyOptional() @IsInt() @Min(1) @Max(10) rounds = 5;
  @ApiPropertyOptional() @IsInt() @Min(1) @Max(5) testsPerRound = 3;
}
