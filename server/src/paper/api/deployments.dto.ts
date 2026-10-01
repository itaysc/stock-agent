import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SleeveDto } from '../../backtest/portfolio/portfolio.dto.js';

export class NewsCheckDto {
  @ApiPropertyOptional({
    description:
      'Skip a buy when the headlines since its signal average this negative or worse (0 = off)',
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  tone = 0.3;

  @ApiPropertyOptional({
    description: 'Let the AI read the headlines too (needs OPENAI_API_KEY)',
  })
  @IsBoolean()
  ai = true;

  @ApiPropertyOptional({
    enum: ['off', 'alert', 'sell'],
    description: 'Severe news about a held symbol',
  })
  @IsIn(['off', 'alert', 'sell'])
  watch: 'off' | 'alert' | 'sell' = 'alert';
}

class DeploymentOptionsDto {
  @ApiPropertyOptional({ example: 'Breakouts in a bull market' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiProperty({
    example: 10_000,
    description: 'Paper money for this deployment',
  })
  @IsNumber()
  @Min(100)
  capital: number;

  @ApiPropertyOptional({
    description:
      'Pause and sell at this % below the peak (default: 1.5 × the backtest’s worst drop, at least 10%)',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(90)
  maxDrawdownPct?: number;

  @ApiPropertyOptional({ type: NewsCheckDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NewsCheckDto)
  newsCheck?: NewsCheckDto;
}

export class CreateDeploymentDto extends DeploymentOptionsDto {
  @ApiProperty({ type: [SleeveDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SleeveDto)
  sleeves: SleeveDto[];
}

export class DeployResearchDto extends DeploymentOptionsDto {
  @ApiProperty() @IsUUID() researchId: string;

  @ApiPropertyOptional({
    description: 'Deploy even if it did not pass every check',
  })
  @IsBoolean()
  allowNonCandidate = false;
}
