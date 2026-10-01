import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsObject,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { RunCostsDto, upperList } from '../api/backtest.dto.js';
import { MAX_SLEEVES } from './portfolio.service.js';

export class SleeveDto {
  @ApiProperty({ example: 'rules' }) @IsString() strategy: string;

  @ApiProperty({ example: ['AAPL', 'MSFT'] })
  @Transform(upperList)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @Matches(/^[A-Z][A-Z0-9.]{0,9}$/, { each: true, message: 'invalid symbol' })
  symbols: string[];

  @ApiPropertyOptional({ example: { breakout: 20, atrStop: 3 } })
  @IsObject()
  params: Record<string, string | number> = {};

  @ApiProperty({ example: 40, description: 'Share of the starting cash, in %' })
  @IsNumber()
  @Min(0.1)
  @Max(100)
  weightPct: number;
}

export class RunPortfolioDto extends RunCostsDto {
  @ApiProperty({ type: [SleeveDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SLEEVES)
  @ValidateNested({ each: true })
  @Type(() => SleeveDto)
  sleeves: SleeveDto[];

  @ApiPropertyOptional({
    description: 'Sell everything at this % below the peak (0 = off)',
  })
  @IsNumber()
  @Min(0)
  @Max(99)
  maxDrawdownPct = 0;

  @ApiPropertyOptional({ description: 'Days without new buys after the stop' })
  @IsNumber()
  @Min(0)
  @Max(365)
  cooldownDays = 20;
}
