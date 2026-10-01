import type { ConfigService } from '@nestjs/config';
import type OpenAI from 'openai';
import type { Env } from '../config/env.js';
import { BACKTEST_SUMMARY_LLM } from './llm.presets.js';
import { LlmService } from './llm.service.js';
import { OpenAIIntegration } from './providers/openai.integration.js';

const config = {
  get: () => 'gpt-5.6-luna',
} as unknown as ConfigService<Env, true>;

function setup(content: string | null = '{"ok":true}', finish = 'stop') {
  const create = vi.fn(async () => ({
    model: 'gpt-4o-mini-2024-07-18',
    choices: [{ message: { content }, finish_reason: finish }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  }));
  const client = { chat: { completions: { create } } } as unknown as OpenAI;
  const llm = new LlmService(new OpenAIIntegration(client, config));
  return { llm, create };
}

describe('LlmService (OpenAI)', () => {
  it('sends system + user messages with the preset limits', async () => {
    const { llm, create } = setup();
    const res = await llm.ask({
      ...BACKTEST_SUMMARY_LLM,
      systemMsg: 'sys',
      prompt: 'hi',
    });

    expect(create).toHaveBeenCalledWith({
      model: 'gpt-5.6-luna',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
      ],
      max_completion_tokens: 4_000,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
    });
    expect(res).toMatchObject({
      data: '{"ok":true}',
      model: 'gpt-4o-mini-2024-07-18',
      isOutOfTokens: false,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
  });

  it('omits temperature and reasoning effort unless set', async () => {
    const { llm, create } = setup();
    await llm.ask({
      prompt: 'hi',
      maxTokens: 50,
      model: 'some-reasoning-model',
    });
    const [[body]] = create.mock.calls as unknown as [
      [Record<string, unknown>],
    ];
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('response_format');
    expect(body).not.toHaveProperty('reasoning_effort');
    expect(body.model).toBe('some-reasoning-model');
  });

  it('parses JSON answers, even inside code fences', async () => {
    const { llm } = setup('```json\n{"headline": "ok", "points": ["a",]}\n```');
    const { data } = await llm.askJson<{ headline: string; points: string[] }>({
      prompt: 'x',
    });
    expect(data).toEqual({ headline: 'ok', points: ['a'] });
  });

  it('rejects empty or cut-off answers', async () => {
    await expect(setup(null).llm.askJson({ prompt: 'x' })).rejects.toThrow(
      /empty/,
    );
    await expect(
      setup('{"a":', 'length').llm.askJson({ prompt: 'x' }),
    ).rejects.toThrow(/cut off/);
  });

  it('reports whether a key is configured', async () => {
    const off = new LlmService(new OpenAIIntegration(null, config));
    expect(off.isConfigured()).toBe(false);
    await expect(off.ask({ prompt: 'x' })).rejects.toThrow(/OPENAI_API_KEY/);
    expect(setup().llm.isConfigured()).toBe(true);
  });
});
