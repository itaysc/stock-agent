import { comboCount, countValues } from './paramGrid';

describe('countValues (mirrors the server grammar)', () => {
  it('counts single values, lists and ranges', () => {
    expect(countValues('')).toEqual({ count: 1 });
    expect(countValues('10')).toEqual({ count: 1 });
    expect(countValues('5, 10,20')).toEqual({ count: 3 });
    expect(countValues('5..30:5')).toEqual({ count: 6 });
    expect(countValues('3..6')).toEqual({ count: 4 });
    expect(countValues('0.1..0.3:0.1')).toEqual({ count: 3 });
  });

  it('flags malformed specs', () => {
    expect(countValues('30..5').error).toMatch(/start\.\.end/);
    expect(countValues('1..5:0').error).toBeDefined();
    expect(countValues('abc').error).toMatch(/Numbers only/);
  });

  it('multiplies params into a run count', () => {
    expect(comboCount({ fast: '5..30:5', slow: '20,50,100' })).toBe(18);
    expect(comboCount({})).toBe(1);
  });
});
