import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BrokerModule } from '../broker/broker.module.js';
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
import { BotCommands } from './bot/bot-commands.js';
import { BrokerCommands } from './bot/broker-commands.js';
import { TelegramBotService } from './bot/telegram-bot.service.js';
import { IdeaStore } from './ideas/idea-store.js';
import { IdeaDoc, IdeaSchema } from './ideas/idea.schema.js';
import { IdeasService } from './ideas/ideas.service.js';

/** The autonomous research → paper-trading loop, and its Telegram bot. */
@Module({
  imports: [
    PaperModule,
    ResearchModule,
    BrokerModule,
    NotifyModule,
    MongooseModule.forFeature([
      { name: AutopilotSettingsDoc.name, schema: AutopilotSettingsSchema },
      { name: AutopilotRunDoc.name, schema: AutopilotRunSchema },
      { name: IdeaDoc.name, schema: IdeaSchema },
    ]),
  ],
  controllers: [AutopilotController],
  providers: [
    AutopilotStore,
    AutopilotService,
    AutopilotSchedulerService,
    IdeaStore,
    IdeasService,
    BotCommands,
    BrokerCommands,
    TelegramBotService,
  ],
})
export class AutopilotModule {}
