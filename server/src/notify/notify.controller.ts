import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotifierService } from './notifier.service.js';

@ApiTags('paper trading')
@Controller('notifications')
export class NotifyController {
  constructor(private readonly notifier: NotifierService) {}

  @Post('test')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Send a test message to every notification channel',
  })
  async test() {
    if (!this.notifier.configured) {
      throw new BadRequestException(
        'No notification channel is set up: add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (or NOTIFY_WEBHOOK_URL) to server/.env',
      );
    }
    await this.notifier.send('✅ Test from stock-invest: notifications work.');
    return { sentTo: this.notifier.channels() };
  }
}
