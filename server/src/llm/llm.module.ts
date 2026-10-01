import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { Env } from '../config/env.js';
import { OPENAI_CLIENT } from './llm.constants.js';
import { LlmService } from './llm.service.js';
import { OpenAIIntegration } from './providers/openai.integration.js';

@Module({
  providers: [
    {
      provide: OPENAI_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const apiKey = config.get('OPENAI_API_KEY', { infer: true }).trim();
        return apiKey
          ? new OpenAI({ apiKey, timeout: 60_000, maxRetries: 2 })
          : null;
      },
    },
    OpenAIIntegration,
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
