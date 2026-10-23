import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AccountContext } from '../accounts/account-context.js';
import { stripUndefined } from '../backtest/runs/run-fingerprint.js';
import { DeploymentRun } from './deployment.schema.js';
import type { Deployment } from './deployment.types.js';

/** Reads and saves the current account's deployments (the whole document, after each change). */
@Injectable()
export class DeploymentStore {
  constructor(
    @InjectModel(DeploymentRun.name)
    private readonly runs: Model<DeploymentRun>,
  ) {}

  async save(d: Deployment): Promise<void> {
    d.updatedAt = new Date();
    await this.runs.updateOne(
      // Another account's deployment never matches: the upsert then fails on its id.
      { _id: d.id, accountId: AccountContext.id() },
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
    return (
      (await this.runs.findOne({ _id: id, ...this.mine() }).lean())
        ?.deployment ?? null
    );
  }

  async list(): Promise<Deployment[]> {
    return (
      await this.runs.find(this.mine()).sort({ createdAt: -1 }).lean()
    ).map((r) => r.deployment);
  }

  /** Active and paused deployments (they own their symbols and capital). */
  async live(): Promise<Deployment[]> {
    return (
      await this.runs
        .find({ ...this.mine(), status: { $ne: 'stopped' } })
        .lean()
    ).map((r) => r.deployment);
  }

  /** Stopped deployments whose final sells may still be filling. */
  async stoppedWithPending(): Promise<Deployment[]> {
    const stopped = await this.runs
      .find({ ...this.mine(), status: 'stopped' })
      .lean();
    return stopped
      .map((r) => r.deployment)
      .filter((d) => d.ledgers.some((l) => l.pending.length > 0));
  }

  /** How many deployments of an account still run (active or paused). */
  countLive(accountId: string): Promise<number> {
    return this.runs.countDocuments({ accountId, status: { $ne: 'stopped' } });
  }

  private mine() {
    return { accountId: AccountContext.id() };
  }
}
