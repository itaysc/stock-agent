/** "90d", "6w", "12m" (months), "1y" → a calendar step. */
export interface Duration {
  amount: number;
  unit: 'd' | 'w' | 'm' | 'y';
}

export interface Window {
  index: number;
  /** Training (in-sample) period: [trainFrom, trainTo). */
  trainFrom: Date;
  trainTo: Date;
  /** Test (out-of-sample) period: [testFrom, testTo); testFrom = trainTo. */
  testFrom: Date;
  testTo: Date;
}

export function parseDuration(input: string): Duration {
  const match = /^(\d+)(d|w|m|y)$/i.exec(input.trim());
  if (!match || Number(match[1]) < 1) {
    throw new Error(`Invalid duration "${input}" (e.g. 90d, 6w, 12m, 1y)`);
  }
  return {
    amount: Number(match[1]),
    unit: match[2].toLowerCase() as Duration['unit'],
  };
}

export function addDuration(date: Date, { amount, unit }: Duration): Date {
  const d = new Date(date);
  if (unit === 'd') d.setUTCDate(d.getUTCDate() + amount);
  if (unit === 'w') d.setUTCDate(d.getUTCDate() + 7 * amount);
  if (unit === 'm') d.setUTCMonth(d.getUTCMonth() + amount);
  if (unit === 'y') d.setUTCFullYear(d.getUTCFullYear() + amount);
  return d;
}

export const formatDuration = ({ amount, unit }: Duration) =>
  `${amount} ${{ d: 'day', w: 'week', m: 'month', y: 'year' }[unit]}${amount === 1 ? '' : 's'}`;

/**
 * Consecutive train → test windows over [from, to]. Rolling: the training
 * window slides forward by the test length. Anchored: training always starts
 * at `from` and grows. The last test period may be shorter than the others.
 */
export function buildWindows(
  from: Date,
  to: Date,
  train: Duration,
  test: Duration,
  anchored = false,
): Window[] {
  const windows: Window[] = [];
  let trainFrom = from;
  let testFrom = addDuration(from, train);
  while (testFrom < to && windows.length < 500) {
    const fullTestTo = addDuration(testFrom, test);
    windows.push({
      index: windows.length + 1,
      trainFrom,
      trainTo: testFrom,
      testFrom,
      testTo: fullTestTo < to ? fullTestTo : to,
    });
    testFrom = fullTestTo;
    if (!anchored) trainFrom = addDuration(trainFrom, test);
  }
  if (windows.length === 0) {
    throw new Error(
      `The period is too short: it needs more than ${formatDuration(train)} of training data before the first test`,
    );
  }
  return windows;
}
