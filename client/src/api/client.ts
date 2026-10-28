import type {
  BacktestOptions,
  BacktestResponse,
  ReportItem,
  SweepResponse,
  PortfolioResponse,
  WalkForwardResponse,
} from './types';
import type {
  BrokerOverview,
  BrokerPlan,
  BrokerProfiles,
  ChartRange,
  NextInLine,
  StockChartData,
  Tracking,
} from './broker-types';
import { currentAccountId, rememberAccount } from '../lib/account';
import type { Account, AccountList, AddedAccount, AuthUser } from './account-types';
import type { AutopilotRun, AutopilotState, DeploymentView, PaperAccount } from './paper-types';
import type { ResearchSession, RobustnessResult } from './research-types';
import type { TaxRecord, TaxReport, TaxYears } from './tax-types';
import type {
  Asset,
  Category,
  Discovered,
  MyStocksView,
  NewsSummary,
  Quote,
  SyncResult,
} from './trade-types';

export class ApiError extends Error {
  /** True when the server couldn't be reached at all (e.g. still starting). */
  constructor(
    message: string,
    readonly unreachable = false,
  ) {
    super(message);
  }
}

const UNREACHABLE = 'The server is not reachable (it may still be starting).';
/** Fired when the server answers 401: the app shows the login page. */
export const AUTH_REQUIRED = 'auth:required';

