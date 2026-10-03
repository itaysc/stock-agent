import { Alpaca } from '@alpacahq/alpaca-trade-api';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { ALPACA_CLIENT, ALPACA_STREAM_OPTIONS } from './alpaca.constants.js';
import { AlpacaStreamService } from './alpaca-stream.service.js';
import { AlpacaService } from './alpaca.service.js';

@Module({
  providers: [
    {
      provide: ALPACA_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new Alpaca({
          keyId: config.get('ALPACA_API_KEY', { infer: true }),
          secret: config.get('ALPACA_API_SECRET', { infer: true }),
          paper: config.get('ALPACA_PAPER', { infer: true }),
          // Alpaca's data API is sometimes slow: wait up to a minute (the library's default is 30 s).
          timeoutMs: 60_000,
        }),
    },
    { provide: ALPACA_STREAM_OPTIONS, useValue: {} },
    AlpacaService,
    AlpacaStreamService,
  ],
  exports: [AlpacaService, AlpacaStreamService],
})
export class AlpacaModule {}
