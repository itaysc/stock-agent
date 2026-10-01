import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { roundQty } from '../strategies/qty.js';
import { DeploymentRunnerService } from './deployment-runner.service.js';
import { DeploymentStore } from './deployment-store.js';
import { logEvent } from './deployment-events.js';
import type { Deployment, ManualLevels } from './deployment.types.js';
import { holdOff } from './manual-exits.js';

const usd = (n: number) => `$${n.toFixed(2)}`;

/** What you can do with one holding of a deployment: sell it now, set your own levels, allow it again. */
@Injectable()
export class PositionActionsService {
  constructor(
    private readonly store: DeploymentStore,
    private readonly runner: DeploymentRunnerService,
  ) {}

  /** Sells `fraction` of the holding now (at the market, or at the next open). */
  async sell(
    id: string,
    symbol: string,
    fraction: number,
  ): Promise<Deployment> {
    const { d, sleeve, position } = await this.holding(id, symbol);
    if (!(fraction > 0 && fraction <= 1))
      throw new BadRequestException('fraction must be between 0 and 1');
    if (d.ledgers[sleeve].pending.some((o) => o.symbol === position.symbol))
      throw new BadRequestException(
        `An order for ${position.symbol} is already waiting to fill`,
      );
    const qty =
      fraction === 1 ? position.qty : roundQty(position.qty * fraction, true);
    if (!(qty > 0)) throw new BadRequestException('Nothing to sell');
    const now = new Date();
    await this.runner.placeNow(
      d,
      sleeve,
      {
        symbol: position.symbol,
        side: 'sell',
        qty,
        reason:
          fraction === 1
            ? 'sold by you'
            : `sold ${Math.round(fraction * 100)}% by you`,
      },
      'you sold it',
    );
    if (!d.ledgers[sleeve].pending.some((o) => o.symbol === position.symbol))
      throw new BadRequestException(
        d.events.at(-1)?.message ?? 'The order was not sent',
      );
    // Selling it all: the strategy leaves it alone for a while (it would buy it back otherwise).
    if (fraction === 1) {
      holdOff(d, position.symbol, now);
      delete d.manual?.[position.symbol];
    }
    d.ledgers[sleeve].staged = (d.ledgers[sleeve].staged ?? []).filter(
      (b) => b.symbol !== position.symbol,
    );
    await this.store.save(d);
    return d;
  }

  /** Your own stop loss and/or profit target (null clears one). */
  async setLevels(
    id: string,
    symbol: string,
    levels: ManualLevels,
  ): Promise<Deployment> {
    const { d, sleeve, position } = await this.holding(id, symbol);
    const price =
      d.ledgers[sleeve].lastPrices[position.symbol] ?? position.avgPrice;
    const { stopPrice, takeProfitPrice } = levels;
    if (stopPrice != null && !(stopPrice > 0 && stopPrice < price))
      throw new BadRequestException(
        `The stop loss must be below the latest close (${usd(price)}); to sell now, use Sell`,
      );
    if (takeProfitPrice != null && !(takeProfitPrice > price))
      throw new BadRequestException(
        `The profit target must be above the latest close (${usd(price)}); to sell now, use Sell`,
      );
    const next = { ...d.manual?.[position.symbol], ...levels };
    const on = (n: number | null | undefined) => n != null;
    if (on(next.stopPrice) || on(next.takeProfitPrice))
      (d.manual ??= {})[position.symbol] = next;
    else delete d.manual?.[position.symbol];
    logEvent(
      d,
      `Your levels for ${position.symbol}: stop ${on(next.stopPrice) ? usd(next.stopPrice as number) : 'automatic'}, profit target ${on(next.takeProfitPrice) ? usd(next.takeProfitPrice as number) : 'none'}`,
      new Date(),
    );
    await this.store.save(d);
    return d;
  }

  /** Lets the strategy buy a symbol you sold again. */
  async allow(id: string, symbol: string): Promise<Deployment> {
    const d = await this.deployment(id);
    delete d.noBuyUntil?.[symbol.toUpperCase()];
    await this.store.save(d);
    return d;
  }

  private async deployment(id: string): Promise<Deployment> {
    const d = await this.store.get(id);
    if (!d) throw new NotFoundException(`No deployment ${id}`);
    if (d.status === 'stopped') throw new BadRequestException('It is stopped');
    return d;
  }

  private async holding(id: string, symbol: string) {
    const d = await this.deployment(id);
    const s = symbol.toUpperCase();
    const sleeve = d.ledgers.findIndex((l) => l.positions[s]);
    if (sleeve < 0) throw new NotFoundException(`It does not hold ${s}`);
    return { d, sleeve, position: d.ledgers[sleeve].positions[s] };
  }
}
