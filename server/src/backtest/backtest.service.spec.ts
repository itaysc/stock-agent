import { makeBars } from '../../test/support/bars.js';
import type { AlpacaService } from '../alpaca/alpaca.service.js';
import { parseTimeframe, timeframeMinutes } from '../strategies/timeframe.js';
import { type BacktestRequest, BacktestService } from './backtest.service.js';

const request: BacktestRequest = {
  strategy: 'sma-crossover',
  symbols: ['aapl', ' msft '],
  params: { fast: '2', slow: '3' },
  timeframe: '1Day',
  from: new Date('2025-01-01'),
  to: new Date('2025-02-01'),
  initialCash: 10_000,
  slippageBps: 5,
  feePerShare: 0,
};

describe('BacktestService', () => {
  it('fetches split/dividend-adjusted bars in one request for all symbols, and caches them', async () => {
    const getBarsMany = vi.fn(async (symbols: string[]) =>
      Object.fromEntries(
        symbols.map((symbol) => [
          symbol,
          makeBars(symbol, [1, 2, 3, 4, 5]).map(
            ({ symbol: _s, ...bar }) => bar,
          ),
        ]),
      ),
    );
    const service = new BacktestService({
      getBarsMany,
    } as unknown as AlpacaService);

    const { result, bars } = await service.run(request);

    expect(getBarsMany).toHaveBeenCalledTimes(1);
    expect(getBarsMany).toHaveBeenCalledWith(['AAPL', 'MSFT'], {
      timeframe: '1Day',
      start: request.from,
      end: request.to,
      adjustment: 'all',
    });
    expect(result.symbols).toEqual(['AAPL', 'MSFT']);
    expect(result.bars).toBe(5);
    expect(bars.AAPL[0].symbol).toBe('AAPL');

    // The same range again: from the cache, as copies (news is attached to them).
    const again = await service.fetchBars(['AAPL', 'MSFT'], request);
    expect(getBarsMany).toHaveBeenCalledTimes(1);
    expect(again.AAPL[0]).toEqual(bars.AAPL[0]);
    expect(again.AAPL[0]).not.toBe(bars.AAPL[0]);
  });

  it('rejects invalid requests before fetching data', async () => {
    const getBarsMany = vi.fn();
    const service = new BacktestService({
      getBarsMany,
    } as unknown as AlpacaService);

    await expect(
      service.run({ ...request, from: new Date('nope') }),
    ).rejects.toThrow(/valid dates/);
    await expect(
      service.run({ ...request, from: request.to, to: request.from }),
    ).rejects.toThrow(/before/);
    await expect(service.run({ ...request, initialCash: 0 })).rejects.toThrow(
      /cash/,
    );
    expect(getBarsMany).not.toHaveBeenCalled();
  });
});

describe('parseTimeframe', () => {
  it('accepts Alpaca timeframes and rejects others', () => {
    expect(parseTimeframe('15Min')).toBe('15Min');
    expect(parseTimeframe('1Day')).toBe('1Day');
    expect(() => parseTimeframe('1d')).toThrow(/Invalid timeframe/);
  });

  it('converts intraday timeframes to minutes for the live runner', () => {
    expect(timeframeMinutes('1Min')).toBe(1);
    expect(timeframeMinutes('15Min')).toBe(15);
    expect(timeframeMinutes('2Hour')).toBe(120);
    expect(() => timeframeMinutes('1Day')).toThrow(/minute and hour/);
  });
});
