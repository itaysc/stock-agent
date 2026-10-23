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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { isChartRange } from '../../broker/broker-chart-range.js';
import { AlpacaSyncService } from '../alpaca-sync.service.js';
import { AssetsService } from '../assets.service.js';
import { MyStocksService } from '../my-stocks.service.js';
import { TradeService } from '../trade.service.js';
import { BuyDto, LevelsDto, SellDto, WatchlistDto } from './trade.dto.js';

const SYMBOL = /^[A-Z][A-Z0-9.]{0,9}$/;
const symbolOf = (s: string) => {
  const x = s.toUpperCase();
  if (!SYMBOL.test(x)) throw new BadRequestException(`Not a ticker: ${s}`);
  return x;
};

/** The Trade page: your own stock picks on the paper account, apart from the broker. */
@ApiTags('trade')
@Controller('trade')
export class TradeController {
  constructor(
    private readonly trade: TradeService,
    private readonly myStocks: MyStocksService,
    private readonly assets: AssetsService,
    private readonly alpacaSync: AlpacaSyncService,
  ) {}

  @Get('search')
  @ApiOperation({ summary: 'Find a stock or ETF by ticker or company name' })
  search(@Query('q') q = '') {
    return this.assets.search(q.slice(0, 60));
  }

  @Get('quote/:symbol')
  @ApiOperation({
    summary: 'Price, next earnings and what you and the broker hold',
  })
  quote(@Param('symbol') symbol: string) {
    return this.trade.quote(symbolOf(symbol));
  }

  @Get('chart/:symbol')
  @ApiOperation({
    summary:
      'Price chart of any stock (up to 5 years), with your trades when you hold it',
  })
  chart(
    @Param('symbol') symbol: string,
    @Query('range') range = '1y',
    @Query('compare') compare?: string,
  ) {
    if (!isChartRange(range))
      throw new BadRequestException(`Unknown range ${range}`);
    return this.trade.chart(symbolOf(symbol), range, compare === 'SPY');
  }

  @Get('categories')
  categories() {
    return this.trade.categories();
  }

  @Get('discover')
  @ApiOperation({
    summary: "A category's stocks ranked by trend (rules-based, not advice)",
  })
  discover(@Query('category') category = 'tech') {
    return this.trade.discover(category);
  }

  @Post(':symbol/news-summary')
  @HttpCode(200)
  @ApiOperation({ summary: "The AI's summary of the last week's news" })
  newsSummary(@Param('symbol') symbol: string) {
    return this.trade.newsSummary(symbolOf(symbol));
  }

  @Get('my-stocks')
  @ApiOperation({ summary: 'Your own stocks, pending orders and watchlist' })
  mine() {
    return this.trade.myStocks();
  }

  @Post('buy')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Buy a dollar amount of a stock at market (paper account)',
  })
  async buy(@Body() dto: BuyDto) {
    await this.myStocks.buy(symbolOf(dto.symbol), dto.amount);
    return this.trade.myStocks();
  }

  @Post('sell')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sell a dollar amount of your shares, or all of them',
  })
  async sell(@Body() dto: SellDto) {
    await this.myStocks.sell(
      symbolOf(dto.symbol),
      dto.all ? undefined : dto.amount,
    );
    return this.trade.myStocks();
  }

  @Put('levels/:symbol')
  @ApiOperation({
    summary: 'Your stop loss / profit target for one of your stocks',
  })
  async levels(@Param('symbol') symbol: string, @Body() dto: LevelsDto) {
    await this.myStocks.setLevels(symbolOf(symbol), {
      stopPrice: dto.stopPrice ?? null,
      takeProfitPrice: dto.takeProfitPrice ?? null,
    });
    return this.trade.myStocks();
  }

  @Post('sync')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Match My stocks to the Alpaca account: stocks bought or sold outside the app, open orders, new fills',
  })
  async sync() {
    const result = await this.alpacaSync.sync();
    return { result, view: await this.trade.myStocks() };
  }

  @Put('watchlist')
  async watchlist(@Body() dto: WatchlistDto) {
    await this.myStocks.setWatchlist(dto.symbols.map(symbolOf));
    return this.trade.myStocks();
  }
}
