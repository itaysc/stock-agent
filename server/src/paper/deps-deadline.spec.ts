import type { CycleDeps } from './deployment-events.js';
import { cycleFailure } from './cycle-step.js';
import { withDeadlines } from './deps-deadline.js';

describe('withDeadlines', () => {
  const never = () => new Promise<never>(() => {});
  const deps = {
    completedBefore: never,
    placeOrder: never,
    now: () => new Date(0),
  } as unknown as CycleDeps;

  it('fails a call that never answers, as "did not answer in time"', async () => {
    const d = withDeadlines(deps, 20);
    const err = await d.completedBefore().catch((e: unknown) => e);
    expect(cycleFailure(err)).toMatch(/did not answer in time/);
  });

  it('leaves order placing and plain values alone', () => {
    const d = withDeadlines(deps, 20);
    // The same function object, untouched (never called here, so `this` doesn't matter).
    // oxlint-disable-next-line typescript/unbound-method
    expect(d.placeOrder).toBe(deps.placeOrder);
    expect(d.now()).toEqual(new Date(0));
  });
});
