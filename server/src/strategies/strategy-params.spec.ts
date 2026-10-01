import { createStrategy, listStrategies } from './strategy-registry.js';

const make =
  (name: string, params: Record<string, string>, symbols = ['AAPL']) =>
  () =>
    createStrategy(name, symbols, params);

describe('strategy param limits', () => {
  it('rejects values outside each param range with a clear message', () => {
    expect(make('sma-crossover', { allocation: '2' })).toThrow(
      'allocation must be between 0.01 and 1 (got 2)',
    );
    expect(make('sma-crossover', { allocation: '0' })).toThrow(
      /allocation must be between/,
    );
    expect(make('sma-crossover', { fast: '0' })).toThrow(
      'fast must be at least 1 (got 0)',
    );
    expect(make('rsi-reversion', { overbought: '120' })).toThrow(
      'overbought must be between 1 and 99 (got 120)',
    );
  });

  it('requires whole numbers where it matters', () => {
    expect(make('sma-crossover', { fast: '10.5' })).toThrow(
      'fast must be a whole number',
    );
    expect(make('rsi-reversion', { trend: '2.5' })).toThrow(
      'trend must be a whole number',
    );
  });

  it('checks relations between params, including defaults', () => {
    expect(make('sma-crossover', { fast: '60' })).toThrow(
      'fast must be less than slow (60 vs 50)',
    );
    expect(make('rsi-reversion', { oversold: '75' })).toThrow(
      'oversold must be less than overbought (75 vs 70)',
    );
  });

  it('accepts valid values and the computed allocation default', () => {
    expect(
      make('sma-crossover', { fast: '5', slow: '15', allocation: '0.95' }),
    ).not.toThrow();
    expect(make('sma-crossover', {}, ['AAPL', 'MSFT', 'NVDA'])).not.toThrow(); // 1/3
  });

  it('publishes limits and explanations for the UI', () => {
    const sma = listStrategies().find((s) => s.name === 'sma-crossover');
    expect(sma?.params).toEqual([
      expect.objectContaining({
        name: 'fast',
        default: 20,
        min: 1,
        integer: true,
        lessThan: 'slow',
      }),
      expect.objectContaining({
        name: 'slow',
        default: 50,
        min: 2,
        integer: true,
      }),
      expect.objectContaining({
        name: 'allocation',
        default: null,
        min: 0.01,
        max: 1,
      }),
    ]);
    for (const s of listStrategies()) {
      for (const p of s.params)
        expect(p.description.length).toBeGreaterThan(10);
    }
  });
});
