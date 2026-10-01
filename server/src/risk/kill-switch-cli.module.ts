import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { RiskModule } from './risk.module.js';

/** Minimal app for the kill-switch CLI: config, MongoDB and Alpaca REST. */
@Module({
  imports: [AppConfigModule, DatabaseModule, RiskModule],
})
export class KillSwitchCliModule {}
