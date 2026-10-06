import type { AlpacaService } from '../alpaca/alpaca.service.js';
import { LivePricesService } from './live-prices.service.js';

describe('LivePricesService', () => {
  const trades = { AAPL: { price: 200, at: new Date('2026-10-05T14:30:00Z') } };
  const make = () => {
    const getLatestTrades = vi.fn(async () => trades);
    const service = new LivePricesService({
      getLatestTrades,
    } as unknown as AlpacaService);
    return { service, getLatestTrades };
  };

  it('asks Alpaca once a minute for the same stocks, in any order', async () => {
    const { service, getLatestTrades } = make();
    expect(await service.prices(['AAPL', 'MSFT'])).toEqual({ prices: trades });
    await service.prices(['MSFT', 'AAPL', 'AAPL']);
    expect(getLatestTrades).toHaveBeenCalledTimes(1);
    expect(getLatestTrades).toHaveBeenCalledWith(['AAPL', 'MSFT']);
  });

  it('asks again for a different list', async () => {
    const { service, getLatestTrades } = make();
    await service.prices(['AAPL']);
    await service.prices(['NVDA']);
    expect(getLatestTrades).toHaveBeenCalledTimes(2);
  });
});
