import type { LlmService } from '../llm/llm.service.js';
import { NEWS_CHECK_LLM } from '../llm/llm.presets.js';

/** The AI's short read of a stock's recent news. */
export interface NewsSummary {
  symbol: string;
  summary: string;
  good: string[];
  bad: string[];
  mood: 'positive' | 'mixed' | 'negative' | 'quiet';
  headlines: number;
  from: string;
}

export const NEWS_SUMMARY_SYSTEM_PROMPT = `You summarize a stock's recent news headlines for a private investor, in plain, short English. Say what happened (results, products, deals, lawsuits, analyst moves, industry events), what looks good and what looks worrying for the company. Group repeated stories. Don't predict the price, don't say whether to buy or sell, and don't give investment advice. Respond with JSON only: {"summary": "2-4 sentences", "good": ["up to 4 short points"], "bad": ["up to 4 short points"], "mood": "positive" | "mixed" | "negative" | "quiet"}`;

const asList = (x: unknown) =>
  Array.isArray(x)
    ? x.filter((s): s is string => typeof s === 'string').slice(0, 4)
    : [];

/** The headlines (newest first, with their short summaries when there are any) read by the AI. */
export async function summarizeNews(
  llm: LlmService,
  symbol: string,
  news: Array<{ headline: string; summary?: string; createdAt: Date }>,
  from: Date,
): Promise<NewsSummary> {
  const base = { symbol, headlines: news.length, from: from.toISOString() };
  if (!news.length)
    return {
      ...base,
      summary: 'No news about it in this period.',
      good: [],
      bad: [],
      mood: 'quiet',
    };
  const lines = news.slice(0, 40).map((n) => {
    const day = new Date(n.createdAt).toISOString().slice(0, 10);
    const more = n.summary ? ` (${n.summary.slice(0, 200)})` : '';
    return `- ${day}: ${n.headline}${more}`;
  });
  const { data } = await llm.askJson<Record<string, unknown>>({
    ...NEWS_CHECK_LLM,
    systemMsg: NEWS_SUMMARY_SYSTEM_PROMPT,
    prompt: `Stock: ${symbol}\nHeadlines since ${base.from.slice(0, 10)} (newest first):\n${lines.join('\n')}`,
  });
  const mood = ['positive', 'mixed', 'negative', 'quiet'].includes(
    String(data.mood),
  )
    ? (data.mood as NewsSummary['mood'])
    : 'mixed';
  return {
    ...base,
    summary:
      typeof data.summary === 'string'
        ? data.summary.slice(0, 800)
        : 'No summary.',
    good: asList(data.good),
    bad: asList(data.bad),
    mood,
  };
}
