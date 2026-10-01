import { addDuration, buildWindows, parseDuration } from './windows.js';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const day = (date: Date) => date.toISOString().slice(0, 10);
const summary = (w: ReturnType<typeof buildWindows>) =>
  w.map((x) => `${day(x.trainFrom)}..${day(x.trainTo)} → ${day(x.testTo)}`);

describe('walk-forward windows', () => {
  it('parses durations', () => {
    expect(parseDuration('12m')).toEqual({ amount: 12, unit: 'm' });
    expect(parseDuration(' 1Y ')).toEqual({ amount: 1, unit: 'y' });
    expect(() => parseDuration('3 months')).toThrow(/Invalid duration/);
    expect(() => parseDuration('0m')).toThrow(/Invalid duration/);
  });

  it('adds calendar durations in UTC', () => {
    expect(day(addDuration(d('2024-01-31'), { amount: 1, unit: 'd' }))).toBe(
      '2024-02-01',
    );
    expect(day(addDuration(d('2024-01-15'), { amount: 3, unit: 'm' }))).toBe(
      '2024-04-15',
    );
    expect(day(addDuration(d('2024-01-15'), { amount: 2, unit: 'w' }))).toBe(
      '2024-01-29',
    );
  });

  it('slides the training window by the test length (rolling)', () => {
    const windows = buildWindows(
      d('2022-01-01'),
      d('2023-01-01'),
      parseDuration('6m'),
      parseDuration('3m'),
    );
    expect(summary(windows)).toEqual([
      '2022-01-01..2022-07-01 → 2022-10-01',
      '2022-04-01..2022-10-01 → 2023-01-01',
    ]);
    expect(windows[1].testFrom).toEqual(windows[1].trainTo);
  });

  it('keeps training anchored at the start and trims the last test period', () => {
    const windows = buildWindows(
      d('2022-01-01'),
      d('2022-12-01'),
      parseDuration('6m'),
      parseDuration('3m'),
      true,
    );
    expect(summary(windows)).toEqual([
      '2022-01-01..2022-07-01 → 2022-10-01',
      '2022-01-01..2022-10-01 → 2022-12-01',
    ]);
  });

  it('rejects periods with no room for a test', () => {
    expect(() =>
      buildWindows(
        d('2022-01-01'),
        d('2022-06-01'),
        parseDuration('6m'),
        parseDuration('3m'),
      ),
    ).toThrow(/too short: it needs more than 6 months of training/);
  });
});
