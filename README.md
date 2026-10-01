# Stock Invest

Algorithmic trading platform on [Alpaca](https://alpaca.markets): strategies, backtesting,
risk checks, live (paper) trading, and a web UI for research.

| Folder | What |
| --- | --- |
| [`server/`](server/README.md) | NestJS API + trading engine: Alpaca, backtests, sweeps, walk-forward, portfolios, AI research agent, paper trading, autopilot, reports, risk, live runner |
| [`client/`](client/README.md) | React "Backtest Lab" UI: backtests, sweeps, walk-forward, portfolios, the AI agent, and the paper-trading dashboard with the autopilot |

## Quick start

```bash
nvm use            # Node 22
npm run setup      # installs root, server and client dependencies (uses npm 11)
npm run dev        # server (:3000, starts MongoDB in Docker) + client (:5173), one terminal
```

Open http://localhost:5173. `server/.env` must be filled in first (see `server/.env.example`).

## Root scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the server and the client together; output is prefixed `[server]` / `[client]`. Ctrl+C stops both. |
| `npm run setup` | Installs dependencies in the root, `server/` and `client/` |
| `npm test` | Server unit + e2e tests, then client tests |
| `npm run build` | Builds the server and the client |

Notes:

- `npm run dev` starts the client once the server answers `/health`; the UI also shows
  "Waiting for the server…" and retries while the server (re)starts.
- The server listens on `127.0.0.1` only (`HOST` in `server/.env`), since there is no login yet.
- Ports 3000 and 5173 must be free. If a server is already running elsewhere, the new one fails
  with `EADDRINUSE` while the client keeps running (Nest's watcher doesn't exit when its app
  crashes), so check the `[server]` lines.
- Starting the server also starts any `LIVE_STRATEGIES` from `server/.env` (paper by default).
- The apps can still be run separately: `npm run dev` inside `server/` or `client/`.
