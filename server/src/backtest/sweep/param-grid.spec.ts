import {
  expandGrid,
  MAX_COMBINATIONS,
  parseParamGrid,
  parseParamSpec,
} from './param-grid.js';

describe('parseParamSpec', () => {
  it('parses single values, lists and ranges', () => {
    expect(parseParamSpec('fast=10')).toEqual(['fast', ['10']]);
    expect(parseParamSpec('fast=5, 10,20')).toEqual([
      'fast',
      ['5', '10', '20'],
    ]);
    expect(parseParamSpec('fast=3..6')).toEqual(['fast', ['3', '4', '5', '6']]);
    expect(parseParamSpec('slow=20..50:10')).toEqual([
      'slow',
      ['20', '30', '40', '50'],
    ]);
  });

  it('handles decimal steps without float drift', () => {
    expect(parseParamSpec('allocation=0.1..0.3:0.1')[1]).toEqual([
      '0.1',
      '0.2',
      '0.3',
    ]);
  });

  it('rejects malformed specs', () => {
    expect(() => parseParamSpec('fast')).toThrow(/key=value/);
    expect(() => parseParamSpec('fast=')).toThrow(/no value/);
    expect(() => parseParamSpec('fast=10..5')).toThrow(/Invalid range/);
    expect(() => parseParamSpec('fast=1..5:0')).toThrow(/Invalid range/);
  });
});

describe('expandGrid', () => {
  it('builds every combination', () => {
    const grid = parseParamGrid(['fast=5,10', 'slow=20,50,100']);
    const combos = expandGrid(grid);
    expect(combos).toHaveLength(6);
    expect(combos).toContainEqual({ fast: '10', slow: '100' });
  });

  it('is a single default run for an empty grid', () => {
    expect(expandGrid({})).toEqual([{}]);
  });

  it('refuses huge sweeps', () => {
    expect(() =>
      expandGrid({ a: Array(MAX_COMBINATIONS + 1).fill('1') }),
    ).toThrow(/combinations/);
  });
});
