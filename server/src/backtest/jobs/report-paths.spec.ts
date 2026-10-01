import { basename } from 'node:path';
import {
  backtestReportPath,
  REPORTS_DIR,
  reportUrl,
  sweepReportPath,
} from './report-paths.js';

const from = new Date('2024-01-01');
const to = new Date('2026-01-01');

describe('report paths', () => {
  it('names backtest reports after strategy, symbols, period and fingerprint', () => {
    const path = backtestReportPath(
      'sma-crossover',
      ['AAPL', 'MSFT'],
      from,
      to,
      'abcdef1234',
    );
    expect(path.startsWith(REPORTS_DIR)).toBe(true);
    expect(basename(path)).toBe(
      'sma-crossover_AAPL-MSFT_2024-01-01_2026-01-01_abcdef12.html',
    );
    expect(reportUrl(path)).toBe(
      '/reports/sma-crossover_AAPL-MSFT_2024-01-01_2026-01-01_abcdef12.html',
    );
  });

  it('gives different sweeps different names', () => {
    const a = sweepReportPath(['sma-crossover'], ['AAPL'], from, to, {
      grid: { fast: ['5'] },
    });
    const b = sweepReportPath(['sma-crossover'], ['AAPL'], from, to, {
      grid: { fast: ['10'] },
    });
    expect(basename(a)).toMatch(
      /^sweep_sma-crossover_AAPL_2024-01-01_2026-01-01_[0-9a-f]{8}\.html$/,
    );
    expect(a).not.toBe(b);
  });
});
