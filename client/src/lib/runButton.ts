import type { BacktestOptions } from '../api/types';
import type { FormValues } from './form';
import { comboCount } from './paramGrid';
import { backtestErrors, sweepErrors } from './paramRules';
import { parseDuration, windowCount } from './walkForward';

/** The run button's label, and whether the settings can run as they are. */
export function runButton(v: FormValues, options: BacktestOptions) {
  const info = (name: string) => options.strategies.find((s) => s.name === name);
  const basics = v.symbols.length > 0 && Boolean(v.period[0] && v.period[1]);
  switch (v.mode) {
    case 'backtest': {
      const errors = backtestErrors(info(v.strategy), v.params[v.strategy], v.symbols.length);
      return { label: 'Run backtest', blocked: !basics || Object.keys(errors).length > 0 };
    }
    case 'portfolio': {
      const total = v.sleeves.reduce((n, s) => n + (s.weightPct || 0), 0);
      const invalid = v.sleeves.some(
        (s) =>
          s.symbols.length === 0 ||
          !(s.weightPct > 0) ||
          Object.keys(backtestErrors(info(s.strategy), s.params, s.symbols.length)).length > 0,
      );
      return {
        label: `Run portfolio · ${v.sleeves.length} sleeve${v.sleeves.length === 1 ? '' : 's'}`,
        blocked: !v.period[0] || !v.period[1] || v.sleeves.length === 0 || invalid || total > 100,
      };
    }
    case 'research': {
      const tests = v.rounds * v.testsPerRound;
      return {
        label: `Start AI research · up to ${tests} tests`,
        blocked:
          !basics || !options.aiEnabled || v.strategies.length === 0 || !parseDuration(v.holdout),
      };
    }
    default: {
      const specs = v.strategies.map((s) => v.specs[s] ?? {});
      const runs = specs.reduce((n, s) => n + comboCount(s), 0);
      const invalid =
        v.strategies.length === 0 ||
        specs.some((s) => comboCount(s) > options.maxCombinations) ||
        v.strategies.some((s) => Object.keys(sweepErrors(info(s), v.specs[s])).length > 0);
      if (v.mode === 'sweep') {
        return {
          label: `Run sweep · ${runs} backtest${runs === 1 ? '' : 's'}`,
          blocked: !basics || invalid,
        };
      }
      const windows = windowCount(v);
      return {
        label: `Run walk-forward · ${windows ?? 0} window${windows === 1 ? '' : 's'}`,
        blocked: !basics || invalid || !windows,
      };
    }
  }
}
