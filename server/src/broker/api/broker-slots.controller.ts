import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { BrokerSlotsService } from '../broker-slots.service.js';

const TICKER = /^[A-Z][A-Z0-9.]{0,9}$/;

export class SellOneDto {
  @ApiPropertyOptional({
    example: 'LLY',
    description:
      'Buy this stock with the money instead (the next in line, usually). Without it, the place stays empty until you pick one.',
  })
  @IsOptional()
  @IsString()
  @Matches(TICKER)
  replaceWith?: string;
}

export class FillSlotDto {
  @ApiProperty({ example: 'LLY' })
  @IsString()
  @Matches(TICKER)
  symbol: string;
}

/** One stock of an investment: sell it and choose what takes its place, or fill an empty place later. */
@ApiTags('broker')
@Controller('broker/investments/:id')
export class BrokerSlotsController {
  constructor(private readonly slots: BrokerSlotsService) {}

  @Get('next-in-line')
  @ApiOperation({
    summary:
      'The stocks this investment could buy next, and how many places are empty',
  })
  nextInLine(@Param('id') id: string) {
    return this.slots.nextInLine(id);
  }

  @Post('positions/:symbol/sell-one')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Sell all of one stock; replace it with another, or leave its place empty',
  })
  sellOne(
    @Param('id') id: string,
    @Param('symbol') symbol: string,
    @Body() dto: SellOneDto,
  ) {
    return this.slots.sellOne(id, symbol, dto.replaceWith);
  }

  @Post('fill-slot')
  @HttpCode(200)
  @ApiOperation({ summary: 'Buy a stock for a place you left empty' })
  fillSlot(@Param('id') id: string, @Body() dto: FillSlotDto) {
    return this.slots.fillSlot(id, dto.symbol);
  }
}
