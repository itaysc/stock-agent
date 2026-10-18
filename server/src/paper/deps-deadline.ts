import type { CycleDeps } from './deployment-events.js';

/** No single outside call in a cycle may take longer than this. */
export const CALL_DEADLINE_MS = 5 * 60_000;

/** `work`, or a "timed out" error after `ms` (the work itself is left to finish or fail on its own). */
export function within<T>(
  work: Promise<T>,
  ms: number,
  what: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error(`${what} timed out after ${Math.round(ms / 1000)}s`)),
      ms,
    );
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/**
 * The cycle's dependencies with a deadline on every outside call, so one
 * request that never answers (e.g. a connection left dead after the computer
 * slept) can't freeze the runner: the cycle fails as "did not answer in time"
 * and the next one runs. Placing an order is left alone: its own reconciling
 * (by clientOrderId) must see how a sent order ended.
 */
export function withDeadlines(
  deps: CycleDeps,
  ms = CALL_DEADLINE_MS,
): CycleDeps {
  const out = { ...deps } as Record<string, unknown>;
  for (const [name, fn] of Object.entries(deps)) {
    if (name === 'placeOrder' || typeof fn !== 'function') continue;
    out[name] = (...args: unknown[]) => {
      const r: unknown = (fn as (...a: unknown[]) => unknown)(...args);
      return r instanceof Promise ? within(r, ms, name) : r;
    };
  }
  return out as unknown as CycleDeps;
}
