import { type ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response } from 'express';
import { isRateLimited } from './alpaca.service.js';

/** Alpaca's rate limit reaches the app as "try again in a minute" (503), not a 500. */
@Catch()
export class RateLimitFilter extends BaseExceptionFilter {
  catch(err: unknown, host: ArgumentsHost): void {
    if (!isRateLimited(err)) return super.catch(err, host);
    host.switchToHttp().getResponse<Response>().status(503).json({
      statusCode: 503,
      message:
        "Alpaca's free market data allows about 200 requests a minute and it is used up right now: try again in a minute.",
    });
  }
}
