import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import type { Model } from 'mongoose';
import { AuthService } from '../auth/auth.service.js';
import { CookieConsentDoc } from './cookie-consent.schema.js';

export class CookieConsentDto {
  @ApiProperty({
    description: 'Allow remembering preferences (light/dark mode, the sidebar)',
  })
  @IsBoolean()
  functional: boolean;

  @ApiProperty({
    example: '1',
    description: 'The cookie-policy version the user decided on',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  policyVersion: string;
}

const view = (d: CookieConsentDoc | null) =>
  d && {
    policyVersion: d.policyVersion,
    decidedAt: d.decidedAt,
    functional: d.functional,
  };

/** The logged-in user's cookie choice (logged-out visitors keep theirs in the browser). */
@ApiTags('consent')
@Controller('consent/cookies')
export class CookieConsentController {
  constructor(
    private readonly auth: AuthService,
    @InjectModel(CookieConsentDoc.name)
    private readonly consents: Model<CookieConsentDoc>,
  ) {}

  @Get()
  @ApiOperation({ summary: "The user's cookie choice (null: not decided yet)" })
  async get(@Req() req: Request) {
    const id = this.auth.requester(req).email;
    return { consent: view(await this.consents.findById(id).lean()) };
  }

  @Put()
  @ApiOperation({
    summary: "Saves the user's cookie choice (now, with the policy version)",
  })
  async save(@Req() req: Request, @Body() dto: CookieConsentDto) {
    const id = this.auth.requester(req).email;
    const doc = await this.consents
      .findOneAndUpdate(
        { _id: id },
        {
          $set: {
            policyVersion: dto.policyVersion,
            decidedAt: new Date(),
            functional: dto.functional,
          },
        },
        { upsert: true, new: true },
      )
      .lean();
    return { consent: view(doc) };
  }
}
