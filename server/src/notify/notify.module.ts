import { Module } from '@nestjs/common';
import { NotifierService } from './notifier.service.js';
import { NotifyController } from './notify.controller.js';
import { TelegramClient } from './telegram.client.js';

@Module({
  controllers: [NotifyController],
  providers: [NotifierService, TelegramClient],
  exports: [NotifierService, TelegramClient],
})
export class NotifyModule {}
