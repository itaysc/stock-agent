import type { StrategyBar } from '../strategies/strategy.types.js';

export interface TimelineStep {
  timestamp: Date;
  bars: StrategyBar[];
}

/** Merges per-symbol bars into one timeline, grouping bars that share a timestamp. */
export function buildTimeline(
  barsBySymbol: Record<string, StrategyBar[]>,
): TimelineStep[] {
  const steps = new Map<number, TimelineStep>();
  for (const bars of Object.values(barsBySymbol)) {
    for (const bar of bars) {
      const key = bar.timestamp.getTime();
      const step = steps.get(key) ?? { timestamp: bar.timestamp, bars: [] };
      step.bars.push(bar);
      steps.set(key, step);
    }
  }
  return [...steps.values()].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
}
