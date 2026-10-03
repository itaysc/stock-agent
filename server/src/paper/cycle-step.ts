/** A cycle step that failed, e.g. "fetching prices". */
export class CycleStepError extends Error {
  constructor(
    readonly step: string,
    readonly original: unknown,
  ) {
    super((original as Error)?.message ?? String(original));
  }
}

/** Runs one step of the cycle; a failure says which step it was. */
export const step = <T>(label: string, work: Promise<T>): Promise<T> =>
  work.catch((err: unknown) => {
    throw err instanceof CycleStepError ? err : new CycleStepError(label, err);
  });

const SLOW =
  /aborted|timed? ?out|timeout|ETIMEDOUT|ECONNRESET|socket hang up|network/i;

/** The deployment-log line for a failed cycle, in plain words. */
export function cycleFailure(err: unknown): string {
  const where = err instanceof CycleStepError ? ` while ${err.step}` : '';
  const message = (err as Error)?.message ?? String(err);
  return SLOW.test(message)
    ? `Check skipped${where}: the data source did not answer in time. Nothing was lost; the next check (in 15 minutes) tries again.`
    : `Check failed${where}: ${message}`;
}
