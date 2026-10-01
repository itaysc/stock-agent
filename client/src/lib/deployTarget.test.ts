import type { RunResponse } from '../api/types';
import { deployTargetFor } from './deployTarget';
import type { FormValues } from './form';

describe('what "Paper trade this" deploys', () => {
  it('deploys a backtest with the params it ran with, and a walk-forward’s latest pick', () => {
    const ranWith = {
      params: { rules: { breakout: '20', trailingStop: '' } },
    } as unknown as FormValues;
    const backtest = {
      kind: 'backtest',
      strategy: 'rules',
      symbols: ['AAPL'],
    } as unknown as RunResponse;
    expect(deployTargetFor(backtest, ranWith)).toEqual({
      kind: 'sleeves',
      name: 'rules on AAPL',
      sleeves: [
        { strategy: 'rules', symbols: ['AAPL'], params: { breakout: '20' }, weightPct: 100 },
      ],
    });
    const wf = {
      kind: 'walkforward',
      symbols: ['SPY'],
      windows: [
        { chosen: { strategy: 'sma-crossover', params: { fast: '5', slow: '50' } } },
        { chosen: { strategy: 'sma-crossover', params: { fast: '10', slow: '50' } } },
        { chosen: null },
      ],
    } as unknown as RunResponse;
    expect(deployTargetFor(wf, null)).toMatchObject({
      name: 'sma-crossover on SPY (latest pick)',
      sleeves: [{ params: { fast: '10', slow: '50' }, weightPct: 100 }],
    });
    expect(deployTargetFor({ kind: 'sweep' } as RunResponse, null)).toBeNull();
  });
});
