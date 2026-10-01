import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { upperList } from '../../backtest/api/backtest.dto.js';
import {
  RESEARCH_GOALS,
  type ResearchGoal,
} from '../../research/research.types.js';
import {
  BASKET_IDS,
  type BasketId,
} from '../../research/robustness/baskets.js';

/** Any subset of the autopilot's settings. */
export class UpdateAutopilotDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;

  @ApiPropertyOptional({ example: ['SPY', 'QQQ'] })
  @IsOptional()
  @Transform(upperList)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Matches(/^[A-Z][A-Z0-9.]{0,9}$/, { each: true, message: 'invalid symbol' })
  watchlist?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  everyDays?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  symbolsPerRun?: number;
  @ApiPropertyOptional({ enum: RESEARCH_GOALS })
  @IsOptional()
  @IsIn(RESEARCH_GOALS)
  goal?: ResearchGoal;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rounds?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  testsPerRound?: number;

  @ApiPropertyOptional({ example: '12m' })
  @IsOptional()
  @Matches(/^[1-9]\d*[dwmy]$/, { message: 'holdout like 6m, 12m or 1y' })
  holdout?: string;

  @ApiPropertyOptional({ enum: BASKET_IDS })
  @IsOptional()
  @IsIn(BASKET_IDS)
  basket?: BasketId;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(100)
  capitalPerDeployment?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  maxDeployments?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(500)
  retireBehindAfterDays?: number;
}
