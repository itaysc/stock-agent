/** Thrown when an order breaks a risk rule. The order is never sent to Alpaca. */
export class RiskRejectedError extends Error {
  constructor(readonly reason: string) {
    super(`Order rejected by risk checks: ${reason}`);
    this.name = 'RiskRejectedError';
  }
}
