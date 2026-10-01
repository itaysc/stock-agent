import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

/** Where HTML reports are written, and served from at /reports/. */
export const REPORTS_DIR = resolve(process.cwd(), 'reports');

const day = (d: Date) => d.toISOString().slice(0, 10);
const shortHash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 8);

/** e.g. reports/sma-crossover_AAPL-MSFT_2024-01-01_2026-01-01_1a2b3c4d.html */
export function backtestReportPath(
  strategy: string,
  symbols: string[],
  from: Date,
  to: Date,
  fingerprint: string,
): string {
  const name = `${strategy}_${symbols.join('-')}_${day(from)}_${day(to)}_${fingerprint.slice(0, 8)}.html`;
  return resolve(REPORTS_DIR, name);
}

/** e.g. reports/sweep_sma-crossover+rsi-reversion_AAPL_2024-01-01_2026-01-01_1a2b3c4d.html */
export function sweepReportPath(
  strategies: string[],
  symbols: string[],
  from: Date,
  to: Date,
  setup: unknown,
): string {
  const name = `sweep_${strategies.join('+')}_${symbols.join('-')}_${day(from)}_${day(to)}_${shortHash(setup)}.html`;
  return resolve(REPORTS_DIR, name);
}

/** e.g. reports/walkforward_sma-crossover_AAPL_2020-01-01_2026-01-01_1a2b3c4d.html */
export function walkForwardReportPath(setup: {
  strategies: string[];
  symbols: string[];
  from: Date;
  to: Date;
}): string {
  const name = `walkforward_${setup.strategies.join('+')}_${setup.symbols.join('-')}_${day(setup.from)}_${day(setup.to)}_${shortHash(setup)}.html`;
  return resolve(REPORTS_DIR, name);
}

/** e.g. reports/research_AAPL-MSFT_2026-09-30_1a2b3c4d.html */
export function researchReportPath(
  symbols: string[],
  startedAt: Date,
  id: string,
): string {
  const name = `research_${symbols.join('-')}_${day(startedAt)}_${id.slice(0, 8)}.html`;
  return resolve(REPORTS_DIR, name);
}

/** e.g. reports/portfolio_3-sleeves_2021-01-01_2026-01-01_1a2b3c4d.html */
export function portfolioReportPath(
  sleeves: number,
  from: Date,
  to: Date,
  setup: unknown,
): string {
  const name = `portfolio_${sleeves}-sleeves_${day(from)}_${day(to)}_${shortHash(setup)}.html`;
  return resolve(REPORTS_DIR, name);
}

/** URL path the server serves a report from. */
export const reportUrl = (path: string) => `/reports/${basename(path)}`;

export async function ensureDir(file: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
}
