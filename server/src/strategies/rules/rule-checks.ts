import type { BarEarnings, StrategyBar } from '../strategy.types.js';

export type Params = Record<string, number>;

/** Each indicator's value on this bar (null while it warms up or when its rule is off). */
export interface Readings {
  trend: number | null;
  exitTrend: number | null;
  crossUp: boolean;
  crossDown: boolean;
  rsi: number | null;
  /** Highest high / lowest low of the previous bars (breakout / breakdown). */
  channelHigh: number | null;
  channelLow: number | null;
  /** Highest close of the last dipLookback bars, this one included. */
  recentHigh: number | null;
  bbLower: number | null;
  macdUp: boolean;
  macdDown: boolean;
  /** Chandelier-exit stop level for a long position. */
  atrStopLevel: number | null;
  /** This bar's volume ÷ the average of the previous volumePeriod bars. */
  relativeVolume: number | null;
  /** Whether SPY closed above its marketSma average (null: not known yet). */
  marketUp: boolean | null;
  /** SPY's yearly volatility over volPeriod days, in % (null: not known yet). */
  marketVolPct: number | null;
  /** Average headline tone and count over newsDays (null: news blocks off). */
  news: { tone: number; count: number } | null;
  earnings: BarEarnings | null;
  /** The stock's own yearly volatility, for targetVol sizing (null: off or warming up). */
  sizeVolPct: number | null;
}

/** Position details the exits need. */
export interface Holding {
  entry: number;
  /** Highest close since entry. */
  peak: number;
  barsHeld: number;
}

const fmt = (n: number | null) => (n === null ? '?' : n.toFixed(0));

/** Why to buy on this bar (every entry rule that is on holds), or null. */
export function entryReason(
  p: Params,
  r: Readings,
  bar: StrategyBar,
): string | null {
  const close = bar.close;
  const reasons: string[] = [];
  const check = (on: number, ok: boolean, why: string) => {
    if (!on) return true;
    if (ok) reasons.push(why);
    return ok;
  };
  const all = [
    check(
      p.trendSma,
      r.trend !== null && close > r.trend,
      `above ${p.trendSma}-bar average`,
    ),
    check(
      p.crossSlow,
      r.crossUp,
      `${p.crossFast}/${p.crossSlow} average cross up`,
    ),
    check(
      p.rsiBelow,
      r.rsi !== null && r.rsi < p.rsiBelow,
      `RSI ${fmt(r.rsi)} < ${p.rsiBelow}`,
    ),
    check(
      p.breakout,
      r.channelHigh !== null && close > r.channelHigh,
      `${p.breakout}-bar breakout`,
    ),
    check(
      p.dipPct,
      r.recentHigh !== null && close <= r.recentHigh * (1 - p.dipPct / 100),
      `${p.dipPct}% dip`,
    ),
    check(
      p.bbPeriod,
      r.bbLower !== null && close < r.bbLower,
      'below lower Bollinger band',
    ),
    check(p.macdCross, r.macdUp, 'MACD cross up'),
    check(
      p.volumeRatio,
      r.relativeVolume !== null && r.relativeVolume >= p.volumeRatio,
      `volume ${r.relativeVolume?.toFixed(1)}× normal`,
    ),
    check(
      p.marketSma,
      r.marketUp === true,
      `market above ${p.marketSma}-bar average`,
    ),
    check(
      p.volMax,
      r.marketVolPct !== null && r.marketVolPct < p.volMax,
      `calm market (volatility ${r.marketVolPct?.toFixed(0)}%)`,
    ),
    check(
      p.newsFilter,
      r.news !== null && r.news.tone >= p.newsMin,
      `news tone ${r.news?.tone.toFixed(2)}`,
    ),
    check(
      p.earningsAvoid,
      r.earnings?.daysToNext == null || r.earnings.daysToNext > p.earningsAvoid,
      `no earnings within ${p.earningsAvoid} days`,
    ),
    check(
      p.surpriseMin,
      r.earnings?.daysSinceLast != null &&
        r.earnings.daysSinceLast <= p.surpriseDays &&
        (r.earnings.lastSurprisePct ?? -Infinity) >= p.surpriseMin,
      `beat estimates by ${r.earnings?.lastSurprisePct?.toFixed(1)}%`,
    ),
  ].every(Boolean);
  return all && reasons.length ? reasons.join(' + ') : null;
}

/** Why to sell on this bar (the first exit rule that fires), or null. */
export function exitReason(
  p: Params,
  r: Readings,
  bar: StrategyBar,
  h: Holding,
): string | null {
  const close = bar.close;
  if (p.stopLoss && close <= h.entry * (1 - p.stopLoss / 100))
    return `stop-loss ${p.stopLoss}%`;
  if (p.trailingStop && close <= h.peak * (1 - p.trailingStop / 100))
    return `trailing stop ${p.trailingStop}%`;
  if (p.atrStop && r.atrStopLevel !== null && close < r.atrStopLevel)
    return `ATR stop ${p.atrStop}×`;
  if (p.takeProfit && close >= h.entry * (1 + p.takeProfit / 100))
    return `take-profit ${p.takeProfit}%`;
  if (p.crossExit && r.crossDown)
    return `${p.crossFast}/${p.crossSlow} average cross down`;
  if (p.macdExit && r.macdDown) return 'MACD cross down';
  if (p.exitTrendSma && r.exitTrend !== null && close < r.exitTrend)
    return `below ${p.exitTrendSma}-bar average`;
  if (p.rsiAbove && r.rsi !== null && r.rsi > p.rsiAbove)
    return `RSI ${fmt(r.rsi)} > ${p.rsiAbove}`;
  if (p.breakdown && r.channelLow !== null && close < r.channelLow)
    return `${p.breakdown}-bar breakdown`;
  if (p.marketExit && r.marketUp === false)
    return `market below ${p.marketSma}-bar average`;
  if (p.volExit && r.marketVolPct !== null && r.marketVolPct > p.volExit) {
    return `market volatility ${r.marketVolPct.toFixed(0)}%`;
  }
  if (p.newsExit && r.news && r.news.count > 0 && r.news.tone <= -p.newsExit) {
    return `bad news (tone ${r.news.tone.toFixed(2)})`;
  }
  if (
    p.earningsExit &&
    r.earnings?.daysToNext != null &&
    r.earnings.daysToNext <= p.earningsExit
  ) {
    return `earnings in ${r.earnings.daysToNext} days`;
  }
  if (p.maxHold && h.barsHeld >= p.maxHold) return `held ${p.maxHold} bars`;
  return null;
}

/**
 * Whether every indicator of a rule that is on has a value, so a rule that is
 * still warming up can't be mistaken for "not met" (or, for exits, "fine").
 */
export function isReady(p: Params, r: Readings): boolean {
  const need: Array<[number, unknown]> = [
    [p.trendSma, r.trend],
    [p.exitTrendSma, r.exitTrend],
    [p.rsiBelow || p.rsiAbove, r.rsi],
    [p.breakout, r.channelHigh],
    [p.breakdown, r.channelLow],
    [p.dipPct, r.recentHigh],
    [p.bbPeriod, r.bbLower],
    [p.atrStop, r.atrStopLevel],
    [p.volumeRatio, r.relativeVolume],
    [p.marketSma, r.marketUp],
    [p.targetVol, r.sizeVolPct],
    [p.volMax || p.volExit, r.marketVolPct],
  ];
  return need.every(([on, value]) => !on || value !== null);
}
