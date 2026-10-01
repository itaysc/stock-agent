import type { ReportData } from './report-data.js';

/**
 * Browser-side code for the HTML report. Each exported function is embedded
 * in the page via `fn.toString()`, so it must not use imports or outer
 * variables: shared helpers are passed in as `h`.
 */
export function reportHelpers(data: ReportData) {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  const el = (tag: string, text = '', cls = '') => {
    const node = document.createElement(tag);
    node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const money = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const pct = (n: number | null, sign = true) =>
    n === null ? 'n/a' : `${sign && n > 0 ? '+' : ''}${n.toFixed(2)}%`;
  const tone = (n: number | null) =>
    n === null ? '' : n >= 0 ? 'gain' : 'loss';
  const firstSymbol = data.symbols[0];
  const spacing =
    (data.candles[firstSymbol]?.[1]?.time ?? 0) -
    (data.candles[firstSymbol]?.[0]?.time ?? 0);
  const intraday = spacing > 0 && spacing < 86_400;
  const stamp = (t: number) =>
    new Date(t * 1000)
      .toISOString()
      .slice(0, intraday ? 16 : 10)
      .replace('T', ' ');
  return { v, $, el, money, pct, tone, intraday, stamp, firstSymbol };
}

export type ReportHelpers = ReturnType<typeof reportHelpers>;
