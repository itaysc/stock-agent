import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type OpenAI from 'openai';
import type { Env } from '../../config/env.js';
import { OPENAI_CLIENT } from '../llm.constants.js';
import {
  LLMIntegration,
  type LLMAskParams,
  type LLMIntegrationInterface,
  type LLMResponse,
} from '../llm.types.js';

/** OpenAI chat completions, ported from foozool-initiatives' OpenAIIntegration. */
@Injectable()
export class OpenAIIntegration implements LLMIntegrationInterface {
  readonly integration = LLMIntegration.OPENAI;
  private readonly defaultModel: string;

  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI | null,
    config: ConfigService<Env, true>,
  ) {
    this.defaultModel = config.get('OPENAI_MODEL', { infer: true });
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async ask(params: LLMAskParams): Promise<LLMResponse> {
    if (!this.client) throw new Error('OPENAI_API_KEY is not configured');

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (params.systemMsg) {
      messages.push({ role: 'system', content: params.systemMsg });
    }
    messages.push({ role: 'user', content: params.prompt });

    const response = await this.client.chat.completions.create({
      model: params.model ?? this.defaultModel,
      messages,
      max_completion_tokens: params.maxTokens ?? 300,
      ...(params.temperature !== undefined
        ? { temperature: params.temperature }
        : {}),
      ...(params.reasoningEffort
        ? { reasoning_effort: params.reasoningEffort }
        : {}),
      ...(params.responseFormat === 'json'
        ? { response_format: { type: 'json_object' as const } }
        : {}),
    });

    const choice = response.choices[0];
    return {
      data: choice?.message?.content?.trim() || null,
      model: response.model,
      isOutOfTokens: choice?.finish_reason === 'length',
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      provider: LLMIntegration.OPENAI,
    };
  }
}
