import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';
import { BrokerService } from '../broker.service.js';

export class StartBrokerDto {
  @ApiPropertyOptional({ example: 10000 })
  @IsNumber()
  @Min(100)
  @Max(10_000_000)
  capital: number;
}

@ApiTags('broker')
@Controller('broker')
export class BrokerController {
  constructor(private readonly broker: BrokerService) {}

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
    return { text: await this.broker.reportIfNew(true) };
  }
}
