import { Injectable } from '@nestjs/common';
import { InjectModel, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AccountContext } from '../accounts/account-context.js';
import { stripUndefined } from '../backtest/runs/run-fingerprint.js';
import type { BrokerState } from './broker.types.js';
import { DEFAULT_PARAMS } from './universe.js';

@Schema({ collection: 'broker_state', timestamps: true })
export class BrokerStateDoc {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Object, required: true })
  state: BrokerState;
}
export const BrokerStateSchema = SchemaFactory.createForClass(BrokerStateDoc);

/** One broker per account: `broker:<account number>`. */
const id = () => `broker:${AccountContext.id()}`;
const INITIAL: BrokerState = {
  deploymentId: null,
  params: DEFAULT_PARAMS,
  lastReportAt: null,
  lastReportedBarAt: null,
  lastTune: null,
};

@Injectable()
export class BrokerStore {
  constructor(
    @InjectModel(BrokerStateDoc.name)
    private readonly model: Model<BrokerStateDoc>,
  ) {}

  async get(): Promise<BrokerState> {
    const doc = await this.model.findById(id()).lean();
    return { ...INITIAL, ...doc?.state };
  }

  async save(state: BrokerState): Promise<void> {
    await this.model.updateOne(
      { _id: id() },
      { $set: { state: stripUndefined(state) } },
      { upsert: true },
    );
  }
}
