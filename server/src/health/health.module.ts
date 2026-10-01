import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AlpacaModule } from '../alpaca/alpaca.module.js';
import { AlpacaStreamsHealthIndicator } from './alpaca-streams.health.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [TerminusModule, AlpacaModule],
  controllers: [HealthController],
  providers: [AlpacaStreamsHealthIndicator],
})
export class HealthModule {}
