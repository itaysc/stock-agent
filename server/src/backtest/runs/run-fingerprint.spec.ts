import { makeBars } from '../../../test/support/bars.js';
import { formatRunStatus } from './run-status.format.js';
import { dataHash, type RunConfig, runFingerprint } from './run-fingerprint.js';

const config: RunConfig = {
  strategy: 'sma-crossover',
  params: { fast: 20, slow: 50, allocation: 1 },
  symbols: ['AAPL'],
  timeframe: '1Day',
  from: new Date('2025-01-01T00:00:00Z'),
  to: new Date('2025-06-01T00:00:00Z'),
  initialCash: 100_000,
  slippageBps: 5,
  feePerShare: 0,
};

describe('runFingerprint', () => {
  it('is stable and ignores param order', () => {
    const reordered = {
      ...config,
      params: { allocation: 1, slow: 50, fast: 20 },
    };
    expect(runFingerprint(reordered)).toBe(runFingerprint(config));
    expect(runFingerprint(config)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes with anything that changes the result', () => {
    const base = runFingerprint(config);
    const variants: Partial<RunConfig>[] = [
      { params: { ...config.params, fast: 21 } },
      { symbols: ['MSFT'] },
      { timeframe: '1Hour' },
      { to: new Date('2025-06-02T00:00:00Z') },
      { initialCash: 50_000 },
      { slippageBps: 10 },
      { feePerShare: 0.01 },
    ];
    for (const v of variants)
      expect(runFingerprint({ ...config, ...v })).not.toBe(base);
  });

  it('keeps symbol order (it decides who acts first on a shared bar)', () => {
    const ab = runFingerprint({ ...config, symbols: ['AAPL', 'MSFT'] });
    const ba = runFingerprint({ ...config, symbols: ['MSFT', 'AAPL'] });
    expect(ab).not.toBe(ba);
  });
});

describe('dataHash', () => {
  it('changes when any price changes', () => {
    const bars = makeBars('AAPL', [1, 2, 3]);
    const same = makeBars('AAPL', [1, 2, 3]);
    const changed = makeBars('AAPL', [1, 2, 3.01]);
    expect(dataHash({ AAPL: bars })).toBe(dataHash({ AAPL: same }));
    expect(dataHash({ AAPL: bars })).not.toBe(dataHash({ AAPL: changed }));
  });
});

describe('formatRunStatus', () => {
  it('explains where the result came from', () => {
    expect(formatRunStatus({ kind: 'new' })).toMatch(/new test, saved/);
    expect(
      formatRunStatus({
        kind: 'reused',
        savedAt: new Date('2026-09-26T18:20:00Z'),
      }),
    ).toBe(
      'Run history: same test saved on 2026-09-26 18:20 UTC, reused (use --fresh to re-run).',
    );
    expect(
      formatRunStatus({ kind: 'replaced', reason: 'engine v1 → v2' }),
    ).toMatch(/stale \(engine v1 → v2\), re-ran and replaced/);
  });
});
