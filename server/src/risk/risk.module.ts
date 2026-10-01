import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlpacaModule } from '../alpaca/alpaca.module.js';
import { KillSwitchService } from './kill-switch.service.js';
import { RiskState, RiskStateSchema } from './risk-state.schema.js';
import { RiskService } from './risk.service.js';

@Module({
  imports: [
    AlpacaModule,
    MongooseModule.forFeature([
      { name: RiskState.name, schema: RiskStateSchema },
    ]),
  ],
  providers: [KillSwitchService, RiskService],
  exports: [KillSwitchService, RiskService],
})
export class RiskModule {}
