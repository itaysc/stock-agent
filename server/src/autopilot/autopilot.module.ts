import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotifyModule } from '../notify/notify.module.js';
import { PaperModule } from '../paper/paper.module.js';
import { ResearchModule } from '../research/research.module.js';
import { AutopilotController } from './api/autopilot.controller.js';
import { AutopilotSchedulerService } from './autopilot-scheduler.service.js';
import { AutopilotStore } from './autopilot-store.js';
import {
  AutopilotRunDoc,
  AutopilotRunSchema,
  AutopilotSettingsDoc,
  AutopilotSettingsSchema,
} from './autopilot.schema.js';
import { AutopilotService } from './autopilot.service.js';

/** The autonomous research → paper-trading loop. */
@Module({
  imports: [
    PaperModule,
    ResearchModule,
    NotifyModule,
    MongooseModule.forFeature([
      { name: AutopilotSettingsDoc.name, schema: AutopilotSettingsSchema },
      { name: AutopilotRunDoc.name, schema: AutopilotRunSchema },
    ]),
  ],
  controllers: [AutopilotController],
  providers: [AutopilotStore, AutopilotService, AutopilotSchedulerService],
})
export class AutopilotModule {}
