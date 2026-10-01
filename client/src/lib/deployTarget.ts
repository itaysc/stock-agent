import type { DeployTarget } from '../api/paper-types';
import type { RunResponse } from '../api/types';
import { type FormValues, filled } from './form';

/** What "Paper trade this" deploys for a result (null: nothing sensible to deploy). */
export function deployTargetFor(
  result: RunResponse,
  ranWith: FormValues | null,
): DeployTarget | null {
  switch (result.kind) {
    case 'backtest':
      if (!ranWith) return null;
      return {
        kind: 'sleeves',
        name: `${result.strategy} on ${result.symbols.join(', ')}`,
        sleeves: [
          {
            strategy: result.strategy,
            symbols: result.symbols,
            params: filled(ranWith.params[result.strategy]),
            weightPct: 100,
          },
        ],
      };
    case 'walkforward': {
      // The setting the walk-forward picked on its latest training window.
      const pick = [...result.windows].reverse().find((w) => w.chosen)?.chosen;
      if (!pick) return null;
      return {
        kind: 'sleeves',
        name: `${pick.strategy} on ${result.symbols.join(', ')} (latest pick)`,
        sleeves: [
          { strategy: pick.strategy, symbols: result.symbols, params: pick.params, weightPct: 100 },
        ],
      };
    }
    case 'portfolio':
      return {
        kind: 'sleeves',
        name: `Portfolio of ${result.sleeves.length}`,
        sleeves: result.sleeves.map((s) => ({ ...s.sleeve, params: filled(s.sleeve.params) })),
      };
    default:
      return null; // a sweep's best is picked with hindsight
  }
}
