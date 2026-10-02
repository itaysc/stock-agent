# Stock Invest — Server

NestJS 12 (ESM) server for the algo trading platform.

## Requirements

- Node.js 22: run `nvm use` in `server/` (reads `.nvmrc`), or make it the default with
  `nvm alias default 22`. On an older Node the npm scripts stop with a clear message (the Nest
  CLI would otherwise crash with `ERR_REQUIRE_CYCLE_MODULE`).
- Docker (for the local MongoDB)
- npm 11 (`npx npm@11 install` works around an npm 10 install bug)

## Setup

```bash
nvm use
cp .env.example .env
npx npm@11 install
npm run db:up   # MongoDB on localhost:27018
```

## Scripts

All commands run from `server/`. Arguments go after `--` (e.g. `npm run report -- AAPL`), and
every CLI command has `--help`.

### Run the server

| Command | What it does |
| --- | --- |
| `npm run dev` | Day-to-day development. Starts MongoDB (Docker) if it isn't running, then runs the server with auto-restart on file changes and readable logs. Connects to Alpaca, opens the streams, and starts any `LIVE_STRATEGIES`. |
| `npm run start:debug` | Same as `dev`, plus the Node debugger on `127.0.0.1:9229`. In VS Code, pick **Attach to server** (or **Debug server** to start + attach in one step). |
| `npm start` | Runs the server once, no auto-restart, and does **not** start MongoDB. |
| `npm run build` | Compiles TypeScript to `dist/`. The CLI commands below run it for you. |
| `npm run start:prod` | Runs the compiled server from `dist/` (build first). For deployment. |

### Research: backtests and reports

