import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { stripUndefined } from '../backtest/runs/run-fingerprint.js';
import { DeploymentRun } from './deployment.schema.js';
import type { Deployment } from './deployment.types.js';

/** Reads and saves deployments (the whole document, after each change). */
@Injectable()
export class DeploymentStore {
  constructor(
    @InjectModel(DeploymentRun.name)
    private readonly runs: Model<DeploymentRun>,
  ) {}

  async save(d: Deployment): Promise<void> {
    d.updatedAt = new Date();
    await this.runs.updateOne(
      { _id: d.id },
      {
        $set: {
          status: d.status,
          symbols: [...new Set(d.sleeves.flatMap((s) => s.symbols))],
          capital: d.capital,
          deployment: stripUndefined(d),
        },
      },
      { upsert: true },
    );
  }

  async get(id: string): Promise<Deployment | null> {
    return (await this.runs.findById(id).lean())?.deployment ?? null;
  }

  async list(): Promise<Deployment[]> {
    return (await this.runs.find().sort({ createdAt: -1 }).lean()).map(
      (r) => r.deployment,
    );
  }

  /** Active and paused deployments (they own their symbols and capital). */
  async live(): Promise<Deployment[]> {
    return (await this.runs.find({ status: { $ne: 'stopped' } }).lean()).map(
      (r) => r.deployment,
    );
  }

  /** Stopped deployments whose final sells may still be filling. */
  async stoppedWithPending(): Promise<Deployment[]> {
    const stopped = await this.runs.find({ status: 'stopped' }).lean();
    return stopped
      .map((r) => r.deployment)
      .filter((d) => d.ledgers.some((l) => l.pending.length > 0));
  }
}
