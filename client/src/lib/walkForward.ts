import dayjs from 'dayjs';
import type { FormValues } from './form';

const UNITS = { d: 'day', w: 'week', m: 'month', y: 'year' } as const;
const DURATION = /^([1-9]\d*)\s*([dwmy])$/i;

export interface Duration {
  amount: number;
  unit: keyof typeof UNITS;
}

/** "12m" → { amount: 12, unit: 'm' }; null when it isn't a duration. */
export function parseDuration(input: string): Duration | null {
  const match = DURATION.exec(input.trim());
  return match
    ? {
        amount: Number(match[1]),
        unit: match[2].toLowerCase() as Duration['unit'],
      }
    : null;
}

export const durationLabel = ({ amount, unit }: Duration) =>
  `${amount} ${UNITS[unit]}${amount === 1 ? '' : 's'}`;

const add = (date: dayjs.Dayjs, { amount, unit }: Duration) => date.add(amount, UNITS[unit]);

/**
 * How many test windows the server will make (same rule: the first test starts
 * after one training length, then one window per test length until `to`).
 */
export function countWindows(from: string, to: string, train: Duration, test: Duration): number {
  const end = dayjs(to);
  let testFrom = add(dayjs(from), train);
  let count = 0;
  while (testFrom.isBefore(end) && count < 500) {
    count++;
    testFrom = add(testFrom, test);
  }
  return count;
}

/** Test windows the settings produce: null when a length is invalid. */
export function windowCount(v: Pick<FormValues, 'train' | 'test' | 'period'>): number | null {
  const train = parseDuration(v.train);
  const test = parseDuration(v.test);
  if (!train || !test) return null;
  const [from, to] = v.period;
  return from && to ? countWindows(from, to, train, test) : 0;
}
