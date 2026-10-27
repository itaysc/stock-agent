# Alpaca OAuth app registration: Bullwether

Text to paste into Alpaca's OAuth app registration (Alpaca dashboard → OAuth Apps / Alpaca Connect).
Field names may differ slightly in the form; use the closest match.

## App name
Bullwether

## Website
https://bullwether.com

## Redirect URI
https://bullwether.com/api/v1/auth/alpaca/callback

(For local development, optionally also: http://localhost:5173/api/v1/auth/alpaca/callback)

## Short description (one or two lines)
Bullwether is a free paper-trading companion: it runs rules-based momentum strategies in the user's
own Alpaca paper account, lets them trade stocks themselves, and keeps records for their tax report.

## Full description
Bullwether connects to a user's own Alpaca paper trading account with OAuth. Users never share API
keys with Bullwether: they sign in to Alpaca, approve access, and can revoke it at any time in their
Alpaca dashboard.

With that access, Bullwether:
- Runs rules-based investment strategies that the user explicitly starts and approves (for example,
  holding the stocks with the strongest 12-month price momentum and selling by stop rules). Nothing is
  traded until the user approves a plan, and every strategy can be paused or stopped at any time.
- Lets users buy and sell stocks themselves by dollar amount, set their own stop and target prices,
  and keep a watchlist.
- Shows account data, charts, backtests on historical prices, and AI-generated news summaries.
- Keeps a record of account activity with exchange rates to help users prepare their tax report.

Bullwether currently supports paper (simulated) accounts only and requests `env=paper`. It does not
request live trading access.

## Requested scopes and why
- `trading`: to place and cancel the orders of the strategies the user starts, and of the trades the
  user makes in the app.
- `data`: to read prices and news for charts, strategy signals and backtests.
- No `account:write`: the app only reads account details (cash, positions, orders, activity), which
  needs no extra scope, and never changes account settings.

## Commercial use
Bullwether is free. It has no ads, no in-app purchases and no paid features. It does not earn money
from users' trading. (If this changes, we will disclose it to Alpaca and ask for approval first.)

## Data handling and security
- OAuth access tokens are stored encrypted at rest (AES-256-GCM) on our server and are never sent to
  the browser or shared with third parties.
- The OAuth flow uses a random `state` value tied to the user's browser, and the client secret stays on
  our server (the token exchange is server-to-server).
- We use users' Alpaca data only to provide the service. We do not sell it or use it for advertising.
  AI providers receive only market information (symbols, headlines), never account data or credentials.
- All traffic uses HTTPS; logins use httpOnly cookies.
- Users can disconnect at any time: in the app, or by revoking access in their Alpaca dashboard.

## Disclosures
- Bullwether is not affiliated with, endorsed by or developed by Alpaca.
- Bullwether is a software tool, not a broker-dealer or investment adviser, and does not provide
  investment advice. Users are responsible for their own investment decisions.

## Legal pages
- Terms of Use: https://bullwether.com/terms
- Privacy Policy: https://bullwether.com/policy
- Accessibility Statement: https://bullwether.com/accessibility

## Contact
legal@bullwether.com
