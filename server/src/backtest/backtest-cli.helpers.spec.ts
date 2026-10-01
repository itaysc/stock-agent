import { resolvePeriod, resolveSymbols } from './backtest-cli.helpers.js';

describe('backtest CLI helpers', () => {
  it('defaults to the last two years', () => {
    expect(resolvePeriod(undefined, '2026-09-25')).toEqual({
      from: '2024-09-25',
      to: '2026-09-25',
    });
    expect(resolvePeriod('2025-01-01', '2025-06-01')).toEqual({
      from: '2025-01-01',
      to: '2025-06-01',
    });
    expect(resolvePeriod().to).toBe(new Date().toISOString().slice(0, 10));
  });

  it('accepts symbols as a flag, positionals, or both', () => {
    expect(resolveSymbols('aapl, msft', [])).toEqual(['AAPL', 'MSFT']);
    expect(resolveSymbols(undefined, ['aapl', 'tsla,nvda'])).toEqual([
      'AAPL',
      'TSLA',
      'NVDA',
    ]);
    expect(resolveSymbols(undefined, [])).toEqual([]);
  });
});
