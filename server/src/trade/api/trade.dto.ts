import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class BuyDto {
  @ApiProperty({ example: 'AAPL' })
  @IsString()
  symbol: string;

  @ApiProperty({ example: 250, description: 'Dollars to spend' })
  @IsNumber()
  @Min(1)
  @Max(1_000_000)
  amount: number;
}

export class SellDto {
  @ApiProperty({ example: 'AAPL' })
  @IsString()
  symbol: string;

  @ApiPropertyOptional({
    example: 100,
    description: 'Dollars to sell (omit with all)',
  })
  @ValidateIf((o: SellDto) => !o.all)
  @IsNumber()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({ description: 'Sell all of your shares' })
  @IsOptional()
  @IsBoolean()
  all?: boolean;
}

export class LevelsDto {
  @ApiPropertyOptional({ example: 150, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stopPrice?: number | null;

  @ApiPropertyOptional({ example: 250, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  takeProfitPrice?: number | null;
}

export class WatchlistDto {
  @ApiProperty({ example: ['NVDA', 'GLD'] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  symbols: string[];
}