/** Nest errors carry `message` as a string or a list of validation messages. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  // Every request is for the account picked in the header (the server's first one if none).
  const account = currentAccountId();
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(account ? { 'X-Account-Id': account } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(UNREACHABLE, true);
  }
  // The account the server used (another one when the picked one was deleted).
  const used = res.headers.get('X-Account-Id');
  if (used && used !== account) rememberAccount(used);
  const body = await res.json().catch(() => null);
  // The dev proxy answers 502/503/504 with a plain-text body when the server
  // is down; the server's own errors are always JSON.
  if (!res.ok && body === null && [502, 503, 504].includes(res.status)) {
    throw new ApiError(UNREACHABLE, true);
  }
  // Not logged in (or the login expired): the app shows the login page.
  if (res.status === 401 && !path.startsWith('/api/v1/auth/'))
    window.dispatchEvent(new Event(AUTH_REQUIRED));
  if (!res.ok) {
    const message = body?.message;
    throw new ApiError(
      Array.isArray(message) ? message.join('\n') : (message ?? `Request failed (${res.status})`),
    );
  }
  return body as T;
}

export const api = {
  accounts: () => request<AccountList>('/api/v1/accounts'),
  addAccount: (body: { name: string; keyId: string; secret: string }) =>
    request<AddedAccount>('/api/v1/accounts', { method: 'POST', body: JSON.stringify(body) }),
  renameAccount: (id: string, name: string) =>
    request<Account>(`/api/v1/accounts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  deleteAccount: (id: string) =>
    request<null>(`/api/v1/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  /** A Bullwether paper account ($100,000 of virtual cash). */
  openPaper: () => request<Account>('/api/v1/accounts/paper', { method: 'POST' }),
  /** A paper account back to its starting cash: a fresh account (a new id) in its place. */
  resetPaper: (id: string) =>
    request<Account>(`/api/v1/accounts/${encodeURIComponent(id)}/reset`, { method: 'POST' }),
  options: () => request<BacktestOptions>('/api/v1/backtests/options'),
  reports: () => request<ReportItem[]>('/api/v1/reports'),
  backtest: (body: object) =>
    request<BacktestResponse>('/api/v1/backtests', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  sweep: (body: object) =>
    request<SweepResponse>('/api/v1/sweeps', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  walkForward: (body: object) =>
    request<WalkForwardResponse>('/api/v1/walkforwards', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  startResearch: (body: object) =>
    request<ResearchSession>('/api/v1/research', { method: 'POST', body: JSON.stringify(body) }),
  research: (id: string) => request<ResearchSession>(`/api/v1/research/${id}`),
  portfolio: (body: object) =>
    request<PortfolioResponse>('/api/v1/portfolios', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  paperAccount: () => request<PaperAccount>('/api/v1/paper/account'),
  taxYears: () => request<TaxYears>('/api/v1/tax/years'),
  taxReport: (year: number, paper: boolean) =>
    request<TaxReport>(`/api/v1/tax/report?year=${year}&paper=${paper}`),
  taxRecords: (year: number, paper: boolean) =>
    request<TaxRecord[]>(`/api/v1/tax/records?year=${year}&paper=${paper}`),
  taxSync: () => request<{ added: number }>('/api/v1/tax/sync', { method: 'POST' }),
  authMe: () => request<{ loginRequired: boolean; user: AuthUser | null }>('/api/v1/auth/me'),
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: AuthUser }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>('/api/v1/auth/logout', { method: 'POST' }),
  broker: () => request<BrokerOverview>('/api/v1/broker'),
  brokerProfiles: (capital: number) =>
    request<BrokerProfiles>(`/api/v1/broker/profiles?capital=${encodeURIComponent(capital)}`),
  brokerPreview: (capital: number, profile?: string) =>
    request<BrokerPlan>('/api/v1/broker/preview', {
      method: 'POST',
      body: JSON.stringify({ capital, profile }),
    }),
  brokerStart: (capital: number, profile: string) =>
    request<BrokerOverview>('/api/v1/broker/start', {
      method: 'POST',
      body: JSON.stringify({ capital, profile }),
    }),
  brokerInvestment: (id: string, action: 'pause' | 'resume' | 'stop') =>
    request<BrokerOverview>(`/api/v1/broker/investments/${id}/${action}`, { method: 'POST' }),
  brokerSell: (id: string, symbol: string, fraction: 1 | 0.5) =>
    request<BrokerOverview>(
      `/api/v1/broker/investments/${id}/positions/${encodeURIComponent(symbol)}/sell`,
      {
        method: 'POST',
        body: JSON.stringify({ fraction }),
      },
    ),
  brokerLevels: (
    id: string,
    symbol: string,
    levels: { stopPrice?: number | null; takeProfitPrice?: number | null },
  ) =>
    request<BrokerOverview>(
      `/api/v1/broker/investments/${id}/positions/${encodeURIComponent(symbol)}/levels`,
      {
        method: 'PUT',
        body: JSON.stringify(levels),
      },
    ),
  brokerAllow: (id: string, symbol: string) =>
    request<BrokerOverview>(
      `/api/v1/broker/investments/${id}/positions/${encodeURIComponent(symbol)}/allow`,
      {
        method: 'POST',
      },
    ),
  /** The latest traded price of these symbols (the page's ~live prices). */
  brokerPrices: (symbols: string[], fresh = false) =>
    request<{ prices: Record<string, { price: number; at: string }> }>(
      `/api/v1/broker/prices?symbols=${encodeURIComponent(symbols.join(','))}${fresh ? '&fresh=1' : ''}`,
    ),
  brokerTracking: (id: string) =>
    request<Tracking | null>(`/api/v1/broker/investments/${id}/tracking`),
  brokerChart: (id: string, symbol: string, range: ChartRange = 'buy', compareSpy = false) =>
    request<StockChartData>(
      `/api/v1/broker/investments/${id}/chart/${encodeURIComponent(symbol)}?range=${range}${compareSpy ? '&compare=SPY' : ''}`,
    ),
  testNotification: () =>
    request<{ sentTo: string[] }>('/api/v1/notifications/test', { method: 'POST' }),
  deployments: () => request<DeploymentView[]>('/api/v1/paper/deployments'),
  deployment: (id: string) => request<DeploymentView>(`/api/v1/paper/deployments/${id}`),
  deploy: (body: object) =>
    request<DeploymentView>('/api/v1/paper/deployments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deployResearch: (body: object) =>
    request<DeploymentView>('/api/v1/paper/deployments/from-research', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deploymentAction: (id: string, action: 'pause' | 'resume' | 'stop' | 'run') =>
    request<DeploymentView>(`/api/v1/paper/deployments/${id}/${action}`, { method: 'POST' }),
  autopilot: () => request<AutopilotState>('/api/v1/autopilot'),
  updateAutopilot: (body: object) =>
    request<AutopilotState>('/api/v1/autopilot', { method: 'PUT', body: JSON.stringify(body) }),
  runAutopilot: () => request<AutopilotRun>('/api/v1/autopilot/run', { method: 'POST' }),
  investIdea: (id: string, amount?: number) =>
    request<{ message: string }>(`/api/v1/autopilot/ideas/${id}/invest`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  skipIdea: (id: string) =>
    request<{ message: string }>(`/api/v1/autopilot/ideas/${id}/skip`, { method: 'POST' }),
  robustness: (body: object) =>
    request<RobustnessResult>('/api/v1/robustness', { method: 'POST', body: JSON.stringify(body) }),
  tradeSearch: (q: string) => request<Asset[]>(`/api/v1/trade/search?q=${encodeURIComponent(q)}`),
  tradeQuote: (symbol: string) =>
    request<Quote>(`/api/v1/trade/quote/${encodeURIComponent(symbol)}`),
  tradeChart: (symbol: string, range: ChartRange, compareSpy = false) =>
    request<StockChartData>(
      `/api/v1/trade/chart/${encodeURIComponent(symbol)}?range=${range}${compareSpy ? '&compare=SPY' : ''}`,
    ),
  tradeCategories: () => request<Category[]>('/api/v1/trade/categories'),
  tradeDiscover: (category: string) =>
    request<Discovered>(`/api/v1/trade/discover?category=${encodeURIComponent(category)}`),
  tradeNews: (symbol: string) =>
    request<NewsSummary>(`/api/v1/trade/${encodeURIComponent(symbol)}/news-summary`, {
      method: 'POST',
    }),
  myStocks: () => request<MyStocksView>('/api/v1/trade/my-stocks'),
  tradeSync: () =>
    request<{ result: SyncResult; view: MyStocksView }>('/api/v1/trade/sync', { method: 'POST' }),
  tradeBuy: (symbol: string, amount: number) =>
    request<MyStocksView>('/api/v1/trade/buy', {
      method: 'POST',
      body: JSON.stringify({ symbol, amount }),
    }),
  /** Without an amount: sells all of your shares. */
  tradeSell: (symbol: string, amount?: number) =>
    request<MyStocksView>('/api/v1/trade/sell', {
      method: 'POST',
      body: JSON.stringify(amount === undefined ? { symbol, all: true } : { symbol, amount }),
    }),
  tradeLevels: (
    symbol: string,
    levels: { stopPrice: number | null; takeProfitPrice: number | null },
  ) =>
    request<MyStocksView>(`/api/v1/trade/levels/${encodeURIComponent(symbol)}`, {
      method: 'PUT',
      body: JSON.stringify(levels),
    }),
  tradeWatchlist: (symbols: string[]) =>
    request<MyStocksView>('/api/v1/trade/watchlist', {
      method: 'PUT',
      body: JSON.stringify({ symbols }),
    }),
  brokerNextInLine: (id: string) =>
    request<{ emptySlots: number; candidates: NextInLine[] }>(
      `/api/v1/broker/investments/${id}/next-in-line`,
    ),
  /** Sells all of one stock; with `replaceWith` buys that one instead, else leaves its place empty. */
  brokerSellOne: (id: string, symbol: string, replaceWith?: string) =>
    request<BrokerOverview>(
      `/api/v1/broker/investments/${id}/positions/${encodeURIComponent(symbol)}/sell-one`,
      { method: 'POST', body: JSON.stringify(replaceWith ? { replaceWith } : {}) },
    ),
  brokerFillSlot: (id: string, symbol: string) =>
    request<BrokerOverview>(`/api/v1/broker/investments/${id}/fill-slot`, {
      method: 'POST',
      body: JSON.stringify({ symbol }),
    }),
  marketClock: () =>
    request<{ isOpen: boolean; nextOpen: string; nextClose: string; now: string }>(
      '/api/v1/market/clock',
    ),
};
