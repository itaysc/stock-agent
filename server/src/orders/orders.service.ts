import type { trading } from '@alpacahq/alpaca-trade-api';
import { Injectable, Logger } from '@nestjs/common';
import {
  AlpacaService,
  isFetchError,
  type PlaceOrderInput,
} from '../alpaca/alpaca.service.js';
import { RiskRejectedError } from '../risk/risk.errors.js';
import { RiskService } from '../risk/risk.service.js';
import { OrderLogService } from './order-log.service.js';

/**
 * The app's entry point for placing orders (strategies use this, not
 * AlpacaService directly). Every order passes the risk checks, and is saved
 * before it is sent, so a crash mid-request still leaves a record to reconcile.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly alpaca: AlpacaService,
    private readonly log: OrderLogService,
    private readonly risk: RiskService,
  ) {}

  async placeOrder(input: PlaceOrderInput): Promise<trading.Order> {
    try {
      await this.risk.check(input);
    } catch (err) {
      if (err instanceof RiskRejectedError) {
        this.logger.warn(`${input.clientOrderId}: ${err.message}`);
        await this.log
          .recordRiskRejected(input, err.reason)
          .catch((logErr: Error) =>
            this.logger.error(
              `Failed to save risk rejection: ${logErr.message}`,
            ),
          );
      }
      throw err;
    }

    await this.log.recordIntent(input);

    let order: trading.Order;
    try {
      order = await this.alpaca.placeOrder(input);
    } catch (err) {
      const status = isFetchError(err) ? 'unknown' : 'submit_failed';
      await this.log
        .recordSubmitFailed(input.clientOrderId, status, (err as Error).message)
        .catch((logErr: Error) =>
          this.logger.error(
            `Failed to save ${status} for ${input.clientOrderId}: ${logErr.message}`,
          ),
        );
      throw err;
    }

    // The order exists at Alpaca now: a failed DB write must not look like a
    // failed order (the trade updates stream will still bring the status in).
    await this.log
      .recordSubmitted(input.clientOrderId, order)
      .catch((err: Error) =>
        this.logger.error(
          `Order ${input.clientOrderId} placed but not saved: ${err.message}`,
        ),
      );
    return order;
  }
}
