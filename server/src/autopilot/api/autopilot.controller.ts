import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { nextRunAt } from '../autopilot-helpers.js';
import { AutopilotSchedulerService } from '../autopilot-scheduler.service.js';
import { AutopilotStore } from '../autopilot-store.js';
import { AutopilotService } from '../autopilot.service.js';
import { NotifierService } from '../../notify/notifier.service.js';
import { TelegramBotService } from '../bot/telegram-bot.service.js';
import { IdeasService } from '../ideas/ideas.service.js';
import { InvestIdeaDto, UpdateAutopilotDto } from './autopilot.dto.js';

@ApiTags('paper trading')
@Controller('autopilot')
export class AutopilotController {
  constructor(
    private readonly store: AutopilotStore,
    private readonly autopilot: AutopilotService,
    private readonly scheduler: AutopilotSchedulerService,
    private readonly notifier: NotifierService,
    private readonly ideas: IdeasService,
    private readonly bot: TelegramBotService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Autopilot settings, whether it is running, and its recent runs',
  })
  async get() {
    const settings = await this.store.settings();
    return {
      settings,
      running: this.autopilot.running,
      nextRunAt: settings.enabled
        ? nextRunAt(settings.lastRunAt, settings.everyDays)
        : null,
      schedulerOn: this.scheduler.enabled,
      notifyOn: this.notifier.configured,
      telegram: this.bot.enabled
        ? 'commands'
        : this.notifier.channels().includes('telegram')
          ? 'send-only'
          : 'off',
      ideas: await this.ideas.pending(),
      runs: (await this.store.recentRuns(10)).map((r) =>
        // Saved as running but not running here: the server stopped mid-run.
        r.status === 'running' && r.id !== this.autopilot.running?.id
          ? {
              ...r,
              status: 'failed' as const,
              activity: null,
              error:
                r.error ?? 'Interrupted: the server stopped during this run',
            }
          : r,
      ),
    };
  }

  @Put()
  @ApiOperation({
    summary: 'Change autopilot settings (e.g. {"enabled": true})',
  })
  async update(@Body() dto: UpdateAutopilotDto) {
    const settings = await this.store.settings();
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    await this.store.saveSettings({ ...settings, ...changes });
    return this.get();
  }

  @Post('run')
  @HttpCode(202)
  @ApiOperation({ summary: 'Run the autopilot now (in the background)' })
  run() {
    try {
      return this.autopilot.start('manual');
    } catch (err) {
      throw new ConflictException((err as Error).message);
    }
  }

  @Get('ideas')
  @ApiOperation({ summary: 'Recent ideas (open and answered)' })
  recentIdeas() {
    return this.ideas.recent();
  }

  @Post('ideas/:id/invest')
  @HttpCode(200)
  @ApiOperation({ summary: 'Your yes: paper-deploy an idea' })
  async invest(@Param('id') id: string, @Body() dto: InvestIdeaDto) {
    return { message: await this.ideas.invest(id, dto.amount) };
  }

  @Post('ideas/:id/skip')
  @HttpCode(200)
  @ApiOperation({ summary: 'Your no: drop an idea' })
  async skip(@Param('id') id: string) {
    return { message: await this.ideas.skip(id) };
  }
}
