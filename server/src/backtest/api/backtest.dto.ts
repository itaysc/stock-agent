import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { SORT_KEYS, type SortKey } from '../sweep/sweep-report.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DURATION = /^[1-9]\d*[dwmy]$/;
export const upperList = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((v) => String(v).trim().toUpperCase())
    : value;

/** Period, timeframe and costs shared by every kind of run. */
export class RunCostsDto {
  @ApiPropertyOptional({ example: '1Day' })
  @Matches(/^\d+(Min|Hour|Day|Week|Month)$/, {
    message: 'timeframe like 15Min, 1Hour, 1Day',
  })
  timeframe = '1Day';

  @ApiPropertyOptional({
    example: '2024-01-01',
    description: 'default: 2 years before `to`',
  })
  @IsOptional()
  @Matches(DATE, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'default: today' })
  @IsOptional()
  @Matches(DATE, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional() @IsNumber() @IsPositive() cash = 100_000;
  @ApiPropertyOptional() @IsNumber() @Min(0) slippageBps = 5;
  @ApiPropertyOptional() @IsNumber() @Min(0) feePerShare = 0;
  @ApiPropertyOptional({ description: 'Yearly interest on idle cash, in %' })
  @IsNumber()
  @Min(0)
  @Max(20)
  cashYieldPct = 3;
  @ApiPropertyOptional({
    description:
      'Skip a buy when the headlines before its open average this negative or worse (0.3 = tone -0.3); 0 = off',
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  newsGateTone = 0;
  @ApiPropertyOptional({ description: 'AI summary (needs OPENAI_API_KEY)' })
  @IsBoolean()
  ai = true;
}

export class RunSettingsDto extends RunCostsDto {
  @ApiProperty({ example: ['AAPL', 'MSFT'] })
  @Transform(upperList)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @Matches(/^[A-Z][A-Z0-9.]{0,9}$/, { each: true, message: 'invalid symbol' })
  symbols: string[];
}

export class RunBacktestDto extends RunSettingsDto {
  @ApiPropertyOptional({ example: 'sma-crossover' }) @IsString() strategy =
    'sma-crossover';

  @ApiPropertyOptional({ example: { fast: 10, slow: 30 } })
  @IsObject()
  params: Record<string, string | number> = {};

  @ApiPropertyOptional({
    description: 'Re-run even if saved in the run history',
  })
  @IsBoolean()
  fresh = false;
}

export class RunSweepDto extends RunSettingsDto {
  @ApiPropertyOptional({ example: ['sma-crossover', 'rsi-reversion'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  strategies: string[] = ['sma-crossover'];

  @ApiPropertyOptional({
    example: { fast: '5..30:5', slow: '20,50,100' },
    description: 'Values to try: "10", "5,10,20" or "5..30:5"',
  })
  @IsObject()
  params: Record<string, string | number> = {};

  @ApiPropertyOptional({ enum: SORT_KEYS }) @IsIn(SORT_KEYS) sort: SortKey =
    'return';
  @ApiPropertyOptional() @IsInt() @Min(0) minTrades = 0;
}

/** Like a sweep, but every setting is picked on training data and judged on the next, unseen window. */
export class RunWalkForwardDto extends RunSettingsDto {
  @ApiPropertyOptional({ example: ['sma-crossover'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  strategies: string[] = ['sma-crossover'];

  @ApiPropertyOptional({
    example: { fast: '5..30:5', slow: '20,50,100' },
    description:
      'Values to try, like a sweep; `from` defaults to 5 years before `to`',
  })
  @IsObject()
  params: Record<string, string | number> = {};

  @ApiPropertyOptional({
    example: '12m',
    description: 'e.g. 90d, 26w, 12m, 2y',
  })
  @Matches(DURATION, { message: 'train like 90d, 26w, 12m or 2y' })
  train = '12m';

  @ApiPropertyOptional({ example: '3m', description: 'test length and step' })
  @Matches(DURATION, { message: 'test like 30d, 4w, 3m or 1y' })
  test = '3m';

  @ApiPropertyOptional({
    description: 'training grows from `from` instead of sliding',
  })
  @IsBoolean()
  anchored = false;

  @ApiPropertyOptional({ enum: SORT_KEYS }) @IsIn(SORT_KEYS) sort: SortKey =
    'return-dd';
  @ApiPropertyOptional() @IsInt() @Min(0) minTrades = 0;
}
