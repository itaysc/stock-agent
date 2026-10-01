import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';

const TICKERS = 'https://www.sec.gov/files/company_tickers.json';
const SUBMISSIONS = (cik: string) =>
  `https://data.sec.gov/submissions/CIK${cik.padStart(10, '0')}.json`;
const TICKERS_MS = 24 * 3_600_000;
const FILINGS_MS = 10 * 60_000;

export interface Filing {
  form: string;
  /** 8-K item numbers, e.g. ["5.02", "9.01"]. */
  items: string[];
  acceptedAt: Date;
  url: string;
}

interface Submissions {
  filings?: {
    recent?: {
      form: string[];
      items: string[];
      acceptanceDateTime: string[];
      accessionNumber: string[];
      primaryDocument: string[];
    };
  };
}

/**
 * Companies' official 8-K filings (material events) from SEC EDGAR. The SEC
 * asks every client to send a User-Agent with a contact, so this is off until
 * SEC_USER_AGENT is set (e.g. "stock-invest you@example.com").
 */
@Injectable()
export class EdgarService {
  private readonly logger = new Logger(EdgarService.name);
  private tickers: { at: number; cik: Map<string, string> } | null = null;
  private readonly filings = new Map<string, { at: number; list: Filing[] }>();

  constructor(private readonly config: ConfigService<Env, true>) {}

  get configured(): boolean {
    return this.agent !== '';
  }

  private get agent(): string {
    return this.config.get('SEC_USER_AGENT', { infer: true });
  }

  /** 8-K filings accepted after `since` (empty when off, for funds, or on network trouble). */
  async eightKs(symbol: string, since: Date): Promise<Filing[]> {
    if (!this.configured) return [];
    try {
      const all = await this.recent(symbol.toUpperCase());
      return all.filter(
        (f) => f.form.startsWith('8-K') && f.acceptedAt > since,
      );
    } catch (err) {
      this.logger.warn(
        `EDGAR unavailable for ${symbol}: ${(err as Error).message}`,
      );
      return [];
    }
  }

  private async recent(symbol: string): Promise<Filing[]> {
    const cached = this.filings.get(symbol);
    if (cached && Date.now() - cached.at < FILINGS_MS) return cached.list;
    const cik =
      (await this.ciks()).get(symbol.replace('.', '-')) ??
      (await this.ciks()).get(symbol);
    if (!cik) return []; // ETFs and funds aren't in the company list
    const body = (await this.get(SUBMISSIONS(cik))) as Submissions;
    const r = body.filings?.recent;
    const list: Filing[] = (r?.form ?? []).slice(0, 100).map((form, i) => ({
      form,
      items: (r?.items[i] ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      acceptedAt: new Date(r?.acceptanceDateTime[i] ?? 0),
      url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${(r?.accessionNumber[i] ?? '').replaceAll('-', '')}/${r?.primaryDocument[i] ?? ''}`,
    }));
    this.filings.set(symbol, { at: Date.now(), list });
    return list;
  }

  private async ciks(): Promise<Map<string, string>> {
    if (this.tickers && Date.now() - this.tickers.at < TICKERS_MS)
      return this.tickers.cik;
    const body = (await this.get(TICKERS)) as Record<
      string,
      { cik_str: number; ticker: string }
    >;
    const cik = new Map(
      Object.values(body).map((c) => [
        c.ticker.toUpperCase(),
        String(c.cik_str),
      ]),
    );
    this.tickers = { at: Date.now(), cik };
    return cik;
  }

  private async get(url: string): Promise<unknown> {
    const res = await fetch(url, {
      headers: { 'User-Agent': this.agent, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
}
