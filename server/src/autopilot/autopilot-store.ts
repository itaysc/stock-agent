import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { stripUndefined } from '../backtest/runs/run-fingerprint.js';
import { AutopilotRunDoc, AutopilotSettingsDoc } from './autopilot.schema.js';
import {
  type AutopilotRun,
  type AutopilotSettings,
  DEFAULT_SETTINGS,
} from './autopilot.types.js';

const ID = 'settings';

@Injectable()
export class AutopilotStore {
  constructor(
    @InjectModel(AutopilotSettingsDoc.name)
    private readonly settingsModel: Model<AutopilotSettingsDoc>,
    @InjectModel(AutopilotRunDoc.name)
    private readonly runs: Model<AutopilotRunDoc>,
  ) {}

  async settings(): Promise<AutopilotSettings> {
    const doc = await this.settingsModel.findById(ID).lean();
    return { ...DEFAULT_SETTINGS, ...doc?.settings };
  }

  async saveSettings(settings: AutopilotSettings): Promise<void> {
    await this.settingsModel.updateOne(
      { _id: ID },
      { $set: { settings: stripUndefined(settings) } },
      { upsert: true },
    );
  }

  async saveRun(run: AutopilotRun): Promise<void> {
    await this.runs.updateOne(
      { _id: run.id },
      { $set: { run: stripUndefined(run) } },
      { upsert: true },
    );
  }

  async recentRuns(limit = 20): Promise<AutopilotRun[]> {
    return (
      await this.runs.find().sort({ createdAt: -1 }).limit(limit).lean()
    ).map((r) => r.run);
  }
}
