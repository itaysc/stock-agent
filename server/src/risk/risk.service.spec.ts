import type { ConfigService } from '@nestjs/config';
import type { AlpacaService } from '../alpaca/alpaca.service.js';
import type { Env } from '../config/env.js';
import type { KillSwitchService } from './kill-switch.service.js';
import { RiskService } from './risk.service.js';

const limits = {
  RISK_MAX_POSITION_VALUE: 10_000,
  RISK_MAX_TOTAL_EXPOSURE: 25_000,
  RISK_MAX_DAILY_LOSS: 1_000,
  RISK_MAX_ORDERS_PER_MINUTE: 3,
};

function setup({
  equity = 100_000,
  lastEquity = 100_000,
  killed = false,
} = {}) {
  const alpaca = {
    getAccount: vi.fn(async () => ({
      equity: String(equity),
      lastEquity: String(lastEquity),
    })),
    getPositions: vi.fn(async () => [
      { symbol: 'AAPL', qty: '10', marketValue: '2000' },
      { symbol: 'MSFT', qty: '20', marketValue: '8000' },
    ]),
    getLatestPrice: vi.fn(async () => 200),
  };
  const killSwitch = {
    state: vi.fn(async () => ({ engaged: killed, reason: 'manual stop' })),
  };
  const config = {
    get: (key: keyof typeof limits) => limits[key],
  } as unknown as ConfigService<Env, true>;
  const risk = new RiskService(
    config,
    alpaca as unknown as AlpacaService,
    killSwitch as unknown as KillSwitchService,
  );
  return { risk, alpaca };
}

const order = (side: 'buy' | 'sell', symbol: string, qty: number) =>
  ({ type: 'market', side, symbol, qty, clientOrderId: 'c1' }) as const;

describe('RiskService', () => {
  it('allows an order within all limits', async () => {
    const { risk } = setup();
    await expect(risk.check(order('buy', 'AAPL', 10))).resolves.toBeUndefined();
  });

  it('blocks every order while the kill switch is engaged', async () => {
    const { risk } = setup({ killed: true });
    await expect(risk.check(order('sell', 'AAPL', 1))).rejects.toThrow(
      /kill switch engaged \(manual stop\)/,
    );
  });

  it('blocks buys after the daily loss limit but still allows reducing sells', async () => {
    const { risk } = setup({ equity: 98_900, lastEquity: 100_000 });
    await expect(risk.check(order('buy', 'AAPL', 1))).rejects.toThrow(
      /daily loss limit reached/,
    );
    await expect(
      risk.check(order('sell', 'AAPL', 10)),
    ).resolves.toBeUndefined();
  });

  it('caps the value of a single position', async () => {
    const { risk } = setup();
    // MSFT is $8,000; +11 × $200 = $10,200 > $10,000
    await expect(risk.check(order('buy', 'MSFT', 11))).rejects.toThrow(
      /position would be \$10200.00, limit \$10000.00/,
    );
  });

  it('caps total exposure across positions', async () => {
    const { risk, alpaca } = setup();
    alpaca.getPositions.mockResolvedValue([
      { symbol: 'AAPL', qty: '45', marketValue: '9000' },
      { symbol: 'MSFT', qty: '20', marketValue: '9000' },
    ]);
    // New NVDA position of $7,000 is under the $10,000 position cap:
    // $18,000 + $7,000 = $25,000 is allowed, $18,000 + $8,000 is not.
    await expect(risk.check(order('buy', 'NVDA', 35))).resolves.toBeUndefined();
    await expect(risk.check(order('buy', 'NVDA', 40))).rejects.toThrow(
      /total exposure would be \$26000.00, limit \$25000.00/,
    );
  });

  it('refuses shorting: sells beyond the position or with no position', async () => {
    const { risk } = setup();
    await expect(risk.check(order('sell', 'AAPL', 11))).rejects.toThrow(
      /short position in AAPL/,
    );
    await expect(risk.check(order('sell', 'TSLA', 1))).rejects.toThrow(
      /short position in TSLA/,
    );
    await expect(
      risk.check({
        ...order('sell', 'AAPL', 0),
        qty: undefined,
        notional: 2500,
      }),
    ).rejects.toThrow(/short position/);
  });

  it('limits orders per minute, then lets them through again', async () => {
    const { risk } = setup();
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++)
      await risk.check(order('buy', 'AAPL', 1), t0 + i);
    await expect(risk.check(order('sell', 'AAPL', 1), t0 + 10)).rejects.toThrow(
      /more than 3 orders in the last minute/,
    );
    await expect(
      risk.check(order('buy', 'AAPL', 1), t0 + 60_001),
    ).resolves.toBeUndefined();
  });

  it('sizes limit orders at the limit price without fetching a quote', async () => {
    const { risk, alpaca } = setup();
    await expect(
      risk.check({
        ...order('buy', 'AAPL', 100),
        type: 'limit',
        limitPrice: 50,
      }),
    ).resolves.toBeUndefined(); // 2,000 + 5,000
    expect(alpaca.getLatestPrice).not.toHaveBeenCalled();
  });

  it('rejects a market buy when no price is available', async () => {
    const { risk, alpaca } = setup();
    alpaca.getLatestPrice.mockResolvedValue(undefined as unknown as number);
    await expect(risk.check(order('buy', 'AAPL', 1))).rejects.toThrow(
      /no price available/,
    );
  });
});
