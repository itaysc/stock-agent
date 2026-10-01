import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import { RISK_STATE_ID, RiskState } from './risk-state.schema.js';

export interface KillSwitchState {
  engaged: boolean;
  reason?: string;
  changedAt?: Date;
}

/**
 * Emergency stop. While engaged, every new order is rejected. Engaging it also
 * cancels all open orders, and optionally closes every position. Stored in
 * MongoDB, so it survives restarts and a CLI can flip it for a running server.
 */
@Injectable()
export class KillSwitchService {
  private readonly logger = new Logger(KillSwitchService.name);

  constructor(
    @InjectModel(RiskState.name) private readonly model: Model<RiskState>,
    private readonly alpaca: AlpacaService,
  ) {}

  async state(): Promise<KillSwitchState> {
    const doc = await this.model
      .findById(RISK_STATE_ID)
      .lean<RiskState & { updatedAt?: Date }>();
    return {
      engaged: doc?.killSwitchEngaged ?? false,
      reason: doc?.killSwitchReason,
      changedAt: doc?.updatedAt,
    };
  }

  async engage(reason: string, options: { flatten?: boolean } = {}) {
    await this.save(true, reason);
    this.logger.warn(`KILL SWITCH ENGAGED: ${reason}`);
    const canceled = await this.alpaca.cancelAllOrders();
    const closed = options.flatten ? await this.alpaca.closeAllPositions() : [];
    return { canceledOrders: canceled.length, closedPositions: closed.length };
  }

  async release(): Promise<void> {
    await this.save(false, undefined);
    this.logger.warn('Kill switch released: trading allowed again');
  }

  private async save(engaged: boolean, reason: string | undefined) {
    await this.model.updateOne(
      { _id: RISK_STATE_ID },
      { $set: { killSwitchEngaged: engaged, killSwitchReason: reason } },
      { upsert: true },
    );
  }
}
