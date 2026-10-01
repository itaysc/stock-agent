# Stock Invest — Client (Backtest Lab)

React UI for running backtests, parameter sweeps, walk-forward tests and the AI research agent, and viewing their reports.
Vite + React 19 + TypeScript, [Mantine](https://mantine.dev) components.

## Run

```bash
nvm use
npx npm@11 install
npm run dev        # http://localhost:5173
```

The server must be running too (`cd ../server && npm run dev`). Vite proxies `/api` and
`/reports` to it (default `http://localhost:3000`, override with `VITE_API_TARGET`), so the UI
and the reports share one origin and reports can be embedded.

## What's on the page

- **Settings** (left): Backtest / Sweep / Walk-fwd / Portfolio / AI agent, symbols, strategy and its params
  (numbers for a backtest; values like `10`, `5,10,20`, `5..30:5` for a sweep or walk-forward,
  with a live count), period with presets, walk-forward training/test lengths and anchored switch
  (with a live count of test windows; switching to walk-forward extends an untouched period to 5
  years), timeframe, advanced (cash, slippage, fees, interest on idle cash, ranking / pick-best key, min trades), AI
  summary and fresh-run switches.
- **Bottom line** (top of every result, for non-experts): a score out of 100 with a grade (Poor /
  Weak / Okay / Good / Great), a one-line verdict ("Made money, but less than simply buying and
  holding"), what $X would have become, what just holding the symbols would have become, the worst
  drop along the way, and a trust level (low for few trades or settings picked with hindsight, high
  for 20+ trades on data the settings weren't tuned on). Score: up to 40 points for the yearly
  return, 40 for beating buy & hold, 20 for small drops (`src/lib/bottomLine.ts`). Plain rules, no
  AI. For a sweep it describes the top-ranked setting; for the AI agent, the best idea's holdout run.
- **Results** (right): key numbers, run-history status, the AI summary (headline first, details on click) with its **suggested next
  tests** (each has a **Run** button that loads it into the settings and runs it), and the full
  HTML report embedded (or open it in a new tab). Recent reports are listed below and can be
  reopened.
- **Portfolio:** add sleeves (strategy, symbols, settings, share of the money; the rest stays in
  cash), set the portfolio stop, run. Results: the bottom line vs a matching buy & hold, a table of
  what each sleeve put in, ended with and made, how alike the sleeves move, and when the stop fired.
- **Multi-symbol check:** under a walk-forward result, pick a basket and **Check**: the same setup
  runs on each symbol on its own, with a grade and the money vs just holding per symbol, and a
  pass/fail verdict (better than holding on 6 in 10 or more).
- **AI agent:** pick symbols, the strategies it may use, period, goal, holdout and budget (rounds ×
  tests). The results follow the session live (polled every 2 s): each round's reasoning, rejected
  proposals, ideas and tests with their scores; then the best test's holdout result vs buy & hold,
  its multi-symbol check (basket chosen in the settings), whether it's a **paper-trading
  candidate** (passed both), the AI verdict and the report.

## Paper trading page

The header switches between **Lab** and **Paper trading**. **Paper trade this** (on a backtest,
walk-forward, portfolio or AI research result) opens a dialog for the name, paper money and safety
guard, then deploys it and opens the page, which shows:

- the **Autopilot** panel: on/off, what it will do next, **Run now**, its settings (watchlist,
  schedule, money per deployment, max deployments, retirement), and every run's decisions
  (researched, deployed, retired, skipped, with the reason);
- the paper account: cash, money given to deployments, free to deploy (refreshes every 30 s);
- each deployment: money now vs put in, how far below its peak vs its guard, live vs expected;
- which real-time news sources are active (headlines, trading halts, SEC filings, the AI reader);
- the deploy dialog's **real-time news check**: skip a buy on negative news before the open, let the
  AI read the headlines too, and what to do about breaking news on holdings (alert / sell / ignore);
- the selected one in detail: equity over time, sleeves and holdings (and orders waiting to
  fill), what happened (fills, orders, guard pauses), and **Check now**, **Pause**/**Resume**,
  **Stop & sell all**.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run typecheck` | TypeScript only |
| `npm test` | Unit tests (Vitest) |

## Structure

```
src/
  api/          # types + fetch client for /api/v1
  components/   # Workspace (layout + run state), Header, RecentReports
    settings/   # SettingsPanel, ModeSwitch, StrategyFields, PeriodField, WalkForwardFields, ResearchFields, AdvancedFields
    results/    # ResultArea, Backtest/Sweep/WalkForwardSummary, ResearchView + ResearchTimeline, AiSummaryCard, ReportFrame
  hooks/        # options/reports loading, research-session polling
  lib/          # form model + request bodies, run button rules, suggested-test → form, sweep-spec and window counting, formatting
```
