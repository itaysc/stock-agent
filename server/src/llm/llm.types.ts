export enum LLMIntegration {
  OPENAI = 'openai',
}

export type LLMResponseFormat = 'text' | 'json';

/** Task preset: integration + generation limits (see llm.presets.ts). */
export interface LlmPreset {
  integration: LLMIntegration;
  /** Overrides OPENAI_MODEL for this task. */
  model?: string;
  maxTokens: number;
  /** Omit for models that only accept their default (e.g. the GPT-5 family). */
  temperature?: number;
  /** Thinking effort for reasoning models; reasoning tokens count toward maxTokens. */
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  responseFormat?: LLMResponseFormat;
}

export interface LLMAskParams extends Partial<LlmPreset> {
  prompt: string;
  systemMsg?: string;
}

export interface LLMResponse {
  data: string | null;
  model: string;
  /** True when the answer was cut off by the token limit. */
  isOutOfTokens: boolean;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: LLMIntegration;
}

export interface LLMIntegrationInterface {
  readonly integration: LLMIntegration;
  isConfigured(): boolean;
  ask(params: LLMAskParams): Promise<LLMResponse>;
}
