import { MomentumRotationStrategy } from '../strategies/rotation/momentum-rotation.strategy.js';
import type { Runtime } from './deployment-runtime.js';
import type { Deployment } from './deployment.types.js';
import { NO_BUY_DAYS } from './manual-exits.js';

const DAY_MS = 86_400_000;

/** You sold `symbol` by hand: the strategy skips it for NO_BUY_DAYS (the next in line takes its place). */
export function markSoldByYou(d: Deployment, symbol: string, now: Date): void {
  (d.soldByYou ??= {})[symbol] = new Date(now.getTime() + NO_BUY_DAYS * DAY_MS);
}

export const soldByYou = (d: Deployment, symbol: string, now: Date) => {
  const until = d.soldByYou?.[symbol];
  return !!until && new Date(until) > now;
};

/** Every sleeve's empty slots (you sold a stock and chose to leave its place empty). */
export const emptySlots = (d: Deployment) =>
  d.ledgers.reduce((n, l) => n + (l.emptySlots ?? 0), 0);

/** Before the strategies decide: what you sold by hand and the slots you left empty. */
export function steerStrategies(
  d: Deployment,
  runtime: Runtime,
  now: Date,
): void {
  runtime.sleeves.forEach((s, i) => {
    if (s.strategy instanceof MomentumRotationStrategy)
      s.strategy.steer = {
        skip: (symbol) => soldByYou(d, symbol, now),
        emptySlots: d.ledgers[i]?.emptySlots ?? 0,
      };
  });
}
