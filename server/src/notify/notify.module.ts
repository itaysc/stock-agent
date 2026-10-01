import { Module } from '@nestjs/common';
import { NotifierService } from './notifier.service.js';

/** Notifications to NOTIFY_WEBHOOK_URL (autopilot decisions, breaking news on held positions). */
@Module({ providers: [NotifierService], exports: [NotifierService] })
export class NotifyModule {}
