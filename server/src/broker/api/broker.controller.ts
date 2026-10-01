import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { BrokerNoticesService } from '../broker-notices.service.js';
import { BrokerService } from '../broker.service.js';

export class StartBrokerDto {
  @ApiPropertyOptional({ example: 10000 })
  @IsNumber()
  @Min(100)
  @Max(10_000_000)
  capital: number;
}

export class SellDto {
  @ApiPropertyOptional({ description: '1 = all, 0.5 = half', example: 1 })
  @IsIn([1, 0.5])
  fraction: number = 1;
}

export class LevelsDto {
  @ApiPropertyOptional({
    description: 'Your stop loss price; null = back to the automatic one',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0.01)
  stopPrice?: number | null;

  @ApiPropertyOptional({ description: 'Your profit target price; null = none' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0.01)
  takeProfitPrice?: number | null;
}

@ApiTags('broker')
@Controller('broker')
export class BrokerController {
  constructor(
    private readonly broker: BrokerService,
    private readonly notices: BrokerNoticesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'The broker: holdings, recent trades with reasons, vs SPY',
  })
  get() {
    return this.broker.view();
  }

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({
    summary: 'What it would buy now with this much (nothing is bought)',
  })
  preview(@Body() dto: StartBrokerDto) {
    return this.broker.preview(dto.capital);
  }

  @Get('chart/:symbol')
  @ApiOperation({
    summary: "A stock's price chart with its trades, buy price and stop",
  })
  chart(@Param('symbol') symbol: string) {
    return this.broker.chart(symbol);
  }

  @Post('positions/:symbol/sell')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sell all or half of one holding now (paper)' })
  sell(@Param('symbol') symbol: string, @Body() dto: SellDto) {
    return this.broker.sell(symbol, dto.fraction);
  }

  @Put('positions/:symbol/levels')
  @ApiOperation({
    summary: 'Your own stop loss / profit target for one holding',
  })
  levels(@Param('symbol') symbol: string, @Body() dto: LevelsDto) {
    return this.broker.setLevels(symbol, {
      ...(dto.stopPrice !== undefined && { stopPrice: dto.stopPrice }),
      ...(dto.takeProfitPrice !== undefined && {
        takeProfitPrice: dto.takeProfitPrice,
      }),
    });
  }

  @Post('positions/:symbol/allow')
  @HttpCode(200)
  @ApiOperation({ summary: 'Let it buy a stock you sold again' })
  allow(@Param('symbol') symbol: string) {
    return this.broker.allow(symbol);
  }

  @Post('start')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start the broker with this much paper money' })
  start(@Body() dto: StartBrokerDto) {
    return this.broker.start(dto.capital);
  }

  @Post('pause')
  @HttpCode(200)
  @ApiOperation({ summary: 'No new trades; holdings are kept' })
  pause() {
    return this.broker.pause();
  }

  @Post('resume')
  @HttpCode(200)
  resume() {
    return this.broker.resume();
  }

  @Post('stop')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sell everything and stop' })
  stop() {
    return this.broker.stop();
  }

  @Post('report')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send the report to Telegram now' })
  async report() {
    return { text: await this.notices.reportIfNew(true) };
  }
}
