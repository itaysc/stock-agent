import { Injectable } from '@nestjs/common';
import {
  LLMIntegration,
  type LLMAskParams,
  type LLMIntegrationInterface,
  type LLMResponse,
} from './llm.types.js';
import { parseJsonFromLlm } from './parse-json.js';
import { OpenAIIntegration } from './providers/openai.integration.js';

/**
 * Routes LLM requests to the selected integration (ported from
 * foozool-initiatives' askLLM). Call sites pass a preset from llm.presets.ts.
 */
@Injectable()
export class LlmService {
  private readonly integrations: Map<LLMIntegration, LLMIntegrationInterface>;

  constructor(openai: OpenAIIntegration) {
    this.integrations = new Map([[openai.integration, openai]]);
  }

  isConfigured(integration = LLMIntegration.OPENAI): boolean {
    return this.integrations.get(integration)?.isConfigured() ?? false;
  }

  ask(params: LLMAskParams): Promise<LLMResponse> {
    const integration = params.integration ?? LLMIntegration.OPENAI;
    const client = this.integrations.get(integration);
    if (!client) throw new Error(`Unknown LLM integration: ${integration}`);
    return client.ask({ ...params, integration });
  }

  /** Asks for JSON and parses it (tolerates code fences and common JSON mistakes). */
  async askJson<T>(
    params: LLMAskParams,
  ): Promise<{ data: T; response: LLMResponse }> {
    const response = await this.ask({ ...params, responseFormat: 'json' });
    if (!response.data) throw new Error('LLM returned an empty response');
    if (response.isOutOfTokens) {
      throw new Error('LLM response was cut off (raise maxTokens)');
    }
    return { data: parseJsonFromLlm<T>(response.data), response };
  }
}
