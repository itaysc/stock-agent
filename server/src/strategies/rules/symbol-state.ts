import {
  BollingerBands,
  ChandelierExit,
  DonchianChannels,
  EMA,
  MACD,
  RSI,
  RVOL,
  SMA,
} from 'trading-signals';
import { VolTracker } from '../sizing.js';
import { NewsWindow } from './info-readings.js';
import type { Holding, Params } from './rule-checks.js';

/** Indicators per symbol, created only for the rules that are on. */
export interface SymbolState {
  trend?: SMA;
  exitTrend?: SMA;
  fast?: SMA;
  slow?: SMA;
  prevCross: number | null;
  rsi?: RSI;
  breakout?: DonchianChannels;
  breakdown?: DonchianChannels;
  dip?: DonchianChannels;
  bb?: BollingerBands;
  macd?: MACD;
  prevHistogram: number | null;
  chandelier?: ChandelierExit;
  rvol?: RVOL;
  news?: NewsWindow;
  /** The stock's own volatility, for targetVol sizing. */
  sizeVol?: VolTracker;
  holding: Holding | null;
}

const on = <T>(value: number, make: () => T): T | undefined =>
  value > 0 ? make() : undefined;

/** A symbol's indicators, from the trading-signals library, for the rules that are on. */
export function createSymbolState(p: Params): SymbolState {
  return {
    trend: on(p.trendSma, () => new SMA(p.trendSma)),
    exitTrend: on(p.exitTrendSma, () => new SMA(p.exitTrendSma)),
    fast: on(p.crossSlow, () => new SMA(p.crossFast)),
    slow: on(p.crossSlow, () => new SMA(p.crossSlow)),
    prevCross: null,
    rsi: on(p.rsiBelow || p.rsiAbove, () => new RSI(p.rsiPeriod)),
    breakout: on(p.breakout, () => new DonchianChannels(p.breakout)),
    breakdown: on(p.breakdown, () => new DonchianChannels(p.breakdown)),
    dip: on(p.dipPct, () => new DonchianChannels(p.dipLookback)),
    bb: on(p.bbPeriod, () => new BollingerBands(p.bbPeriod, p.bbStd)),
    macd: on(
      p.macdCross || p.macdExit,
      () =>
        new MACD(
          new EMA(p.macdFast),
          new EMA(p.macdSlow),
          new EMA(p.macdSignal),
        ),
    ),
    prevHistogram: null,
    chandelier: on(
      p.atrStop,
      () =>
        new ChandelierExit({
          interval: p.atrPeriod,
          multiplier: p.atrStop,
        }),
    ),
    rvol: on(p.volumeRatio, () => new RVOL(p.volumePeriod)),
    news: on(p.newsFilter || p.newsExit, () => new NewsWindow(p.newsDays)),
    sizeVol: on(p.targetVol, () => new VolTracker(p.targetVolDays)),
    holding: null,
  };
}
