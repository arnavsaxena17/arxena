import { Logger } from '@nestjs/common';

import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';

import { type CreditsService } from 'src/engine/core-modules/billing/services/credits.service';
import { MeteredLlmExceptionCode } from 'src/engine/core-modules/metered-llm/metered-llm.exception';
import { MeteredLlmService } from 'src/engine/core-modules/metered-llm/metered-llm.service';
import { type MeteringContext } from 'src/engine/core-modules/metered-llm/types/metered-llm.types';
import { type AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';
import { type AiModelConfig } from 'src/engine/metadata-modules/ai/ai-models/types/ai-model-config.type';
import { ModelFamily } from 'src/engine/metadata-modules/ai/ai-models/types/model-family.enum';

const CONTEXT: MeteringContext = {
  workspaceId: 'ws-1',
  feature: 'AI_BACKGROUND',
  userWorkspaceId: 'uw-1',
};

const buildModel = (
  overrides: Partial<AiModelConfig> & { modelId: string },
): AiModelConfig =>
  ({
    sdkPackage: '@ai-sdk/openai',
    label: overrides.modelId,
    description: '',
    modelFamily: ModelFamily.GPT,
    inputCostPerMillionTokens: 0.15,
    outputCostPerMillionTokens: 0.6,
    cachedInputCostPerMillionTokens: 0.075,
    contextWindowTokens: 128000,
    maxOutputTokens: 16000,
    ...overrides,
  }) as AiModelConfig;

const MODELS: Record<string, AiModelConfig> = {
  'openai/gpt-4o-mini': buildModel({ modelId: 'openai/gpt-4o-mini' }),
  'openai/zero-priced': buildModel({
    modelId: 'openai/zero-priced',
    inputCostPerMillionTokens: 0,
    outputCostPerMillionTokens: 0,
  }),
  'anthropic/claude-sonnet-4-5': buildModel({
    modelId: 'anthropic/claude-sonnet-4-5',
    modelFamily: ModelFamily.CLAUDE,
    inputCostPerMillionTokens: 3,
    outputCostPerMillionTokens: 15,
    cachedInputCostPerMillionTokens: 0.3,
    cacheCreationCostPerMillionTokens: 3.75,
  }),
};

async function* toAsyncIterable<TItem>(items: TItem[]) {
  for (const item of items) {
    yield item;
  }
}

describe('MeteredLlmService', () => {
  let service: MeteredLlmService;
  let record: jest.Mock;
  let assertCanSpend: jest.Mock;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    record = jest.fn().mockResolvedValue({ recorded: true });
    assertCanSpend = jest.fn().mockResolvedValue(undefined);

    service = new MeteredLlmService(
      { record, assertCanSpend } as unknown as CreditsService,
      {
        getEffectiveModelConfig: (modelId: string) => {
          const config = MODELS[modelId];

          if (!config) {
            throw new Error(`Model with ID ${modelId} not found`);
          }

          return config;
        },
      } as unknown as AiModelRegistryService,
    );
  });

  describe('openAiChatCompletion', () => {
    const buildClient = (completion: unknown) => {
      const create = jest.fn().mockResolvedValue(completion);

      return {
        client: { chat: { completions: { create } } } as unknown as OpenAI,
        create,
      };
    };

    it('should return the completion untouched and bill tokens at the model price', async () => {
      const completion = {
        model: 'gpt-4o-mini',
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      };
      const { client, create } = buildClient(completion);

      const result = await service.openAiChatCompletion(CONTEXT, client, {
        model: 'gpt-4o-mini',
        messages: [],
      });

      expect(result).toBe(completion);
      expect(create).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          feature: 'AI_BACKGROUND',
          quantity: 1500,
          userWorkspaceId: 'uw-1',
          resourceContext: 'openai/gpt-4o-mini',
        }),
      );
      // 1000 x $0.15/M + 500 x $0.60/M
      expect(record.mock.calls[0][0].providerCostUsd).toBeCloseTo(0.00045, 8);
    });

    it('should charge cached tokens at the cached rate', async () => {
      const { client } = buildClient({
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 0,
          prompt_tokens_details: { cached_tokens: 1000 },
        },
      });

      await service.openAiChatCompletion(CONTEXT, client, {
        model: 'gpt-4o-mini',
        messages: [],
      });

      // 1000 x $0.075/M
      expect(record.mock.calls[0][0].providerCostUsd).toBeCloseTo(0.000075, 8);
    });

    it('should price a dated snapshot as its base model', async () => {
      const { client } = buildClient({
        usage: { prompt_tokens: 10, completion_tokens: 10 },
      });

      await service.openAiChatCompletion(CONTEXT, client, {
        model: 'gpt-4o-mini-2024-07-18',
        messages: [],
      });

      expect(record).toHaveBeenCalledTimes(1);
    });

    it('should record a call on the workspace own key as SYSTEM and skip the credit check', async () => {
      const { client } = buildClient({
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });

      await service.openAiChatCompletion(
        { ...CONTEXT, keySource: 'workspace' },
        client,
        { model: 'gpt-4o-mini', messages: [] },
      );

      expect(assertCanSpend).toHaveBeenCalledWith(
        expect.objectContaining({ treatment: 'SYSTEM' }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          treatment: 'SYSTEM',
          metadata: expect.objectContaining({ keySource: 'workspace' }),
        }),
      );
    });

    it('should not refuse an unpriced model on the workspace own key, and flag it', async () => {
      const { client, create } = buildClient({
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });

      await service.openAiChatCompletion(
        { ...CONTEXT, keySource: 'workspace' },
        client,
        { model: 'gpt-3.5-turbo', messages: [] },
      );

      expect(create).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          treatment: 'SYSTEM',
          providerCostUsd: 0,
          metadata: expect.objectContaining({ unpriced: true }),
        }),
      );
    });

    it('should leave the treatment to the workspace policy for platform-key calls', async () => {
      const { client } = buildClient({
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });

      await service.openAiChatCompletion(
        { ...CONTEXT, keySource: 'platform' },
        client,
        { model: 'gpt-4o-mini', messages: [] },
      );

      expect(record.mock.calls[0][0].treatment).toBeUndefined();
    });

    it('should refuse an unknown model before calling the provider', async () => {
      const { client, create } = buildClient({});

      await expect(
        service.openAiChatCompletion(CONTEXT, client, {
          model: 'gpt-made-up',
          messages: [],
        }),
      ).rejects.toMatchObject({ code: MeteredLlmExceptionCode.UNPRICED_MODEL });
      expect(create).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    });

    it('should refuse a model that is registered with zero prices', async () => {
      const { client, create } = buildClient({});

      await expect(
        service.openAiChatCompletion(CONTEXT, client, {
          model: 'zero-priced',
          messages: [],
        }),
      ).rejects.toMatchObject({ code: MeteredLlmExceptionCode.UNPRICED_MODEL });
      expect(create).not.toHaveBeenCalled();
    });

    it('should not call the provider when the workspace is out of credits', async () => {
      assertCanSpend.mockRejectedValue(new Error('Credits exhausted'));
      const { client, create } = buildClient({});

      await expect(
        service.openAiChatCompletion(CONTEXT, client, {
          model: 'gpt-4o-mini',
          messages: [],
        }),
      ).rejects.toThrow('Credits exhausted');
      expect(create).not.toHaveBeenCalled();
    });

    it('should still return the completion when recording the usage fails', async () => {
      record.mockRejectedValue(new Error('redis down'));
      const completion = { usage: { prompt_tokens: 1, completion_tokens: 1 } };
      const { client } = buildClient(completion);

      await expect(
        service.openAiChatCompletion(CONTEXT, client, {
          model: 'gpt-4o-mini',
          messages: [],
        }),
      ).resolves.toBe(completion);
    });
  });

  describe('openAiChatCompletionStream', () => {
    it('should yield every chunk, force usage reporting, and bill from the final chunk', async () => {
      const create = jest.fn().mockResolvedValue(
        toAsyncIterable([
          { choices: [{ delta: { content: 'a' } }] },
          {
            choices: [],
            usage: { prompt_tokens: 100, completion_tokens: 50 },
          },
        ]),
      );
      const client = {
        chat: { completions: { create } },
      } as unknown as OpenAI;

      const chunks: unknown[] = [];

      for await (const chunk of service.openAiChatCompletionStream(
        CONTEXT,
        client,
        { model: 'gpt-4o-mini', messages: [] },
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
          stream_options: { include_usage: true },
        }),
        undefined,
      );
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 150 }),
      );
    });

    it('should bill what was reported when the consumer stops reading early', async () => {
      const create = jest
        .fn()
        .mockResolvedValue(
          toAsyncIterable([
            { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5 } },
            { choices: [{ delta: { content: 'never read' } }] },
          ]),
        );
      const client = {
        chat: { completions: { create } },
      } as unknown as OpenAI;

      for await (const _chunk of service.openAiChatCompletionStream(
        CONTEXT,
        client,
        { model: 'gpt-4o-mini', messages: [] },
      )) {
        break;
      }

      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 15 }),
      );
    });

    it('should warn and bill nothing when the stream never reports usage', async () => {
      const create = jest
        .fn()
        .mockResolvedValue(toAsyncIterable([{ choices: [] }]));
      const client = {
        chat: { completions: { create } },
      } as unknown as OpenAI;
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      for await (const _chunk of service.openAiChatCompletionStream(
        CONTEXT,
        client,
        { model: 'gpt-4o-mini', messages: [] },
      )) {
        // drain
      }

      expect(record).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('openAiResponse', () => {
    it('should add the per-call fee for each web search the model ran', async () => {
      const create = jest.fn().mockResolvedValue({
        usage: { input_tokens: 0, output_tokens: 0 },
        output: [{ type: 'web_search_call' }, { type: 'web_search_call' }],
      });
      const client = { responses: { create } } as unknown as OpenAI;

      await service.openAiResponse(CONTEXT, client, {
        model: 'gpt-4o-mini',
        input: 'hi',
      });

      expect(record.mock.calls[0][0].providerCostUsd).toBeCloseTo(0.02, 8);
    });
  });

  describe('openAiTranscription', () => {
    const buildClient = (result: unknown) => {
      const create = jest.fn().mockResolvedValue(result);

      return {
        client: { audio: { transcriptions: { create } } } as unknown as OpenAI,
        create,
      };
    };

    it('should bill whisper-1 by the reported audio duration', async () => {
      const { client, create } = buildClient({ text: 'hello', duration: 90 });

      const result = await service.openAiTranscription(
        { ...CONTEXT, feature: 'AI_TRANSCRIPTION' },
        client,
        { file: {} as never, model: 'whisper-1' },
      );

      expect(result).toEqual({ text: 'hello', durationSeconds: 90 });
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ response_format: 'verbose_json' }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          feature: 'AI_TRANSCRIPTION',
          quantity: 2,
        }),
      );
      // 1.5 minutes x $0.006
      expect(record.mock.calls[0][0].providerCostUsd).toBeCloseTo(0.009, 8);
    });

    it('should fall back to the caller-supplied duration', async () => {
      const { client } = buildClient({ text: 'hello' });

      await service.openAiTranscription(CONTEXT, client, {
        file: {} as never,
        model: 'gpt-4o-mini-transcribe',
        durationSecondsHint: 60,
      });

      expect(record.mock.calls[0][0].providerCostUsd).toBeCloseTo(0.003, 8);
    });

    it('should keep the transcript and bill nothing when no duration is known', async () => {
      const { client } = buildClient({ text: 'hello' });

      const result = await service.openAiTranscription(CONTEXT, client, {
        file: {} as never,
        model: 'gpt-4o-transcribe',
      });

      expect(result).toEqual({ text: 'hello', durationSeconds: null });
      expect(record).not.toHaveBeenCalled();
    });

    it('should refuse a model with no transcription price before calling the provider', async () => {
      const { client, create } = buildClient({});

      await expect(
        service.openAiTranscription(CONTEXT, client, {
          file: {} as never,
          model: 'mystery-model',
        }),
      ).rejects.toMatchObject({ code: MeteredLlmExceptionCode.UNPRICED_MODEL });
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('anthropic', () => {
    it('should price cache reads and writes at their own rates', async () => {
      const create = jest.fn().mockResolvedValue({
        usage: {
          input_tokens: 1_000_000,
          output_tokens: 0,
          cache_read_input_tokens: 1_000_000,
          cache_creation_input_tokens: 1_000_000,
        },
      });
      const client = { messages: { create } } as unknown as Anthropic;

      await service.anthropicMessage(CONTEXT, client, {
        model: 'claude-sonnet-4-5',
        max_tokens: 10,
        messages: [],
      });

      // 1M uncached x $3 + 1M cache read x $0.30 + 1M cache write x $3.75
      expect(record.mock.calls[0][0].providerCostUsd).toBeCloseTo(7.05, 6);
    });

    it('should bill a stream from its final message', async () => {
      const finalMessage = jest
        .fn()
        .mockResolvedValue({ usage: { input_tokens: 100, output_tokens: 50 } });
      const stream = { finalMessage };
      const client = {
        messages: { stream: jest.fn().mockReturnValue(stream) },
      } as unknown as Anthropic;

      const result = await service.anthropicMessageStream(CONTEXT, client, {
        model: 'claude-sonnet-4-5',
        max_tokens: 10,
        messages: [],
      });
      await finalMessage.mock.results[0].value;
      // let the .then() chain that records the usage settle
      for (let tick = 0; tick < 5; tick++) {
        await Promise.resolve();
      }

      expect(result).toBe(stream);
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 150 }),
      );
    });

    it('should refuse an unpriced Claude model before opening the stream', async () => {
      const stream = jest.fn();
      const client = { messages: { stream } } as unknown as Anthropic;

      await expect(
        service.anthropicMessageStream(CONTEXT, client, {
          model: 'claude-not-listed',
          max_tokens: 10,
          messages: [],
        }),
      ).rejects.toMatchObject({ code: MeteredLlmExceptionCode.UNPRICED_MODEL });
      expect(stream).not.toHaveBeenCalled();
    });
  });
});
