import type { RunStatus } from './backtest-history.service.js';

const stamp = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');

/** One line telling the user whether the run came from history. */
export function formatRunStatus(status: RunStatus): string {
  switch (status.kind) {
    case 'new':
      return 'Run history: new test, saved.';
    case 'reused':
      return `Run history: same test saved on ${stamp(status.savedAt)} UTC, reused (use --fresh to re-run).`;
    case 'replaced':
      return `Run history: saved test was stale (${status.reason}), re-ran and replaced it.`;
    case 'forced':
      return 'Run history: re-ran (--fresh) and replaced the saved test.';
  }
}
