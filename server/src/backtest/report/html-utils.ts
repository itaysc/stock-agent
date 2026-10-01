export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Data for a <script> tag: every "<" is escaped, so no text can form a tag. */
export const jsonForScript = (value: unknown) =>
  JSON.stringify(value).replace(/</g, '\\u003c');

/** Code for a <script> tag: no "</script>" or "<!--" can end the tag early. */
export const scriptSafe = (s: string) =>
  s.replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');

/** Page style shared by the backtest and sweep reports (light + dark). */
export const BASE_STYLE = `
:root {
  --bg: #f6f6f4; --surface: #ffffff; --text: #1c1c1e; --muted: #6e6e73;
  --border: #e4e4e0; --grid: #efefec; --accent: #2f6fde;
  --gain: #15924a; --loss: #d63b3b; --loss-soft: rgba(214, 59, 59, 0.14);
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111214; --surface: #1a1b1e; --text: #ececec; --muted: #9b9ba1;
    --border: #2c2d31; --grid: #222327; --accent: #6ea0ff;
    --gain: #34c77b; --loss: #f26d6d; --loss-soft: rgba(242, 109, 109, 0.16);
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 var(--font); }
main { max-width: 1120px; margin: 0 auto; padding: 32px 16px 48px; }
h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.01em; }
h2 { font-size: 15px; margin: 0; }
.meta, .muted, .sub, .label, footer { color: var(--muted); }
.meta { margin: 0 0 24px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 16px; }
.tile, section { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
.tile { padding: 14px 16px; }
.label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
.value { font-size: 22px; font-weight: 600; margin: 2px 0; font-variant-numeric: tabular-nums; }
.sub { font-size: 12px; }
section { padding: 16px; margin-top: 16px; }
.head { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.legend { display: flex; gap: 16px; font-size: 12px; color: var(--muted); }
.legend i { display: inline-block; width: 14px; height: 0; border-top: 2px solid var(--accent); vertical-align: middle; margin-right: 6px; }
.legend i.dashed { border-top: 2px dashed var(--muted); }
.chart { height: 320px; }
#drawdown-chart { height: 160px; }
#price-chart { height: 400px; }
.tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.tab { font: inherit; font-size: 13px; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--border);
  background: transparent; color: var(--muted); cursor: pointer; }
.tab.active { background: var(--text); color: var(--surface); border-color: var(--text); }
.table-wrap { overflow: auto; max-height: 480px; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
th { font-size: 12px; font-weight: 500; color: var(--muted); position: sticky; top: 0; background: var(--surface); }
.num { text-align: right; }
.gain { color: var(--gain); }
.loss { color: var(--loss); }
footer { font-size: 12px; margin-top: 24px; }
`;
