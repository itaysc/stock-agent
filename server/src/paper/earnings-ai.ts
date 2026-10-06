import type { LlmService } from '../llm/llm.service.js';
import { NEWS_CHECK_LLM } from '../llm/llm.presets.js';
import type { EarningsResult, Headline } from './deployment-events.js';

export const EARNINGS_CHECK_SYSTEM_PROMPT = `You read a company's latest quarterly earnings report for an automated trading system (paper trading) that follows fixed, tested rules. You get the reported vs expected earnings per share (when known) and the headlines around the report. Decide one thing: is the report clearly bad, so the system should not hold or buy the stock now?

Clearly bad: earnings or revenue clearly below what analysts expected, or the company lowered its forecast (guidance) for the coming quarter or year, or it withdrew its forecast. Mixed reports (a beat on one number and a small miss on another, forecast kept) are NOT clearly bad. A beat, results in line, or a raised forecast are fine. If unsure, it is not clearly bad.

You do not predict prices and never give investment advice. Respond with JSON only: {"avoid": true|false, "reason": "one short sentence: beat or miss, and what happened to the forecast"}`;

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

/** The numbers in one line, e.g. "EPS 1.23 vs 1.10 expected (+11.8%)". */
export function earningsLine(r: EarningsResult | null): string {
  if (!r) return 'the reported numbers are not known yet';
  const eps =
    r.reportedEps !== null && r.estimatedEps !== null
      ? `EPS ${r.reportedEps} vs ${r.estimatedEps} expected`
      : 'EPS unknown';
  return `${eps}${r.surprisePct !== null ? ` (${pct(r.surprisePct)})` : ''}`;
}

/** The AI's reading of an earnings report: clearly bad (avoid) or not, with a short reason. */
export async function aiEarningsCheck(
  llm: LlmService,
  symbol: string,
  result: EarningsResult | null,
  headlines: Headline[],
): Promise<{ avoid: boolean; reason: string } | null> {
  if (!llm.isConfigured() || (!result && headlines.length === 0)) return null;
  const lines = headlines
    .slice(0, 30)
    .map(
      (h) =>
        `- ${new Date(h.createdAt).toISOString().slice(0, 16).replace('T', ' ')} UTC: ${h.headline}`,
    );
  try {
    const { data } = await llm.askJson<{ avoid?: unknown; reason?: unknown }>({
      ...NEWS_CHECK_LLM,
      systemMsg: EARNINGS_CHECK_SYSTEM_PROMPT,
      prompt: `Symbol: ${symbol}\nReport date: ${result?.date ?? 'unknown'}\nNumbers: ${earningsLine(result)}\nHeadlines (newest first):\n${lines.join('\n') || '(none)'}`,
    });
    return {
      avoid: data.avoid === true,
      reason:
        typeof data.reason === 'string'
          ? data.reason.slice(0, 300)
          : 'no reason given',
    };
  } catch {
    return null;
  }
}