| Command | What it does |
| --- | --- |
| `npm run report -- AAPL MSFT` | The one-liner. Backtests a strategy (default `sma-crossover`, last 2 years), prints the summary, writes a visual HTML report to `reports/` and opens it in your browser. |
| `npm run backtest -- AAPL MSFT` | Same backtest, text summary only. Add `--html <file>` for the visual report or `--out <file.json>` for the raw result. |
| `npm run sweep -- AAPL --param fast=5..30:5 --param slow=20,50,100` | Runs many backtests (every combination of the params, or several strategies with `--strategy a,b`) and ranks them, with a summary of how many settings were profitable and beat buy & hold. Use it to check that a strategy works across settings, not just one lucky one. Also writes a visual report (heatmap, scatter, top equity curves, sortable table) and opens it in your browser; `--no-report` for the text table only. |
| `npm run walkforward -- AAPL --param fast=5,10,20 --param slow=30,50,100` | The honest check of a sweep. Cuts the period (default: last 5 years) into windows: picks the best setting on 12 months of training data, trades it on the next 3 unseen months, moves forward 3 months, repeats. Only the unseen months count. Shows whether a sweep's winner keeps working on data it wasn't picked on. Writes and opens a visual report; `--no-report` for text only. See [Walk-forward](#walk-forward-does-the-winner-hold-up). |
| `npm run portfolio -- --sleeve "40 rules AAPL,MSFT breakout=20 marketSma=200" --sleeve "30 rsi-reversion SPY" --max-drawdown 15` | Portfolio backtest: several strategies with fixed settings, each on its own symbols and share of the money (the rest stays in cash), run together on one clock, with an optional stop for the whole portfolio. Shows the total vs a matching buy & hold, what each sleeve added, and how alike the sleeves move. See [Portfolio backtest](#portfolio-backtest). |
| `npm run robustness -- --basket sectors --strategy rules --param breakout=20 --param marketSma=200` | The multi-symbol check: runs one walk-forward setup on each symbol of a basket (`megacaps`, `sectors`, `indexes`, or your own symbols), on its own, and reports on how many it did better than just holding. A setup that works on one symbol only is most likely luck. See [Multi-symbol check](#multi-symbol-check). |
| `npm run research -- AAPL` | The AI research agent. In rounds, an AI proposes walk-forward tests (strategies, rule combinations, settings), the system runs and scores them, and the AI learns from the results and proposes better ones. The last 12 months are hidden from it; its best idea is checked there once at the end. Prints each round live, then the holdout result and a verdict, and opens a report. See [Research agent](#research-agent). |

Common options: `--strategy`, `--from/--to` (period), `--timeframe`, `--param key=value`,
`--cash`, `--slippage`, `--fee`, `--cash-yield` (interest on idle cash, default 3%). Details in [Strategies & backtesting](#strategies--backtesting).
None of these place orders: they only read Alpaca's historical data.

### Trading safety

| Command | What it does |
| --- | --- |
| `npm run kill-switch -- status` | Shows whether the kill switch is engaged. |
| `npm run kill-switch -- on --reason "..."` | Emergency stop: blocks every new order and cancels all open orders at Alpaca. Works on a running server (it's stored in MongoDB). Add `--flatten` to also close every position with market orders. |
| `npm run kill-switch -- off` | Allows trading again. |

### Database

| Command | What it does |
| --- | --- |
| `npm run db:up` | Starts the project's MongoDB in Docker on `localhost:27018` and waits until it's ready. `dev` runs this for you. |
| `npm run db:down` | Stops the MongoDB container. Data is kept in the `mongo-data` volume. |

### Code quality

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests (Vitest). Offline: Alpaca and MongoDB are faked or in-memory. |
| `npm run test:watch` | Unit tests, re-run on every change. |
| `npm run test:cov` | Unit tests with a coverage report. |
| `npm run test:debug` | Unit tests with the debugger attached. |
| `npm run test:e2e` | End-to-end tests: boots the whole app against an in-memory MongoDB and a mocked Alpaca. |
| `npm run lint` | Lints `src/` and `test/` (oxlint, type-aware). |
| `npm run format` | Formats the code (Prettier). |
| `npm run deploy` | From the Nest scaffold (deploys to NestJS's hosted platform). Not set up or used. |

## Endpoints

- `GET /health`: health check (Terminus: MongoDB, Alpaca streams)
- `GET /docs`: Swagger UI (when `SWAGGER_ENABLED=true`)
- `GET /api/v1/backtests/options`: strategies + params, timeframes, sort keys, data start, AI on/off
- `POST /api/v1/backtests`: run a backtest (uses the run history), write its report; returns
  metrics, history status, AI summary and `reportUrl`
- `POST /api/v1/sweeps`: run a sweep (`params` as `"5..30:5"`-style specs), write its report
- `POST /api/v1/walkforwards`: run a walk-forward test (sweep-style `params`, plus `train`,
  `test`, `anchored`, `sort`, `minTrades`), write its report
- `POST /api/v1/research`: start a research-agent session (runs in the background, returns 202
  with the session); `GET /api/v1/research/:id` to follow it (rounds, tests, holdout, verdict),
  `GET /api/v1/research` for recent sessions
- `POST /api/v1/portfolios`: portfolio backtest (`sleeves: [{strategy, symbols, params, weightPct}]`,
  `maxDrawdownPct`, `cooldownDays`, plus period and costs), writes its report
- `POST /api/v1/robustness`: the multi-symbol check (walk-forward fields plus `goal`; `symbols` =
  the basket, each run on its own). The baskets are in `GET /api/v1/backtests/options`.
- `GET /api/v1/reports`: recent HTML reports
- `GET /reports/<file>.html`: the reports themselves, served with a strict CSP (inline code only,
  no network, same-origin framing)

These are used by the React UI in `../client`. There is **no authentication yet**: keep the
server on your machine (`HOST=127.0.0.1`, the default) until there is, since runs trigger data
downloads and paid AI calls. Invalid input returns 400, Alpaca failures 502.

## Structure

```
src/
  main.ts          # bootstrap
  app.module.ts    # root module
  app.setup.ts     # shared HTTP setup (helmet, CORS, prefix, versioning, validation, swagger)
  config/env.ts    # zod-validated env schema -> ConfigService<Env, true>
  logger/          # nestjs-pino (request IDs, redaction, pretty logs in dev)
  database/        # MongoDB connection (Mongoose)
  orders/          # Order placement + order log (orders, order_events collections)
  strategies/      # Strategy interface, strategies (incl. rules/ building blocks), registry
  backtest/        # Simulated broker, replay engine, metrics, sweeps, walk-forward, reports, CLIs
    plans/         # The test menu: the only tests the AI may propose, validated
    portfolio/     # Portfolio backtest: sleeves on one clock (BacktestStepper), stop, report, CLI, API
  research/        # AI research agent: loop, scoring, prompts, sessions (MongoDB), report, CLI, API
  paper/           # Paper deployments: sub-accounts, daily cycle, guard, runner, API
  autopilot/       # The autonomous loop: retire → research → deploy, schedule, notifications, API
  info/            # News tone (Alpaca news + sentiment), earnings (Alpha Vantage), cached; attached to bars
  risk/            # Pre-trade risk checks + kill switch (+ CLI)
  live/            # Live strategy runner (bar aggregation, live context)
  llm/             # LLM service (OpenAI), presets, tolerant JSON parsing
  health/          # /health endpoint
  alpaca/          # Alpaca REST (AlpacaService) + real-time streams (AlpacaStreamService)
```

## MongoDB

`MONGODB_URI` points at the database. Locally, `npm run db:up` runs MongoDB 7 in Docker on port
27018 (so it doesn't clash with other MongoDB instances on 27017), with data in the `mongo-data`
volume. Define collections with `@nestjs/mongoose` schemas (`MongooseModule.forFeature`) in the
module that owns them. `/health` includes a MongoDB ping, and e2e tests run against an in-memory
MongoDB (`mongodb-memory-server`), so they need neither Docker nor the real database.

## Orders

Place orders with `OrdersService.placeOrder()` (not `AlpacaService` directly), so every order is
logged:

1. The intent is saved (`status: pending_submit`) **before** the request is sent, so a crash
   mid-request still leaves a record. A reused `clientOrderId` is refused before reaching Alpaca.
2. Alpaca's response sets the Alpaca order id and status. A rejection becomes `submit_failed`; a
   network failure where the order can't be found becomes `unknown` (it may exist: reconcile
   before placing again).
3. Every trade-stream event is appended to `order_events` and updates the order's status and fill
   (`filledQty`, `filledAvgPrice`). Orders placed elsewhere (e.g. the Alpaca dashboard) are saved
   with `source: external`.

Every order records `paper: true|false`. Amounts are stored as Alpaca's exact decimal strings.

## Strategies & backtesting

A strategy implements `Strategy` (`src/strategies/strategy.types.ts`): `onBar(bar, ctx)` runs after
each bar closes and can call `ctx.buy/sell/position/cash/now`. The same interface will be served
by the live runner, so the code you backtest is the code that trades. Indicators come from
[`trading-signals`](https://github.com/bennycode/trading-signals) (e.g. `new SMA(20).add(close)`).
Register new strategies in `strategy-registry.ts`.

```bash
npm run report -- AAPL MSFT                      # last 2 years, writes reports/*.html and opens it
npm run report -- SPY --from 2020-01-01 --param fast=10 --param slow=30
npm run backtest -- --symbols AAPL,MSFT --from 2024-01-01 --to 2026-01-01
npm run backtest -- --symbols SPY --from 2023-01-01 --to 2026-01-01 --timeframe 1Hour \
  --param fast=10 --param slow=30 --slippage 10 --out result.json
npm run backtest -- --symbols AAPL,MSFT --from 2024-01-01 --to 2026-01-01 --html reports/aapl.html
npm run backtest -- --help
```

### Market information: news, earnings, volatility

Blocks that use more than the symbol's own prices. Like every block they're tested (walk-forward,
holdout, multi-symbol check) before anything relies on them, and the data is only fetched when a
setting turns them on.

- **Market volatility:** computed from SPY's daily moves (standard deviation from
  trading-signals, annualized). The real VIX index isn't included in Alpaca's plan.
- **News tone:** Alpaca's historical news (headlines back to 2015). Each headline is scored with the
  [`sentiment`](https://github.com/thisandagain/sentiment) library (AFINN word list) plus a finance
  vocabulary (`src/info/finance-words.ts`: "plunge", "downgrade", "lawsuit", "beats", ...), squashed
  to -1..+1. A headline counts for the first close after it was published (after 16:00 New York
  → the next day; weekends roll into Monday), so a backtest never reads news before it was out. Not
  scored by the AI on purpose: the AI knows what happened after old headlines, which would leak the
  future into backtests. Cached per symbol and month in `news_months` (finished months are never
  fetched again); a year of AAPL is ~3,000 headlines, ~15 s the first time.
- **Overnight news** (`--news-gate`, and the paper news check's tone part): each headline also
  records whether it came out before the open (after 16:00 or before 09:30 New York; weekends
  count too), so a backtest can skip buys on bad overnight news exactly as the live check does.
  Only the word-list part can be backtested; the AI part is live-only (it knows how old stories
  ended). Note that an average over many headlines rarely gets very negative for big companies
  (AAPL has ~12 a day): one serious headline among routine ones is diluted, which is what the
  AI check is for.
- **Earnings:** past report dates with their surprise vs the estimate, and upcoming dates, from
  [Alpha Vantage](https://www.alphavantage.co) (set `ALPHAVANTAGE_API_KEY`, free tier: 25 calls a
  day, 2 per symbol a week thanks to the cache in `earnings_reports`). Without the key the earnings
  blocks fail with a clear message and the AI agent is told not to use them. Backtests use the
  actual report dates; companies announce them weeks ahead, so the blocks only look a few days out.

### Run history (saved backtests)

Every `report` / `backtest` run is saved in MongoDB (`backtest_runs`), so identical tests aren't
redone from scratch. A run is identified by a fingerprint of its setup: strategy, **all** params
(defaults included, so `--param fast=20` = the default run), symbols (in order), timeframe,
period, cash, slippage and fees. Each record also stores:

- `engineVersion`: `ENGINE_VERSION` in `src/backtest/backtest-engine.ts`. **Bump it** whenever the
  simulation rules change (fills, slippage/fees, metrics).
- `strategyVersion`: `version` of the strategy in `src/strategies/strategy-registry.ts`. **Bump
  it** whenever that strategy's logic changes.
- `dataHash`: a hash of the bars used (adjusted prices can change after new splits/dividends).
- The full result (fills, equity curve, metrics), the AI summary, and `requestCount` (how many
  times this exact test was asked for).

When the same test is requested again, the saved result **and its AI summary** are reused, but
only while all three still match. Otherwise the test is re-run and the record replaced (the
output says why, e.g. `stale (engine v1 → v2)`). `--fresh` forces a re-run. Bars are still
downloaded each time (for the data check and the charts); the saving is mainly the AI call.
Results over 50,000 points keep only their metrics and always re-run. Sweeps aren't recorded yet.

The backtest commands now need MongoDB; `npm run report/backtest/sweep/walkforward` start it for you.

### AI summary

Every `report`, `backtest`, `sweep` and `walkforward` run ends with a short AI review, printed in the terminal
and shown at the top of the HTML report: a one-line verdict, 2-4 key points (vs. buy & hold, risk,
how much evidence the trades give, unrealized gains, costs) and a **research** recommendation
(what to test next, whether it's worth paper trading, or to drop the idea). It never recommends
buying or selling a security. It's AI-generated, so check it against the numbers.

- Needs `OPENAI_API_KEY` in `.env`; without it (or with `--no-ai`) runs work as before and the
  summary is skipped with a note.
- Model: `OPENAI_MODEL`, default `gpt-5.6-luna` (low-cost tier of OpenAI's newest family,
  $0.20 / $1.20 per 1M input/output tokens; a summary costs well under a cent and takes a few
  seconds). It runs with low reasoning effort; GPT-5-family models don't accept a custom
  temperature, so the presets don't set one.
- One summary per command (a sweep gets one summary of all its runs, not one per combination;
  a walk-forward one summary of all its windows).
- **Suggested next tests:** the summary also proposes up to 3 follow-up tests, only from a fixed
  menu (see [Research agent](#research-agent)): the strategies and params above within their
  limits, walk-forward training `6m/12m/18m/24m` and test `1m/2m/3m/6m`, the sort keys, min trades
  0-20, at most 60 settings per test. The server checks each one and drops anything else. They keep
  the run's symbols, period and costs, and show as a ready-to-run `npm run ...` command (terminal
  and report) and a **Run** button in the Lab.
- The model gets a compact fact sheet (metrics, largest win/loss, realized vs. unrealized P&L,
  costs, rejections; for sweeps every run's result), never raw data. See
  `src/backtest/summary/summary-prompts.ts`.
- `src/llm/` is a port of foozool-initiatives' LLM module: `LlmService.ask()` / `askJson()`
  routes to the provider (OpenAI for now), task presets live in `llm.presets.ts`.

### Choosing the period and options

| Option | Default | Example |
| --- | --- | --- |
| Symbols (positional or `--symbols`) | required | `AAPL MSFT` or `--symbols AAPL,MSFT` |
| `--from <YYYY-MM-DD>` | 2 years before `--to` | `--from 2021-01-01` |
| `--to <YYYY-MM-DD>` | today | `--to 2024-12-31` |
| `--timeframe` | `1Day` | `15Min`, `1Hour`, `1Week` |
| `--strategy` | `sma-crossover` | |
| `--param key=value` (repeatable) | strategy defaults | `--param fast=10 --param slow=30` |
| `--cash <usd>` | `100000` | `--cash 25000` |
| `--slippage <bps>` | `5` (0.05%) | `--slippage 10` |
| `--fee <usd per share>` | `0` | `--fee 0.005` |
| `--cash-yield <pct>` | `3` (% a year on idle cash) | `--cash-yield 0` |
| `--news-gate <tone>` | `0` (off) | `--news-gate 0.3`: skip a buy when the headlines before its open (overnight, pre-market, the weekend) average tone -0.3 or worse |
| `--html <file>` / `--report` | off / on for `npm run report` | `--html reports/test.html` |
| `--out <file.json>` | off | `--out result.json` |
| `--no-ai` | AI summary on | skip the AI summary |
| `--fresh` | off | re-run even if this exact test is in the run history |

```bash
npm run report -- AAPL --from 2022-01-01              # 2022 until today
npm run report -- AAPL --from 2022-01-01 --to 2023-12-31
```

Data availability: with the free IEX feed (`ALPACA_DATA_FEED=iex`), stock history starts on
**2020-07-27**. An earlier `--from` simply starts at the first available bar (the report's Period
line shows the real range). Intraday timeframes work over long ranges too, e.g. 2 years of `15Min`
bars is ~13,000 bars. The strategy needs enough bars to warm up: `sma-crossover` with `slow=50` on
daily bars makes no trades in the first 50 trading days.

How the simulation works:

- Bars come from Alpaca, adjusted for splits and dividends.
- Orders placed on a bar fill at the **next** bar's open (no look-ahead), minus slippage
  (`--slippage`, default 5 bps) and any per-share fee (`--fee`, default 0: Alpaca stocks are
  commission-free). Long-only, market orders; a buy that no longer fits the cash at the fill
  price is reduced to what fits.
- **Interest on idle cash** (`--cash-yield`, default 3% a year): while the strategy is out of the
  market, its uninvested cash earns this rate, compounded daily on calendar time, like a broker's
  cash sweep or a money-market fund. Buy & hold is always invested, so without it timing
  strategies would be unfairly penalized. The reports, AI summaries and the Lab show the interest
  earned; `--cash-yield 0` turns it off. (Engine version 3: saved runs from before are re-run.)
- Report: return vs. equal-weight buy & hold, max drawdown, closed trades, win rate, profit
  factor, open positions (valued at the last close), rejected orders. `--out` writes the full
  result, including every fill and the equity curve.
- `--html` writes a single-file visual report (works offline, open it in any browser): equity vs.
  buy & hold, drawdown, candlesticks per symbol with buy/sell markers, and the fills table with
  P&L. Charts use TradingView's [lightweight-charts](https://github.com/tradingview/lightweight-charts),
  inlined into the file. `reports/` is git-ignored.

Results are hypothetical: real fills, liquidity and fees differ, and past results do not
predict future ones.

### Strategies

| Name | Idea | Params (defaults) |
| --- | --- | --- |
| `sma-crossover` | Trend following: buy when the fast SMA crosses above the slow SMA, sell when it crosses below | `fast=20 slow=50` |
| `rsi-reversion` | Mean reversion: buy when RSI is oversold while price is above its trend SMA, sell when RSI is overbought | `period=14 oversold=30 overbought=70 trend=200` (`trend=0` = no filter) |

| `momentum-rotation` | Rotation ("dual momentum"): every `rebalanceDays` (21), rank the symbols by their return over `lookback` bars (126) and hold the top `topN` (2); with `absMomentum` (on) a pick must itself be rising, and its share goes to the safe asset (`safeLast=1`: the last symbol, e.g. TLT) or stays in cash | `lookback=126 topN=2 rebalanceDays=21 absMomentum=1` |
| `rules` | Building blocks: every entry rule that is on must hold on the same bar to buy; any exit rule that is on sells | `breakout=20 trailingStop=10`, everything else off |

`rules` blocks (each is a number, `0` = off, so they can be swept and combined freely):

- **Entry:** `trendSma` (close above its N-bar average), `crossFast`/`crossSlow` (average
  crossover), `rsiBelow` (+ `rsiPeriod`), `breakout` (close above the previous N bars' high),
  `dipPct` (+ `dipLookback`: X% under the recent high), `bbPeriod` (+ `bbStd`: below the lower
  Bollinger band), `macdCross` (1 = MACD line crosses above its signal line; `macdFast/Slow/Signal`
  default 12/26/9), `volumeRatio` (+ `volumePeriod`: volume at least N× its recent average),
  `marketSma` (only while SPY, the whole market, closes above its N-bar average; 200 is the
  classic bull-market filter).
- **Exit:** `stopLoss`, `takeProfit`, `trailingStop` (%), `atrStop` (+ `atrPeriod`: Chandelier
  stop, N average ranges below the recent high, so it adapts to the stock's volatility),
  `crossExit` (1 = average cross down), `macdExit` (1 = MACD cross down), `exitTrendSma`,
  `rsiAbove`, `breakdown` (close under the previous N bars' low), `marketExit` (1 = SPY falls below
  its `marketSma` average), `maxHold` (bars).
- **Information beyond prices** (see [Market information](#market-information-news-earnings-volatility)):
  `volMax` / `volExit` (only buy while the market is calm: SPY's yearly volatility over `volPeriod`
  days below X%; sell when it rises above X%), `newsFilter` + `newsMin` / `newsExit` (average
  headline tone of the last `newsDays` days, -1..+1: only buy at or above `newsMin`, sell at or
  below `-newsExit`), `earningsAvoid` / `earningsExit` (no buys within N days before an earnings
  report; sell N days before it), `surpriseMin` (+ `surpriseDays`: buy within N days after a report
  that beat the estimate by at least X%, the "post-earnings drift").

Indicators come from the [trading-signals](https://github.com/bennycode/trading-signals) library
(SMA, EMA, RSI, MACD, Bollinger Bands, Donchian channels, Chandelier Exit/ATR, relative volume),
not hand-written math. The market filter needs SPY prices even when you don't trade SPY: they're
fetched automatically when `marketSma` is on and fed to the strategy as read-only market data
(never traded, not part of buy & hold); the live runner streams SPY too.

For example `--strategy rules --param trendSma=200 --param breakout=0 --param rsiBelow=30
--param trailingStop=8` buys RSI dips in an uptrend and exits on an 8% trailing stop, and
`--param marketSma=200 --param marketExit=1 --param trailingStop=0 --param atrStop=3` buys 20-bar
breakouts only in a bull market and exits on a 3-ATR stop or when the market turns. Combinations
that can't trade (no entry or no exit rule, `crossFast >= crossSlow`, ...) are rejected.

**Position sizing by volatility:**

- `momentum-rotation`: `volWeight=1` weighs the picks by 1 ÷ their volatility over `volLookback`
  bars (calmer ones get more) instead of equally; `targetVol=15` scales all holdings down when
  their average yearly volatility is above 15% (the rest stays in cash, earning interest); `band`
  (2%) skips trades smaller than that share of the account, so it doesn't churn.
- `rules`: `targetVol=20` (+ `targetVolDays`) buys a smaller position in a jumpier stock, about
  `targetVol ÷ its volatility` of the usual size.

For `momentum-rotation`, `allocation` is the share of the account it keeps invested (default 1:
all of it). Rotations need a group of symbols, e.g.
`npm run walkforward -- XLK XLF XLE XLV XLY XLP XLI XLU XLB XLRE XLC TLT --strategy momentum-rotation --param topN=2,3 --param lookback=63,126,252 --param safeLast=1 --train 24m`.

The engine runs a strategy's `onClose` once every symbol's bar of the day is in (the rotation
rebalances there), and at the next open it fills sells before buys, so a sale's cash can pay for
the new buy the same morning, as in a real account (engine version 4).

All other strategies also take `allocation` (fraction of cash per buy, default `1 / number of symbols`). `--help`
on any command lists the strategies and their params. `rsi-reversion` with `trend=200` needs 200
bars before its first trade, so give it a long period (e.g. `--from 2020-07-27`).

### Sweeps: compare settings and strategies

`npm run sweep` runs every combination of the params you give it (bars are fetched once, so it's
fast) and prints a ranked table plus a summary per strategy.

```bash
npm run sweep -- AAPL --param fast=5..30:5 --param slow=20,50,100      # 6 × 3 grid, opens the visual report
npm run sweep -- AAPL --param fast=5..30:5 --param slow=20,50,100 --no-report   # text table only
npm run sweep -- AAPL MSFT --strategy sma-crossover,rsi-reversion      # compare at defaults
npm run sweep -- AAPL MSFT --strategy rsi-reversion --from 2020-07-27 \
  --param oversold=25,30,35 --param overbought=60,70,80 --sort return-dd --min-trades 3 --out reports/rsi.csv
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--param key=values` | strategy defaults | `10` one value, `5,10,20` a list, `5..30:5` a range with step (step 1 if omitted) |
| `--strategy a,b` | `sma-crossover` | one or more strategies; each gets only the params it has |
| `--sort` | `return` | `return`, `drawdown` (smallest first), `profit-factor`, `return-dd` (return ÷ max drawdown; drawdowns under 5% count as 5%) |
| `--top <n>` | `20` | rows shown |
| `--min-trades <n>` | `0` | hide runs with too few closed trades to mean anything |
| `--out <file.csv>` | off | every run as CSV (spreadsheet-friendly) |
| `--html <file>` | `reports/sweep_*.html` | where to write the visual report |
| `--no-report` | off | text only: don't write or open the visual report |
| `--from/--to/--timeframe/--cash/--slippage/--fee/--cash-yield` | as in backtest | |

Invalid combinations (e.g. `fast >= slow`) are skipped and counted; a param name no selected
strategy has is an error (catches typos). At most 2,000 combinations per strategy. The output ends
with the `npm run report` command for the top row, to open it as a visual report.

The visual report (written to `reports/` and opened in your browser by default) shows:

- **Summary per strategy:** median return, best return, how many settings were positive and beat
  buy & hold.
- **Return by setting:** a heatmap when 2 params are swept (e.g. `fast` × `slow`), a bar chart for 1.
  Each cell is one setting, greener = higher return, outlined = beat buy & hold, `—` = invalid combo.
  A block of good neighbors is a much better sign than one lone winner. (3+ swept params: see the
  scatter/table instead.)
- **Return vs. drawdown:** every run as a dot, colored by strategy; up-and-left is better. The
  dashed line is buy & hold.
- **Top 5 equity curves** (by `--sort`) against buy & hold.
- **All runs:** sortable table (click a column). Clicking a row, heatmap cell or dot shows its
  `npm run report ...` command with a Copy button, to open that run as a full backtest report.

Reading it: the summary shows each strategy's **median** return, how many settings were positive,
and how many beat buy & hold. A strategy is more believable when many nearby settings do well,
not just the top row (a lone winner is usually overfitting to the past).

### Walk-forward: does the winner hold up?

A sweep picks its best setting by looking at the whole period, so its top result is too
optimistic: you couldn't have known that setting in advance. A walk-forward test repeats "pick,
then trade" the way you would in real life:

```
|---- train 12m ----|-- test 3m --|                   window 1: pick on train, trade on test
     |---- train 12m ----|-- test 3m --|              window 2: moved forward 3 months
          |---- train 12m ----|-- test 3m --|         ...
```

In each window every setting runs on the training part, the best one (by `--sort`) is traded on
the next, unseen test part, and only the test parts are stitched together into the result. Each
test window starts with the money the previous one ended with, and sells anything still held at
its end (the next window may pick a different setting). Training runs never see a bar from their
test period (there's a test that checks this).

```bash
npm run walkforward -- AAPL --param fast=5,10,20 --param slow=30,50,100
npm run walkforward -- SPY --strategy rsi-reversion --param period=7,14,21 --train 2y --test 6m
npm run walkforward -- AAPL MSFT --param fast=5..30:5 --param slow=50,100 --anchored --min-trades 2
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--param`, `--strategy` | strategy defaults | the settings to choose from, same syntax as `sweep` |
| `--train <duration>` | `12m` | training length: `90d`, `26w`, `12m`, `2y` |
| `--test <duration>` | `3m` | test length, and how far each window moves |
| `--anchored` | off (rolling) | training always starts at `--from` and grows, instead of a fixed window that slides |
| `--sort` | `return-dd` | how the best training run is picked (same keys as `sweep`) |
| `--min-trades <n>` | `0` | training runs with fewer closed trades can't be picked (if none qualify, all can) |
| `--from/--to` | last 5 years | needs more than one training length before the first test |
| `--html`, `--no-report`, `--no-ai`, `--timeframe/--cash/--slippage/--fee/--cash-yield` | as in sweep | |

Reading the result:

- **Return on unseen data** vs. buy & hold over the same months: the number that matters.
- **Efficiency** = annual return on unseen data ÷ average annual return in training. Around 50% or
  more is decent; near 0 or negative means the training winners were mostly luck.
- **Settings used / changed:** the same setting winning window after window is a good sign; a
  different winner every time means there's no stable edge.
- The report shows the stitched equity curve against buy & hold (with a marker where each test
  window starts) and a table: what was picked in each window, its training return, and how it
  then did on the unseen months.

### Portfolio backtest

`npm run portfolio` runs several **sleeves** together: each is a strategy with fixed settings, its
own symbols and a share of the starting cash (`--sleeve "WEIGHT STRATEGY SYMBOLS [param=value ...]"`,
repeatable, or `--file portfolio.json`). What no sleeve gets stays in cash and earns the cash
yield. Each sleeve trades its own account, all on one shared clock, so the portfolio can react as
a whole:

- **Portfolio stop** (`--max-drawdown 15`, default off): when the whole portfolio is 15% below its
  peak, every sleeve sells everything at that bar's close and makes no new buys for `--cooldown`
  days (default 20). The next drawdown is measured from there.
- **Benchmark:** each sleeve's money bought and held in its own symbols, plus the reserve in cash.
- **Per sleeve:** money put in, ended with, made/lost, vs holding its symbols, worst drop, trades.
- **Diversification:** correlation of the sleeves' daily moves (1 = identical, 0 = unrelated).

Settings are fixed, so if you picked them by looking at this same period the result is flattered;
use the walk-forward test, multi-symbol check and research agent to choose them. The Lab has a
**Portfolio** mode with a sleeve editor.

### Multi-symbol check

`npm run robustness` runs one walk-forward setup on each symbol of a basket **separately** (not as
one portfolio) over the period (default: last 5 years), scores each one for the goal (default
`risk-adjusted`, as in the research agent: above 0 = better than just holding that symbol), and
**passes when it's better than holding on at least 60% of the symbols**. Symbols without data are
listed as failed.

Baskets: `megacaps` (AAPL, MSFT, NVDA, AMZN, GOOGL, META, TSLA, JPM, V, UNH), `sectors` (the 11
SPDR sector ETFs), `indexes` (SPY, QQQ, IWM, DIA). Pass symbols instead of (or on top of) a basket:
`npm run robustness -- AAPL MSFT NVDA --strategy ...`. Setup options are the same as
`npm run walkforward`; prices are fetched once for all symbols. In the Lab: **Check** under any
walk-forward result.

### Research agent

`npm run research -- AAPL` (or **AI agent** in the Lab) searches for a setup that works on data it
wasn't tuned on, like a researcher would, but inside fixed rules.

**How it works**

1. The period (default: last 5 years) is split into a **research period** and a **holdout** (the
   last 12 months, `--holdout`). The agent never sees the holdout.
2. **Each round** (up to `--rounds`, default 5) the AI gets the goal, buy & hold over the research
   period, every test so far with its results (best first), the proposals the menu rejected last
   round and why, and the **test menu**. It answers with its reasoning, up to `--tests` (default 3)
   new walk-forward tests, optionally ideas for new building blocks, and whether it's done.
3. The server **checks every proposal** against the menu (known strategies, params within limits,
   valid combinations, allowed windows, at most 60 settings, not already tested) and runs the valid
   ones as walk-forward tests on the research period. Rejected ones are sent back with the reason.
4. Each test gets a **score** for the goal (`--goal`): `risk-adjusted` (default: annual return ÷ max
   drawdown, minus the same for buy & hold), `beat-hold` (annual return minus buy & hold's), or
   `return`. Tests with fewer than 8 trades count as weak evidence and rank below the others.
5. It stops when the AI says nothing more is worth testing, after two rounds without a valid new
   test, or when the rounds run out. The best test is then run **once on the holdout** (its
   walk-forward trains on the data just before it, and every test window falls in the holdout), and
   the AI writes a verdict comparing the holdout with the research result and buy & hold.

6. Then the **multi-symbol check** (`--basket`, default `megacaps`, `none` to skip) runs the best
   test on each symbol of the basket. For a `momentum-rotation`, which works on a group, it's a
   **multi-group check** instead: the rotation runs on each *other* basket as a whole. The session is a **paper-trading candidate** only if the
   holdout score is above 0 (better than holding) **and** the multi-symbol check passes. The
   verdict, the report, the terminal and the Lab show both.

The holdout is there because trying many ideas and keeping the best one flatters it: the more you
try, the more likely one wins by luck. The holdout result is the honest number. If it's much worse
than the research result, the "edge" was mostly luck.

**What the AI can change:** only what's in the menu: which strategies (including `rules`
combinations), which param values walk-forward picks from, training/test lengths, anchored or
rolling, how the best setting is picked, and min trades. Symbols, period, timeframe and costs are
fixed for the session. It can't write code; ideas for new blocks are only listed for you.

**Persistence:** every session is saved in MongoDB (`research_sessions`) after every step: the
request, each round's reasoning, rejected proposals and ideas, each test with its plan, results
and score, the chosen test, the holdout result, the verdict and the report link. You can follow a
running session (`GET /api/v1/research/:id`, the Lab polls it every 2 s) and look up past ones
(`GET /api/v1/research`). A session that stops saving for 15 minutes (e.g. the server restarted) is
shown as failed. Tests run on prices fetched once per session.

**What you see:** each round's reasoning and its tests live (terminal or Lab), then the best test,
its holdout result against buy & hold, the "latest pick" (the setting its walk-forward chose on the
most recent training window), the AI verdict, and an HTML report (`reports/research_*.html`) with
the holdout equity chart and every round.

| Option | Default | Meaning |
| --- | --- | --- |
| `--goal` | `risk-adjusted` | `risk-adjusted`, `beat-hold`, `return` |
| `--rounds` / `--tests` | `5` / `3` | max rounds (1-10) and tests per round (1-5) |
| `--holdout` | `12m` | hidden final stretch (the research period before it needs at least 9 months) |
| `--strategy a,b` | all | strategies the agent may use |
| `--basket` | `megacaps` | multi-symbol check of the best test: `megacaps`, `sectors`, `indexes`, `none` |
| `--from/--to/--timeframe/--cash/--slippage/--fee/--cash-yield` | last 5 years, as in backtest | |
| `--no-report` | off | don't open the report |

Cost: one AI call per round plus one for the verdict, with medium reasoning: a few cents per
session. It takes a few minutes. Needs `OPENAI_API_KEY`.

## Risk

Every order from `OrdersService.placeOrder()` passes `RiskService` first. Rejected orders are
never sent and are saved in the order log as `risk_rejected` with the reason.

| Check | Applies to |
| --- | --- |
| Kill switch engaged | every order |
| More than `RISK_MAX_ORDERS_PER_MINUTE` | every order |
| Sell larger than the long position (no shorting) | sells |
| Daily loss (`equity - last close equity`) ≥ `RISK_MAX_DAILY_LOSS` | buys |
| Position value would exceed `RISK_MAX_POSITION_VALUE` | buys |
| Total exposure would exceed `RISK_MAX_TOTAL_EXPOSURE` | buys |

Sells that shrink a position are never blocked by the loss or size limits, so a limit can't
trap you in a losing position.

The kill switch lives in MongoDB (`risk_state`), so it survives restarts and works on a running
server from another terminal:

```bash
npm run kill-switch -- status
npm run kill-switch -- on --reason "something is wrong"   # blocks orders, cancels open ones
npm run kill-switch -- on --flatten                        # ...and closes every position
npm run kill-switch -- off
```

## Paper trading (deployments)

Deploy any setup to your Alpaca **paper** account and let it trade day by day: from the Lab
(**Paper trade this** on a backtest, a walk-forward's latest pick, a portfolio, or an AI research
result) or the API. The Lab's **Paper trading** page shows every deployment.

**How it works**

- A deployment has one or more **sleeves** (strategy, symbols, fixed settings, share of its paper
  money). Each sleeve keeps its own **sub-account** (cash, positions, trades) inside the shared paper
  account, so several deployments can run side by side. A symbol belongs to one live deployment
  only, and deploying refuses symbols the account already holds outside any deployment, so their
  positions never mix. The paper money must fit in the account's free cash.
- **Daily cycle** (every `PAPER_TRADING_POLL_MINUTES`, default 15): book the fills of earlier
  orders (from Alpaca, by client order id), feed each **completed** daily bar to the strategies
  (a day counts as complete once its session has closed, from Alpaca's market clock), and send
  the orders they ask for as market orders that fill at the next open, like the backtest. Orders go
  through the same risk checks and order log as everything else. If the runner was off for a few
  days, it catches up on the prices but only trades on the latest day.
- A new deployment first **warms up** on history (no orders) and starts trading after the next
  completed trading day. After a server restart it replays history again without re-sending orders.
- **Expectation:** when you deploy, the same setup is backtested over the last 3 years; the
  dashboard compares live results with it (in line / behind / dropping more than expected, judged
  after 20 trading days).
- **Real-time news check** (on by default for new deployments; set in the deploy dialog or
  `PUT /api/v1/paper/deployments/:id/news-check`):
  - **Before a buy:** after the close, sells go out right away but **buys wait**. When the market
    opens within 30 minutes (or is open), the runner fetches the headlines published since the
    signal: the buy is **skipped** when they average `tone` (0.3) negative or worse, or when the
    **AI** (`ai`, needs `OPENAI_API_KEY`) reads them and finds a serious event: fraud, a trading
    halt, bankruptcy, a big lawsuit or regulatory action, a guidance cut, the CEO leaving, a
    dilutive offering... Routine news, price targets and market moves don't count. Otherwise the
    buy is sent. Buys that wait more than 4 days are dropped.
  - **Holdings (`watch`):** every cycle, new headlines about held symbols are scanned; a severe one
    (tone -0.6 or worse), when the AI agrees, is logged and notified (`alert`, default) and, with
    `sell`, the position is sold.
  - **Sources, in order:**
    1. **Official facts** (no AI needed): a **trading halt** right now (Nasdaq Trader's official
       halt feed, all US markets, cached 2 minutes) or a **severe 8-K filing** since the signal (SEC
       EDGAR: item 1.03 bankruptcy, 1.05 material cybersecurity incident, 3.01 delisting notice, 4.02
       financial statements no longer reliable) blocks the buy, or alerts on / sells a holding.
       Notable filings (5.02 officers leaving, 2.06 write-downs, 2.05 restructuring, 4.01 auditor
       change) go to the AI with the headlines. EDGAR needs `SEC_USER_AGENT` (the SEC asks for a
       contact, e.g. `"stock-invest you@example.com"`); without it the filings check is off.
    2. **Headlines** from Alpaca, which come from one provider, **Benzinga**: the tone check (single
       stocks only) and the AI.
    3. **ETFs** (`src/info/etf-profiles.ts`: index, sector, bond, gold, international funds): the
       AI reads the fund's own headlines for **market-wide emergencies** only (a market-wide halt or
       circuit breaker, emergency central bank action, war between major economies, a major bank
       failure, a sovereign default), not normal sell-offs. Then the fund's **big holdings** (5%+,
       up to 5: e.g. XOM ~23% of XLE) get the company checks above, so a serious event at XOM blocks
       buying XLE. The holdings and weights are **approximate (around mid-2025), kept by hand**:
       Alpaca has no holdings data, so update them now and then.
  - Every decision is in the deployment's event log ("Skipped buying 10 AAPL: the AI flagged the
    news: ..."). Deployments made before this have no news checks until you turn them on. The
    Paper trading page shows which sources are active.
- **Guard:** when a deployment falls `maxDrawdownPct` below its peak (default: 1.5 × the backtest's
  worst drop, at least 10%), it's paused and everything it holds is sold. **Pause** (keep positions,
  no new orders), **Resume** and **Stop & sell all** are yours to use any time.
- **Paper only:** the runner and the API refuse a live account. `PAPER_TRADING_ENABLED=false` turns
  the runner off (deployments are kept but not traded).

Endpoints: `GET /api/v1/paper/account`, `GET/POST /api/v1/paper/deployments`,
`POST /api/v1/paper/deployments/from-research`, `GET /api/v1/paper/deployments/:id`,
`POST /api/v1/paper/deployments/:id/pause|resume|stop|run`. Deployments are saved in the
`deployments` collection after every cycle (sub-accounts, pending orders, daily equity points,
event log).

## Autopilot (the autonomous loop)

The autopilot runs research → paper trading on its own. It's **off until you turn it on** (Lab →
Paper trading → Autopilot, or `PUT /api/v1/autopilot {"enabled": true}`). Every `everyDays` (default
7) it:

1. **Retires** its own failing deployments (stops them and sells everything): the safety guard
   tripped, it's dropping more than its backtest's worst, or it's still behind its backtest after
   `retireBehindAfterDays` trading days (default 40). **Deployments you made are never touched.**
2. **Researches** the next `symbolsPerRun` symbols (default 2) of its watchlist with the AI agent,
   taking turns through the list and skipping symbols a deployment already owns.
   It also researches one **group** per run (`groups`, default the sector ETFs, taking turns) as a
   whole, so it can find rotation strategies.
3. **Paper-deploys** each idea that passed every check (hidden final year better than holding, and
   the multi-symbol check), with `capitalPerDeployment` (default $10,000), up to `maxDeployments`
   (default 3) at once, within the account's free paper cash.

Between runs it checks its deployments every hour and retires failing ones right away. Every
decision is saved (`autopilot_runs`) with its reason and shown in the Lab, and sent as a message
when notifications are set up (see below). **Run now** starts a run
immediately. Cost: about `symbolsPerRun × (rounds + 1)` AI calls per run.
`AUTOPILOT_SCHEDULER_ENABLED=false` turns the schedule off (only Run now works). Paper only, like
every deployment.

Endpoints: `GET /api/v1/autopilot` (settings, running run, next run, recent runs),
`PUT /api/v1/autopilot` (any settings), `POST /api/v1/autopilot/run`.

## The broker (start here)

The web app opens on **Broker**: give it paper money and it trades by itself. After every close
it ranks ~50 of the biggest US stocks (`src/broker/universe.ts`) with the momentum rotation:
it holds the 5 that rose most over the last 12 months, leaving out the latest month (only ones
still rising, more of the calmer ones), re-checks weekly, sells what drops out and parks the rest in T-bills (BIL) when too few
stocks are rising. Before each buy it checks the news, trading halts and SEC filings; severe
breaking news on a holding (AI-confirmed) sells it. It pauses itself at 1.5× the backtest's worst
drop.

- **Plan first**: enter an amount and it suggests the spread (`POST /api/v1/broker/preview`
  `{"capital": 200}`: stocks, share, amount, shares, price, first stop, why, from completed days);
  **Approve and invest** starts it, and it buys at the next open.
- **Sell rules**: a 25% trailing stop (below the highest close since the buy; it only moves up, so
  it also locks in gains), dropping out of the top 5 at the weekly re-check, and severe breaking
  news. No fixed take-profit (`takeProfitPct` exists; in the algo lab, take-profits and tighter
  stops cut the winners short).
- **Your control per holding** (⋯ menu): sell all or half now (`POST /api/v1/broker/positions/:symbol/sell`
  `{"fraction": 1 | 0.5}`; after selling all, it doesn't buy that stock again for 30 days, "Allow now"
  lifts that), and your own stop loss / profit target (`PUT .../levels` `{"stopPrice", "takeProfitPrice"}`,
  null = automatic), checked on daily closes; the higher stop counts. Each holding has a status:
  Strong / Weakening (its rank now vs the top 5) / Near stop / Near target / Selling / Parked.
- A new broker acts on the latest close right away: approve tonight, it buys at the next open.
- **Holdings**: buy price and date, now, gain, the price it sells below, and a chart per stock
  (`GET /api/v1/broker/chart/:symbol`: closes, trades, buy / stop / high lines).
- **Telegram**: a message for each fill within ~5 minutes (shares, price, total, why, and the
  stop for a buy or the profit/loss for a sell), and a daily update after each trading day: value
  vs SPY, every stock (bought vs now, gain in % and $, status and rank, the price it sells below),
  the day's trades and what goes out at the next open.
- **Monthly health check**: the fixed settings over the last 3 years vs holding the stocks; it
  warns you when the algo trails (it never changes the settings by itself).
- **Algo lab** (`node dist/broker/lab/algo-lab.cli.js --universe today|2020 --cache <file>
  [--set sensitivity]`): every variant through the same walk-forward, on today's 50 biggest and on
  the 50 biggest of end-2020 (a fairer list). Its findings (Oct 2026, Jul 2022 → Oct 2026): every
  setting near the classic one beat SPY on both lists; re-tuning every 6 months did worse than
  keeping the classic settings; skipping the latest month (12-1) helped a little with smaller
  drops; a 200-day market filter, risk-adjusted ranking and trailing stops lowered returns.
  Other kinds of algo (`--set families`, textbook settings, Jul 2022 → Oct 2026, today's 50 /
  end-2020 50, vs SPY +101%): low volatility +32% / +22%; every stock above its 200-day average
  +70% / +43%; equal weight with a 200-day market filter +73% / +47% (all with much smaller drops,
  -8% to -13%); buying dips in uptrends +117–131% / +84–102% with ~1,000 trades; momentum
  +318% / +311% (drop -26% / -20%). The rotation's `rankBy` (0 momentum, 1 risk-adjusted,
  2 calmest, 3 biggest dip) and `trendSma` (per-stock trend filter) make these one strategy.
- **Fractional shares** (`fractional=1` on the rotation): from $100 it can hold 0.25 of a pricey
  stock. Amounts are kept to 4 decimals; a stock Alpaca can't trade in fractions is bought in
  whole shares instead.
- Telegram: `/status`, `/pause`, `/resume`, `/report`, `/broker 500` (start, at least $100).
- API: `GET /api/v1/broker`, `POST /api/v1/broker/start` (`{"capital": 10000}`), `/pause`,
  `/resume`, `/stop` (sells everything), `/report`.

Needs `PAPER_TRADING_ENABLED=true`. The Lab, AI research, ideas and autopilot below are under
**Advanced**.

## Ideas and the Telegram bot

With **Ask me first** on (`askFirst`, the default), the autopilot does not deploy on its own: each
research that passes every check becomes an **idea**, sent to Telegram (and shown in the Lab) with
short evidence: the hidden final year vs just holding, the worst drop, trades, the multi-symbol
check and the AI's headline. Tap **Invest** and it asks how much (amount buttons that fit your
free paper cash, or type any amount), or tap **Skip**. An idea is valid for 3 days (then
the research is stale); a newer idea on the same symbols replaces it.

The bot reads your replies by long polling (no public URL or webhook secret needed) and only
answers `TELEGRAM_CHAT_ID`:

| Command | What it does |
|---|---|
| `/check SPY` (or `/check XLK XLF XLE`) | Research now; an idea if it passes, otherwise why not |
| `/ideas` | Open ideas |
| `/invest ID [amount]` | Paper-invest an idea, e.g. `/invest k3f9 5000`; without an amount it asks |
| `/skip ID` | Drop an idea |
| `/run` | A full autopilot run now |
| `/status` | Paper deployments and how they do |

`TELEGRAM_COMMANDS_ENABLED=false` makes the bot send only. Only one server may read a bot at a
time (a second one gets "conflict" and waits). Endpoints: `GET /api/v1/autopilot/ideas`,
`POST /api/v1/autopilot/ideas/:id/invest` (`{"amount": 5000}` optional),
`POST /api/v1/autopilot/ideas/:id/skip`. Paper only, like every deployment.

## Notifications (Telegram or a webhook)

Messages are sent for each autopilot run's changes and for breaking news, trading halts or
SEC 8-K filings on held positions (and the sells they cause).

- **Telegram**: create a bot with @BotFather (`/newbot`) and send your bot any message. Then open
  `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `"chat":{"id":...}` (for a group, add
  the bot to the group; group ids are negative). Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
- **Webhook**: `NOTIFY_WEBHOOK_URL` receives `POST {"text": "..."}` (e.g. a Slack incoming webhook).

Both can be on at once. Sending never fails a run: errors are only logged (without the URL, which
holds the token). Test with **Send a test** on the Paper trading page, or with
`POST /api/v1/notifications/test` (400 when nothing is set up).

## Live strategies

Set `LIVE_STRATEGIES` in `.env` (JSON array) and restart the server:

```
LIVE_STRATEGIES=[{"strategy":"sma-crossover","symbols":["AAPL","MSFT"],"timeframe":"15Min","params":{"fast":"10","slow":"30"}}]
```

On startup each strategy is warmed up on recent history (orders ignored), then receives live bars
built from the stream's 1-minute bars (`1Min`...`59Min`, `1Hour`...; daily is not supported live).
It runs the same `Strategy` code as the backtester, and orders go through the risk checks and the
order log as market day orders. Details:

- At most one order in flight per symbol per strategy, so a slow fill can't double a position.
- The bar in progress at startup is skipped (it would be missing its first minutes).
- Strategies refuse to start on a live account unless `STRATEGIES_ALLOW_LIVE=true`.

## Alpaca

Set `ALPACA_API_KEY` / `ALPACA_API_SECRET` in `.env` (the "Key" and "Secret" from https://app.alpaca.markets → API Keys).
The endpoint is derived from `ALPACA_PAPER`, so it is not configured separately.

- `ALPACA_PAPER=true` (default) trades on the paper account; `false` trades with **real money**.
  Paper and live accounts have different keys, so the keys must match this flag.
- `ALPACA_DATA_FEED=iex` (free) or `sip` (paid data subscription).

On startup the server verifies the keys against Alpaca and refuses to boot if they are rejected.

Use `AlpacaService` (import `AlpacaModule`) for account, positions, orders and market data.
Every order needs a unique, stable `clientOrderId`: order requests are never retried, and on a
network failure the service looks the order up by that id instead of placing it twice.
Anything not wrapped is available via `alpacaService.client` (the official
`@alpacahq/alpaca-trade-api` SDK). Unit tests use `createMockAlpaca` from
`@alpacahq/alpaca-trade-api/testing`, so they never hit the network.

### Real-time streams

`AlpacaStreamService` exposes Alpaca's WebSockets as RxJS observables:

```ts
constructor(private readonly streams: AlpacaStreamService) {}

// Order events for the account (new, fill, partial_fill, canceled, rejected, ...)
this.streams.tradeUpdates$.subscribe((u) => ...u.event, u.order.symbol);

// Live market data; unsubscribe() drops the symbol once nobody else watches it
const sub = this.streams.bars(['AAPL', 'MSFT']).subscribe((bar) => ...bar.close);
this.streams.quotes(['AAPL']); // bid/ask
this.streams.trades(['AAPL']); // prints
sub.unsubscribe();
```

- The trading stream connects at startup; the market data stream opens on first subscription.
- Both reconnect forever with backoff and re-subscribe automatically. `/health` reports their
  state (`degraded` while reconnecting, HTTP stays 200).
- Alpaca allows **one market data connection per account**. Set `ALPACA_STREAMS_ENABLED=false`
  on any additional instance.
- Stream tests use a fake socket (`wsFactory`) that speaks Alpaca's wire protocol, so the SDK's real
  stream code runs offline.

Env vars are validated at boot, so the app fails fast on bad config. Read them via
`ConfigService<Env, true>` with `config.get('KEY', { infer: true })`, never `process.env`.

## Risk profiles

The broker asks how much and how much risk: each profile shows what it did since 2007 in dollars for
your amount (`GET /api/v1/broker/profiles?capital=1000`), and one is suggested by the amount
(`AMOUNT_RULES` in `src/broker/profiles.ts`: more risk for small amounts, more safety for big ones).

| Profile | What | Per year | Worst drop | Asks you at |
|---|---|---|---|---|
| Aggressive (< $2,000) | the 5 strongest stocks | +18.5% | -46% | -30% |
| Balanced (< $25,000) | the same, to T-bills while the S&P 500 is below its 200-day average | +15.7% | -30% | -20% |
| Careful | 50% that, 50% the S&P 500 with the same filter | +12.2% | -24% | -15% |

SPY: +10.9% a year, -55%. The numbers are in `src/broker/profile-stats.data.ts`, committed so every
environment has them; regenerate with `node dist/broker/lab/profiles.cli.js --save` and commit.
A 70/30 momentum + S&P mix was dropped (Balanced earned as much with a smaller drop).

No automatic sell-everything: past the profile's level it asks you in Telegram (Sell all & stop,
asked twice, or Keep going), again every 10% deeper. Telegram: `/broker 5000` shows the options with
their history, `/broker 5000 balanced` starts one.

### Several investments

Each investment is its own amount and risk profile (e.g. $1,000 Aggressive next to $20,000
Careful), with its own holdings, alerts and buttons: one tab each on the Broker page, plus "Add
investment" while money is free. Free to invest = the account's cash minus what investments hold
uninvested (incl. buys waiting for the open). Investments may hold the same stock; when Alpaca
refuses an order as a possible wash trade (another investment's opposite order on that stock is
open), it waits in `retry` and goes out once that one fills. API: `POST /api/v1/broker/start`
(a new one), `/api/v1/broker/investments/:id/pause|resume|stop`, `.../positions/:symbol/sell|levels|allow`,
`.../chart/:symbol`. Telegram: one daily update with a section per investment; /pause and /resume
apply to all.

## Long, fair backtests (algo lab)

`node dist/broker/lab/algo-lab.cli.js --source yahoo --universe sp500 --from 2005-01-01 --set families`
tests with Yahoo prices (free, no key, cached in `server/.cache/yahoo`, git-ignored, ~500 MB) on a
point-in-time list: each January 1st, the 50 most-traded S&P 500 members of that day (membership
from github.com/fja05680/sp500, MIT, in `server/.cache/sp500`). The rotation can only hold that
year's list (`pointInTime` in `src/strategies/rotation/rotation-universe.ts`, lab only). 302 past
members (mostly bankrupt or bought out) have no Yahoo data, so some survivorship remains.

Results (Jan 2007 → Oct 2026, scored on data the settings never saw): momentum (the broker)
+2,751% (+18.5%/yr, worst drop -46% in 2008) vs SPY +675% (+10.9%/yr) and holding the 50 biggest
equally +822% (+11.9%/yr, -63%). Trend-following: +389% (+8.4%/yr) but only -19%.

## Deploy to Railway

Same setup as foozool-initiatives: a Dockerfile build from `server/`, with a health check.

1. Railway → New project → **Deploy from GitHub repo** (push the repo first) → this repo.
2. Service settings: **Root Directory** `server`, **Config file** `server/railway.toml`.
3. Add a database: New → Database → **MongoDB**.
4. Variables (service → Variables):
   - `NODE_ENV=production` and `API_TOKEN=<openssl rand -hex 32>`: both required, the server
     refuses to start on Railway without them (the API can trade and sell: it must not be open).
   - `MONGODB_URI=${{MongoDB.MONGO_URL}}/stock-invest?authSource=admin`
   - `ALPACA_API_KEY`, `ALPACA_API_SECRET`, `ALPACA_PAPER=true`, `ALPACA_STREAMS_ENABLED=false`
   - `PAPER_TRADING_ENABLED=true`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and the optional keys
     (`OPENAI_API_KEY`, `SEC_USER_AGENT`, `ALPHAVANTAGE_API_KEY`). Don't set `PORT` or `HOST`.
5. Deploy; Railway waits for `GET /health` to pass. Call the API with
   `curl -H "Authorization: Bearer $API_TOKEN" https://<app>.up.railway.app/api/v1/broker`.

Only one server may trade and read the Telegram bot at a time. Once Railway runs, set
`PAPER_TRADING_ENABLED=false`, `TELEGRAM_COMMANDS_ENABLED=false` and
`AUTOPILOT_SCHEDULER_ENABLED=false` in your local `.env`. Railway's MongoDB starts empty: start the
broker there (Telegram `/broker 200`), and stop the local one first, so two brokers don't trade
the same Alpaca account.
