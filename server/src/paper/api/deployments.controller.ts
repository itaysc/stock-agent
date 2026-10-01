import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AlpacaService } from '../../alpaca/alpaca.service.js';
import { EdgarService } from '../../info/official/edgar.service.js';
import { LlmService } from '../../llm/llm.service.js';
import { mapErrors } from '../../backtest/api/map-errors.js';
import { ResearchService } from '../../research/research.service.js';
import { deploymentEquity } from '../deployment-cycle.js';
import { DeploymentRunnerService } from '../deployment-runner.service.js';
import { deploymentView } from '../deployment-view.js';
import { DeploymentsService } from '../deployments.service.js';
import { sleeveFromResearch } from '../research-sleeve.js';
import {
  CreateDeploymentDto,
  DeployResearchDto,
  NewsCheckDto,
} from './deployments.dto.js';

/** A plain object (not the DTO class instance), or undefined for the default. */
const newsCheckOf = (n?: NewsCheckDto) =>
  n ? { tone: n.tone, ai: n.ai, watch: n.watch } : undefined;

const params = (p: Record<string, string | number> = {}) =>
  Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)]));

@ApiTags('paper trading')
@Controller('paper')
export class DeploymentsController {
  constructor(
    private readonly deployments: DeploymentsService,
    private readonly runner: DeploymentRunnerService,
    private readonly research: ResearchService,
    private readonly alpaca: AlpacaService,
    private readonly edgar: EdgarService,
    private readonly llm: LlmService,
  ) {}

  @Get('account')
  @ApiOperation({
    summary: 'The paper account: cash, and how much the deployments use',
  })
  async account() {
    const [account, list] = await Promise.all([
      this.alpaca.getAccount(),
      this.deployments.list(),
    ]);
    const live = list.filter((d) => d.status !== 'stopped');
    const committed = live.reduce((n, d) => n + d.capital, 0);
    return {
      paper: this.alpaca.isPaper,
      runnerOn: this.runner.enabled,
      cash: Number(account.cash ?? 0),
      equity: Number(account.equity ?? 0),
      committed,
      free: Number(account.cash ?? 0) - committed,
      deploymentsEquity: live.reduce((n, d) => n + deploymentEquity(d), 0),
      // What the real-time news check can use right now.
      newsSources: {
        headlines: true, // Alpaca (Benzinga)
        halts: true, // Nasdaq Trader trade halts
        secFilings: this.edgar.configured,
        ai: this.llm.isConfigured(),
      },
    };
  }

  @Get('deployments')
  @ApiOperation({ summary: 'Paper deployments, newest first' })
  async list() {
    return (await this.deployments.list()).map((d) => deploymentView(d));
  }

  @Get('deployments/:id')
  async get(@Param('id') id: string) {
    return deploymentView(await this.deployments.get(id), { full: true });
  }

  @Post('deployments')
  @ApiOperation({
    summary: 'Deploy sleeves to the paper account (daily strategies)',
  })
  async create(@Body() dto: CreateDeploymentDto) {
    const d = await mapErrors(() =>
      this.deployments.create({
        name: dto.name ?? '',
        capital: dto.capital,
        maxDrawdownPct: dto.maxDrawdownPct,
        newsCheck: newsCheckOf(dto.newsCheck),
        sleeves: dto.sleeves.map((s) => ({
          strategy: s.strategy,
          symbols: s.symbols,
          weightPct: s.weightPct,
          params: params(s.params),
        })),
      }),
    );
    return deploymentView(d, { full: true });
  }

  @Post('deployments/from-research')
  @ApiOperation({
    summary: "Deploy an AI research session's best idea to the paper account",
  })
  async fromResearch(@Body() dto: DeployResearchDto) {
    const session = await this.research.get(dto.researchId);
    if (!session)
      throw new NotFoundException(`No research session ${dto.researchId}`);
    const d = await mapErrors(async () =>
      this.deployments.create({
        name: dto.name ?? `AI: ${session.request.symbols.join(', ')}`,
        capital: dto.capital,
        maxDrawdownPct: dto.maxDrawdownPct,
        newsCheck: newsCheckOf(dto.newsCheck),
        sleeves: [sleeveFromResearch(session, dto.allowNonCandidate)],
        source: { kind: 'research', researchId: session.id },
      }),
    );
    return deploymentView(d, { full: true });
  }

  @Put('deployments/:id/news-check')
  @ApiOperation({ summary: "Change a deployment's real-time news checks" })
  async newsCheck(@Param('id') id: string, @Body() dto: NewsCheckDto) {
    return deploymentView(
      await this.deployments.setNewsCheck(id, {
        tone: dto.tone,
        ai: dto.ai,
        watch: dto.watch,
      }),
      { full: true },
    );
  }

  @Post('deployments/:id/pause')
  @HttpCode(200)
  async pause(@Param('id') id: string) {
    return deploymentView(await this.deployments.pause(id), { full: true });
  }

  @Post('deployments/:id/resume')
  @HttpCode(200)
  async resume(@Param('id') id: string) {
    return deploymentView(await this.deployments.resume(id), { full: true });
  }

  @Post('deployments/:id/stop')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sell everything and stop for good' })
  async stop(@Param('id') id: string) {
    return deploymentView(await this.deployments.stop(id), { full: true });
  }

  @Post('deployments/:id/run')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Run its daily cycle now (book fills, check for a new completed day)',
  })
  async run(@Param('id') id: string) {
    const d = await this.deployments.get(id);
    await this.runner.cycle(d);
    return deploymentView(d, { full: true });
  }
}
