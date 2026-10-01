import type { StrategyInfo } from '../api/types';
import { backtestErrors, sweepErrors } from './paramRules';

const sma: StrategyInfo = {
  name: 'sma-crossover',
  description: '',
  version: 1,
  params: [
    {
      name: 'fast',
      default: 20,
      min: 1,
      integer: true,
      lessThan: 'slow',
      description: '',
    },
    { name: 'slow', default: 50, min: 2, integer: true, description: '' },
    { name: 'allocation', default: null, min: 0.01, max: 1, description: '' },
  ],
};

describe('backtestErrors (mirrors server limits)', () => {
  it('accepts defaults and valid values', () => {
    expect(backtestErrors(sma, {}, 2)).toEqual({});
    expect(backtestErrors(sma, { fast: '10', slow: '30', allocation: '0.95' }, 2)).toEqual({});
  });

  it('flags out-of-range and non-integer values', () => {
    expect(backtestErrors(sma, { allocation: '1.5' }, 1)).toEqual({
      allocation: 'Between 0.01 and 1',
    });
    expect(backtestErrors(sma, { allocation: '0' }, 1)).toEqual({
      allocation: 'Between 0.01 and 1',
    });
    expect(backtestErrors(sma, { fast: '10.5' }, 1)).toEqual({
      fast: 'Whole numbers only',
    });
  });

  it('flags fast >= slow on the field that was changed, defaults included', () => {
    expect(backtestErrors(sma, { fast: '60' }, 1)).toEqual({
      fast: 'fast must be less than slow (50)',
    });
    expect(backtestErrors(sma, { slow: '10' }, 1)).toEqual({
      slow: 'fast must be less than slow (10)',
    });
  });
});

describe('sweepErrors', () => {
  it('checks every value in a list or range', () => {
    expect(sweepErrors(sma, { fast: '5..30:5', allocation: '0.5,1' })).toEqual({});
    expect(sweepErrors(sma, { allocation: '0.5..1.5:0.5' })).toEqual({
      allocation: 'Between 0.01 and 1 (every value)',
    });
    expect(sweepErrors(sma, { fast: '0,5' })).toEqual({
      fast: 'At least 1 (every value)',
    });
    expect(sweepErrors(sma, { fast: 'abc' }).fast).toMatch(/Numbers only/);
  });
});
