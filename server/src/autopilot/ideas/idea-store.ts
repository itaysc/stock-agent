import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AccountContext } from '../../accounts/account-context.js';
import { stripUndefined } from '../../backtest/runs/run-fingerprint.js';
import { IdeaDoc } from './idea.schema.js';
import type { Idea } from './idea.types.js';

/** The current account's ideas. */
@Injectable()
export class IdeaStore {
  constructor(
    @InjectModel(IdeaDoc.name) private readonly model: Model<IdeaDoc>,
  ) {}

  async save(idea: Idea): Promise<void> {
    await this.model.updateOne(
      { _id: idea.id, accountId: AccountContext.id() },
      { $set: { status: idea.status, idea: stripUndefined(idea) } },
      { upsert: true },
    );
  }

  async get(id: string): Promise<Idea | null> {
    return (
      (
        await this.model
          .findOne({ _id: id.toLowerCase(), accountId: AccountContext.id() })
          .lean()
      )?.idea ?? null
    );
  }

  /** The account an idea belongs to (answers from Telegram come without one). */
  async accountOf(id: string): Promise<string | null> {
    const doc = await this.model
      .findById(id.toLowerCase(), { accountId: 1 })
      .lean();
    return doc?.accountId ?? null;
  }

  async pending(): Promise<Idea[]> {
    return (
      await this.model
        .find({ accountId: AccountContext.id(), status: 'pending' })
        .sort({ createdAt: -1 })
        .lean()
    ).map((d) => d.idea);
  }

  async recent(limit = 20): Promise<Idea[]> {
    return (
      await this.model
        .find({ accountId: AccountContext.id() })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
    ).map((d) => d.idea);
  }
}
