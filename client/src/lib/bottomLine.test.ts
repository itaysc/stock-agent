import { type BottomLineInput, bottomLine, scoreOf } from './bottomLine';

const base: BottomLineInput = {
  name: 'rules',
  symbols: ['AAPL'],
  from: '2021-01-01',
  to: '2026-01-01',
  startCash: 100_000,
  endCash: 100_000,
  holdReturnPct: 0,
  worstDropPct: 10,
  holdWorstDropPct: 20,
  trades: 30,
  winRatePct: 50,
  unseen: true,
};
const run = (over: Partial<BottomLineInput>) => bottomLine({ ...base, ...over });

describe('bottom line (plain-words summary)', () => {
  it('scores a strategy that trails buy & hold as weak or poor', () => {
    // The AAPL example: +29.8% in 5 years vs +124.96% for holding.
    const b = run({ endCash: 129_758, holdReturnPct: 124.96, worstDropPct: 12.6 });
    expect(b.verdict).toBe('Made money, but less than simply buying and holding.');
    expect(b.grade).toMatch(/Poor|Weak/);
    expect(b.gain).toBeCloseTo(29_758);
    expect(b.holdEnd).toBeCloseTo(224_960);
    expect(b.vsHold).toBeCloseTo(129_758 - 224_960);
  });

  it('scores beating buy & hold with small drops as good or great', () => {
    const b = run({ endCash: 250_000, holdReturnPct: 60, worstDropPct: 8 });
    expect(b.verdict).toBe('Made money, and more than simply buying and holding.');
    expect(b.score).toBeGreaterThanOrEqual(75);
    expect(b.trust).toBe('high');
  });

  it('says so plainly when it lost money', () => {
    const b = run({ endCash: 80_000, holdReturnPct: 10, worstDropPct: 35 });
    expect(b.verdict).toBe('Lost money.');
    expect(b.score).toBeLessThan(40);
    expect(b.color).toBe('red');
  });

  it('keeps the score between 0 and 100', () => {
    expect(scoreOf({ ...base, endCash: 1_000, holdReturnPct: 500, worstDropPct: 99 })).toBe(0);
    expect(scoreOf({ ...base, endCash: 1_000_000, holdReturnPct: 0, worstDropPct: 1 })).toBe(100);
  });

  it('trusts few trades, fixed-setting backtests and hindsight picks less', () => {
    expect(run({ trades: 3 }).trust).toBe('low');
    expect(run({ unseen: false }).trust).toBe('medium');
    expect(run({ unseen: false, hindsight: true }).trust).toBe('low');
    expect(run({ trades: 12 }).trust).toBe('medium');
  });
});
