import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { nextRunAt } from '../autopilot-helpers.js';
import { AutopilotSchedulerService } from '../autopilot-scheduler.service.js';
import { AutopilotStore } from '../autopilot-store.js';
import { AutopilotService } from '../autopilot.service.js';
import { NotifierService } from '../../notify/notifier.service.js';
import { UpdateAutopilotDto } from './autopilot.dto.js';

@ApiTags('paper trading')
@Controller('autopilot')
export class AutopilotController {
  constructor(
    private readonly store: AutopilotStore,
    private readonly autopilot: AutopilotService,
    private readonly scheduler: AutopilotSchedulerService,
    private readonly notifier: NotifierService,
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
      runs: await this.store.recentRuns(10),
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
}
