import {
  timeFrame,
  TimeFrameUnit,
  type values,
} from '@alpacahq/alpaca-trade-api';

const PATTERN = /^(\d+)(Min|Hour|Day|Week|Month)$/;

/** Parses "15Min" / "1Hour" / "1Day" / "1Week" / "1Month" into Alpaca's timeframe. */
export function parseTimeframe(input: string): values.TimeFrameString {
  const match = PATTERN.exec(input);
  if (!match) {
    throw new Error(`Invalid timeframe "${input}" (e.g. 15Min, 1Hour, 1Day)`);
  }
  return timeFrame(Number(match[1]), match[2] as TimeFrameUnit);
}

/**
 * Length of an intraday timeframe in minutes. The live runner builds these
 * bars from the stream's 1-minute bars; daily and longer are not supported live.
 */
export function timeframeMinutes(input: string): number {
  parseTimeframe(input); // validates
  const [, amount, unit] = PATTERN.exec(input) as RegExpExecArray;
  if (unit === 'Min') return Number(amount);
  if (unit === 'Hour') return Number(amount) * 60;
  throw new Error(
    `Live strategies support minute and hour timeframes only (got ${input})`,
  );
}
