import { LLMIntegration, type LlmPreset } from './llm.types.js';

// Default model: OPENAI_MODEL (gpt-5.6-luna, OpenAI's low-cost tier of its newest
// family). GPT-5-family models reject a custom temperature, so presets don't set one.

/** General-purpose chat (default preset for new features). */
export const GENERAL_LLM = {
  integration: LLMIntegration.OPENAI,
  maxTokens: 2_000,
  reasoningEffort: 'low',
} satisfies LlmPreset;

/** Short structured summary + research recommendation of a backtest or sweep. */
export const BACKTEST_SUMMARY_LLM = {
  integration: LLMIntegration.OPENAI,
  // Room for the answer (~300 tokens, ~800 with next tests) plus any reasoning tokens.
  maxTokens: 4_000,
  reasoningEffort: 'low',
  responseFormat: 'json',
} satisfies LlmPreset;

/** Research agent: reads every experiment so far and plans the next tests (JSON). */
export const RESEARCH_AGENT_LLM = {
  integration: LLMIntegration.OPENAI,
  // The prompt grows with the experiments; the answer (~1k tokens) needs real reasoning.
  maxTokens: 8_000,
  reasoningEffort: 'medium',
  responseFormat: 'json',
} satisfies LlmPreset;

/** Screening breaking headlines before a buy (or for a held position): a short JSON verdict. */
export const NEWS_CHECK_LLM = {
  integration: LLMIntegration.OPENAI,
  maxTokens: 1_500,
  reasoningEffort: 'low',
  responseFormat: 'json',
} satisfies LlmPreset;
