import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { CookieConsentController } from './cookie-consent.controller.js';
import {
  CookieConsentDoc,
  CookieConsentSchema,
} from './cookie-consent.schema.js';

/** Users' cookie choices (the cookie banner). */
@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: CookieConsentDoc.name, schema: CookieConsentSchema },
    ]),
  ],
  controllers: [CookieConsentController],
})
export class ConsentModule {}
