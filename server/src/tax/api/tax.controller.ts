import {
  BadRequestException,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TaxSyncService } from '../tax-sync.service.js';
import { TaxService } from '../tax.service.js';

/** ?year=2026&paper=true → the year and whether it's the paper account (default: real money). */
function parse(year?: string, paper?: string) {
  const y = Number(year ?? new Date().getUTCFullYear());
  if (!Number.isInteger(y) || y < 2000 || y > 2100)
    throw new BadRequestException('year must be like 2026');
  return { year: y, paper: paper === 'true' };
}

@ApiTags('tax')
@Controller('tax')
export class TaxController {
  constructor(
    private readonly tax: TaxService,
    private readonly sync: TaxSyncService,
  ) {}

  @Get('years')
  @ApiOperation({ summary: 'The years with tax records, paper and real' })
  async years() {
    return { years: await this.tax.years(), lastSync: this.sync.lastSync };
  }

  @Get('records')
  @ApiOperation({
    summary:
      "A year's buys, sells and other activities, with the dollar rate and shekels",
  })
  records(@Query('year') year?: string, @Query('paper') paper?: string) {
    const q = parse(year, paper);
    return this.tax.list(q.year, q.paper);
  }

  @Get('report')
  @ApiOperation({
    summary:
      "A year's tax picture: sales matched to buys, totals in shekels, carried losses, an estimate",
  })
  report(@Query('year') year?: string, @Query('paper') paper?: string) {
    const q = parse(year, paper);
    return this.tax.report(q.year, q.paper);
  }

  @Get('sales.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({
    summary: "A year's sales as CSV (for form 1322 or your accountant)",
  })
  salesCsv(@Query('year') year?: string, @Query('paper') paper?: string) {
    const q = parse(year, paper);
    return this.tax.salesCsv(q.year, q.paper);
  }

  @Post('sync')
  @HttpCode(200)
  @ApiOperation({ summary: 'Copy new activities from the broker now' })
  async syncNow() {
    return { added: await this.sync.sync(), lastSync: this.sync.lastSync };
  }
}
