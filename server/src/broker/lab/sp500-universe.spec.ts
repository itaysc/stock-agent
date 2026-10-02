import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StrategyBar } from '../../strategies/strategy.types.js';

const DAY_MS = 86_400_000;
const daily = (
  symbol: string,
  from: string,
  days: number,
  dollars: number,
): StrategyBar[] =>
  Array.from({ length: days }, (_, i) => ({
    symbol,
    timestamp: new Date(new Date(from).getTime() + i * DAY_MS),
    open: 10,
    high: 10,
    low: 10,
    close: 10,
    volume: dollars / 10,
  }));
vi.mock('./yahoo-history.js', () => ({
  yahooDaily: async () => ({
    BIG: daily('BIG', '2019-01-01', 1300, 9e9),
    MID: daily('MID', '2019-01-01', 1300, 5e9),
    SMALL: daily('SMALL', '2019-01-01', 1300, 1e9),
    NEWCO: daily('NEWCO', '2020-08-01', 700, 99e9), // listed Aug 2020: too little history for 2021
  }),
}));
const { sp500Top } = await import('./sp500-universe.js');

describe('point-in-time S&P universe', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sp500-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('takes the most-traded members of each January 1st, only while they are in the index', async () => {
    const file = join(dir, 'spans.csv');
    writeFileSync(
      file,
      [
        'ticker,start_date,end_date',
        'BIG,2000-01-01,2021-06-30',
        'MID,2000-01-01,',
        'SMALL,2000-01-01,',
        'NEWCO,2020-08-01,',
        'GONE,2000-01-01,',
      ].join('\n'),
    );
    const u = await sp500Top(
      2,
      new Date('2020-01-01'),
      new Date('2022-06-01'),
      file,
      dir,
    );
    expect(u.yearly.get(2020)).toEqual(['BIG', 'MID']);
    expect(u.yearly.get(2021)).toEqual(['BIG', 'MID']); // NEWCO: under a year of history
    expect(u.yearly.get(2022)).toEqual(['NEWCO', 'MID']); // BIG left the index in 2021
    expect(u.missing).toEqual(['GONE']);
    expect(u.allowed('BIG', new Date('2021-03-01'))).toBe(true);
    expect(u.allowed('BIG', new Date('2022-03-01'))).toBe(false);
  });
});
