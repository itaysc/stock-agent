import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AlpacaService } from '../alpaca.service.js';

const CACHE_MS = 60_000;

/** The US stock market's clock: open now or not, and when it next opens and closes. */
@ApiTags('market')
@Controller('market')
export class MarketController {
  private last: {
    at: number;
    clock: { isOpen: boolean; nextOpen: Date; nextClose: Date; now: Date };
  } | null = null;

  constructor(private readonly alpaca: AlpacaService) {}

  @Get('clock')
  @ApiOperation({
    summary:
      'Is the US market open, and when it next opens / closes (holidays and early closes included)',
  })
  async clock() {
    if (this.last && Date.now() - this.last.at < CACHE_MS)
      return this.last.clock;
    const c = await this.alpaca.getClock();
    const clock = {
      isOpen: !!c.isOpen,
      nextOpen: new Date(c.nextOpen),
      nextClose: new Date(c.nextClose),
      now: new Date(),
    };
    this.last = { at: Date.now(), clock };
    return clock;
  }
}
