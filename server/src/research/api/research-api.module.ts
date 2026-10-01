import { Module } from '@nestjs/common';
import { ResearchModule } from '../research.module.js';
import { ResearchController } from './research.controller.js';
import { RobustnessController } from './robustness.controller.js';

/** HTTP API for the research agent (kept out of the CLI app). */
@Module({
  imports: [ResearchModule],
  controllers: [ResearchController, RobustnessController],
})
export class ResearchApiModule {}
