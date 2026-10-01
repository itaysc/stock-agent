import type { LlmService } from '../llm/llm.service.js';
import { NEWS_CHECK_LLM } from '../llm/llm.presets.js';
import type { Headline } from './deployment-events.js';

export const NEWS_CHECK_SYSTEM_PROMPT = `You screen breaking news for an automated trading system (paper trading) that follows fixed, tested rules. It asks you one thing: does the news show a serious negative event for this company or fund that makes it unwise to buy it now (purpose "buy"), or to keep holding it (purpose "hold")?

Serious: fraud or accounting problems, bankruptcy or going-concern doubts, a trading halt, a delisting, a big lawsuit or regulatory action, a large guidance cut or earnings miss, the CEO or CFO leaving suddenly, a failed key product or trial, a large dilutive share offering, a major hack or outage. Routine news, analyst price-target changes, general market moves, rumours, and old news retold are NOT serious. If unsure, it is not serious.

You do not predict prices and never give investment advice. Respond with JSON only: {"avoid": true|false, "reason": "one short sentence naming the event, or why it is fine"}`;

export const MARKET_CHECK_SYSTEM_PROMPT = `You screen breaking news for an automated trading system (paper trading) about to buy, or holding, a broad fund (an index, sector, bond or commodity ETF). Only a market-wide emergency counts: a market-wide trading halt or circuit breaker, an emergency (unscheduled) central bank action, the outbreak of a war involving major economies, the failure of a major bank or a financial-system crisis, a sovereign default, or a sudden shock that shuts down a sector or the whole economy. Normal market moves, sell-offs, scheduled data and Fed meetings, earnings, politics, opinions and forecasts do NOT count. If unsure, it does not count.

You do not predict prices and never give investment advice. Respond with JSON only: {"avoid": true|false, "reason": "one short sentence naming the emergency, or why it is fine"}`;

/** The AI's reading of the latest headlines for a symbol (company events, or market-wide emergencies for a fund). */
export async function aiNewsCheck(
  llm: LlmService,
  symbol: string,
  headlines: Headline[],
  purpose: 'buy' | 'hold',
  mode: 'company' | 'market' = 'company',
): Promise<{ avoid: boolean; reason: string } | null> {
  if (!llm.isConfigured() || headlines.length === 0) return null;
  const lines = headlines
    .slice(0, 30)
    .map(
      (h) =>
        `- ${new Date(h.createdAt).toISOString().slice(0, 16).replace('T', ' ')} UTC: ${h.headline}`,
    );
  try {
    const { data } = await llm.askJson<{ avoid?: unknown; reason?: unknown }>({
      ...NEWS_CHECK_LLM,
      systemMsg:
        mode === 'market'
          ? MARKET_CHECK_SYSTEM_PROMPT
          : NEWS_CHECK_SYSTEM_PROMPT,
      prompt: `Symbol: ${symbol}\nPurpose: ${purpose}\nHeadlines (newest first):\n${lines.join('\n')}`,
    });
    return {
      avoid: data.avoid === true,
      reason:
        typeof data.reason === 'string'
          ? data.reason.slice(0, 300)
          : 'no reason given',
    };
  } catch {
    return null; // the word-list check still applies
  }
}
