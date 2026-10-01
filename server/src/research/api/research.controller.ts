import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { resolvePeriod } from '../../backtest/backtest-cli.helpers.js';
import { mapErrors } from '../../backtest/api/map-errors.js';
import { ResearchService } from '../research.service.js';
import { researchListItem } from './research-responses.js';
import { RunResearchDto } from './research.dto.js';

@ApiTags('research')
@Controller('research')
export class ResearchController {
  constructor(private readonly research: ResearchService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary:
      'Start an AI research session (runs in the background; poll GET /research/:id)',
  })
  start(@Body() dto: RunResearchDto) {
    const { from, to } = resolvePeriod(dto.from, dto.to, 5);
    return mapErrors(() =>
      this.research.start({
        symbols: dto.symbols,
        timeframe: dto.timeframe,
        from: new Date(from),
        to: new Date(to),
        holdout: dto.holdout,
        strategies: dto.strategies,
        goal: dto.goal,
        rounds: dto.rounds,
        testsPerRound: dto.testsPerRound,
        initialCash: dto.cash,
        slippageBps: dto.slippageBps,
        feePerShare: dto.feePerShare,
        cashYieldPct: dto.cashYieldPct,
        newsGateTone: dto.newsGateTone,
        basket: dto.basket === 'none' ? null : dto.basket,
      }),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Recent research sessions, newest first' })
  async list() {
    return (await this.research.list()).map(researchListItem);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'A research session with every round and test so far',
  })
  async get(@Param('id') id: string) {
    const session = await this.research.get(id);
    if (!session) throw new NotFoundException(`No research session ${id}`);
    return session;
  }
}
