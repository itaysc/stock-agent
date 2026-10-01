import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { stripUndefined } from '../../backtest/runs/run-fingerprint.js';
import { IdeaDoc } from './idea.schema.js';
import type { Idea } from './idea.types.js';

@Injectable()
export class IdeaStore {
  constructor(
    @InjectModel(IdeaDoc.name) private readonly model: Model<IdeaDoc>,
  ) {}

  async save(idea: Idea): Promise<void> {
    await this.model.updateOne(
      { _id: idea.id },
      { $set: { status: idea.status, idea: stripUndefined(idea) } },
      { upsert: true },
    );
  }

  async get(id: string): Promise<Idea | null> {
    return (await this.model.findById(id.toLowerCase()).lean())?.idea ?? null;
  }

  async pending(): Promise<Idea[]> {
    return (
      await this.model
        .find({ status: 'pending' })
        .sort({ createdAt: -1 })
        .lean()
    ).map((d) => d.idea);
  }

  async recent(limit = 20): Promise<Idea[]> {
    return (
      await this.model.find().sort({ createdAt: -1 }).limit(limit).lean()
    ).map((d) => d.idea);
  }
}
