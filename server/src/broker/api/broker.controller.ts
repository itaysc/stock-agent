import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
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
import { PROFILES, type ProfileId } from '../profiles.js';
import { BrokerService } from '../broker.service.js';
import { LivePricesService } from '../live-prices.service.js';

export class StartBrokerDto {
  @ApiPropertyOptional({ example: 10000 })
  @IsNumber()
  @Min(100)
  @Max(10_000_000)
  capital: number;

  @ApiPropertyOptional({
    enum: PROFILES.map((p) => p.id),
    description: 'Default: the one suggested for the amount',
  })
  @IsOptional()
  @IsIn(PROFILES.map((p) => p.id))
  profile?: ProfileId;
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
    private readonly live: LivePricesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'The broker: holdings, recent trades with reasons, vs SPY',
  })
  get() {
    return this.broker.view();
  }

  @Get('profiles')
  @ApiOperation({
    summary:
      'Every risk profile with its history (in $ for this amount), and the suggested one',
  })
  profiles(@Query('capital') capital = '1000') {
    const amount = Number(capital);
    if (!(amount > 0))
      throw new BadRequestException('capital must be a positive number');
    return this.broker.profiles(amount);
  }

  @Get('prices')
  @ApiOperation({
    summary:
      'The latest traded price of these symbols (comma-separated), for the page',
  })
  prices(@Query('symbols') symbols = '', @Query('fresh') fresh = '') {
    const list = symbols
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (list.length > 60 || list.some((s) => !/^[A-Z][A-Z0-9.]{0,9}$/.test(s)))
      throw new BadRequestException(
        'symbols: up to 60 tickers, comma-separated',
      );
    return this.live.prices(list, fresh === '1');
  }

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({
    summary: 'What it would buy now with this much (nothing is bought)',
  })
  preview(@Body() dto: StartBrokerDto) {
    return this.broker.preview(dto.capital, dto.profile);
  }

  @Post('start')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'A new investment with this much paper money and this risk profile',
  })
  start(@Body() dto: StartBrokerDto) {
    return this.broker.start(dto.capital, dto.profile);
  }

  @Get('investments/:id/chart/:symbol')
  @ApiOperation({
    summary: "A stock's price chart with its trades, buy price and stop",
  })
  chart(@Param('id') id: string, @Param('symbol') symbol: string) {
    return this.broker.chart(id, symbol);
  }

  @Post('investments/:id/positions/:symbol/sell')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sell all or half of one holding now (paper)' })
  sell(
    @Param('id') id: string,
    @Param('symbol') symbol: string,
    @Body() dto: SellDto,
  ) {
    return this.broker.sell(id, symbol, dto.fraction);
  }

  @Put('investments/:id/positions/:symbol/levels')
  @ApiOperation({
    summary: 'Your own stop loss / profit target for one holding',
  })
  levels(
    @Param('id') id: string,
    @Param('symbol') symbol: string,
    @Body() dto: LevelsDto,
  ) {
    return this.broker.setLevels(id, symbol, {
      ...(dto.stopPrice !== undefined && { stopPrice: dto.stopPrice }),
      ...(dto.takeProfitPrice !== undefined && {
        takeProfitPrice: dto.takeProfitPrice,
      }),
    });
  }

  @Post('investments/:id/positions/:symbol/allow')
  @HttpCode(200)
  @ApiOperation({ summary: 'Let it buy a stock you sold again' })
  allow(@Param('id') id: string, @Param('symbol') symbol: string) {
    return this.broker.allow(id, symbol);
  }

  @Post('investments/:id/pause')
  @HttpCode(200)
  @ApiOperation({ summary: 'No new trades; holdings are kept' })
  pause(@Param('id') id: string) {
    return this.broker.pause(id);
  }

  @Post('investments/:id/resume')
  @HttpCode(200)
  resume(@Param('id') id: string) {
    return this.broker.resume(id);
  }

  @Post('investments/:id/stop')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sell everything of this investment and stop it' })
  stop(@Param('id') id: string) {
    return this.broker.stop(id);
  }

  @Post('report')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send the report to Telegram now' })
  async report() {
    return { text: await this.notices.reportIfNew(true) };
  }
}
