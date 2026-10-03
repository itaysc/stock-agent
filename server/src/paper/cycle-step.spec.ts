import { cycleFailure, step } from './cycle-step.js';

describe('a failed cycle', () => {
  it('says which step failed, and that a slow data source is retried', async () => {
    const aborted = await step(
      'fetching prices',
      Promise.reject(new Error('The request was aborted')),
    ).catch((e: unknown) => e);
    expect(cycleFailure(aborted)).toBe(
      'Check skipped while fetching prices: the data source did not answer in time. Nothing was lost; the next check (in 15 minutes) tries again.',
    );
    // The innermost step names it (a step inside a step keeps the first label).
    const nested = await step(
      'checking orders',
      step('reading the market clock', Promise.reject(new Error('boom'))),
    ).catch((e: unknown) => e);
    expect(cycleFailure(nested)).toBe(
      'Check failed while reading the market clock: boom',
    );
    expect(cycleFailure(new Error('odd'))).toBe('Check failed: odd');
  });
});
