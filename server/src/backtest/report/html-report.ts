import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { StrategyBar } from '../../strategies/strategy.types.js';
import type { BacktestResult } from '../backtest-engine.js';
import type { AiSummary } from '../summary/ai-summary.types.js';
import { buildReportData } from './report-data.js';
import { renderHtml } from './report-template.js';

/** The chart library, inlined so the report is one file that works offline. */
export async function loadChartLibrary(): Promise<string> {
  const require = createRequire(import.meta.url);
  const pkg = require.resolve('lightweight-charts/package.json');
  return readFile(
    join(dirname(pkg), 'dist/lightweight-charts.standalone.production.js'),
    'utf8',
  );
}

export async function buildHtmlReport(
  result: BacktestResult,
  bars: Record<string, StrategyBar[]>,
  settings: Record<string, string> = {},
  aiSummary: AiSummary | null = null,
): Promise<string> {
  return renderHtml(
    buildReportData(result, bars, settings, aiSummary),
    await loadChartLibrary(),
  );
}

export async function writeHtmlReport(
  path: string,
  result: BacktestResult,
  bars: Record<string, StrategyBar[]>,
  settings: Record<string, string> = {},
  aiSummary: AiSummary | null = null,
): Promise<void> {
  await writeFile(
    path,
    await buildHtmlReport(result, bars, settings, aiSummary),
  );
}
