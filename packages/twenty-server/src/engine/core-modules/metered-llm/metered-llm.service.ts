/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';

import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';
import type { Uploadable } from 'openai/uploads';

import { CreditsService } from 'src/engine/core-modules/billing/services/credits.service';
import { TRANSCRIPTION_COST_PER_MINUTE_USD } from 'src/engine/core-modules/metered-llm/constants/transcription-cost-per-minute.const';
import {
  MeteredLlmException,
  MeteredLlmExceptionCode,
} from 'src/engine/core-modules/metered-llm/metered-llm.exception';
import { type MeteringContext } from 'src/engine/core-modules/metered-llm/types/metered-llm.types';
import {
  countResponsesWebSearchCalls,
  countTotalTokens,
  normalizeAnthropicUsage,
  normalizeOpenAiChatUsage,
  normalizeOpenAiResponsesUsage,
  stripModelSnapshotSuffix,
} from 'src/engine/core-modules/metered-llm/utils/normalize-llm-usage.util';
import { NATIVE_WEB_SEARCH_COST_PER_CALL_DOLLARS } from 'src/engine/metadata-modules/ai/ai-billing/constants/native-web-search-cost-per-call-dollars';
import {
  computeCostBreakdown,
  type TokenUsageInput,
} from 'src/engine/metadata-modules/ai/ai-billing/utils/compute-cost-breakdown.util';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';
import { type AiModelConfig } from 'src/engine/metadata-modules/ai/ai-models/types/ai-model-config.type';

type LlmProvider = 'openai' | 'anthropic';

type ChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParamsNonStreaming;
type ChatCompletionStreamParams = Omit<
  OpenAI.Chat.ChatCompletionCreateParamsStreaming,
  'stream' | 'stream_options'
>;
type ResponseParams = OpenAI.Responses.ResponseCreateParamsNonStreaming;
type AnthropicMessageParams = Anthropic.MessageCreateParamsNonStreaming;
type AnthropicStreamParams = Anthropic.MessageStreamParams;

// Every LLM call in the product goes through this service. It checks the
// workspace can afford the call, makes it, and records what it cost. A call
// to a model with no price is refused rather than billed at zero.
@Injectable()
export class MeteredLlmService {
  private readonly logger = new Logger(MeteredLlmService.name);

  constructor(
    private readonly creditsService: CreditsService,
    private readonly aiModelRegistryService: AiModelRegistryService,
  ) {}

  async assertCanSpend(context: MeteringContext): Promise<void> {
    await this.creditsService.assertCanSpend({
      workspaceId: context.workspaceId,
      feature: context.feature,
      treatment: this.getTreatmentOverride(context),
    });
  }

  async openAiChatCompletion(
    context: MeteringContext,
    client: OpenAI,
    params: ChatCompletionParams,
    options?: OpenAI.RequestOptions,
  ): Promise<OpenAI.Chat.ChatCompletion> {
    const pricing = this.resolvePricedModel(context, 'openai', params.model);

    await this.assertCanSpend(context);

    const completion = await client.chat.completions.create(params, options);

    await this.billTokens({
      context,
      pricing,
      provider: 'openai',
      usage: normalizeOpenAiChatUsage(completion.usage),
    });

    return completion;
  }

  // Yields the provider chunks unchanged. Usage arrives in the final chunk, so
  // stream_options.include_usage is always set. The charge is recorded when the
  // consumer finishes or stops reading.
  async *openAiChatCompletionStream(
    context: MeteringContext,
    client: OpenAI,
    params: ChatCompletionStreamParams,
    options?: OpenAI.RequestOptions,
  ): AsyncGenerator<OpenAI.Chat.ChatCompletionChunk> {
    const pricing = this.resolvePricedModel(context, 'openai', params.model);

    await this.assertCanSpend(context);

    const stream = await client.chat.completions.create(
      { ...params, stream: true, stream_options: { include_usage: true } },
      options,
    );

    let usage: OpenAI.CompletionUsage | null | undefined;

    try {
      for await (const chunk of stream) {
        if (chunk.usage) {
          usage = chunk.usage;
        }

        yield chunk;
      }
    } finally {
      if (!usage) {
        this.logger.warn(
          `Stream for ${pricing.modelId} ended without usage (workspace ${context.workspaceId}, feature ${context.feature}); nothing was billed`,
        );
      } else {
        await this.billTokens({
          context,
          pricing,
          provider: 'openai',
          usage: normalizeOpenAiChatUsage(usage),
        });
      }
    }
  }

  async openAiResponse(
    context: MeteringContext,
    client: OpenAI,
    params: ResponseParams,
    options?: OpenAI.RequestOptions,
  ): Promise<OpenAI.Responses.Response> {
    const pricing = this.resolvePricedModel(
      context,
      'openai',
      String(params.model),
    );

    await this.assertCanSpend(context);

    const response = await client.responses.create(params, options);

    await this.billTokens({
      context,
      pricing,
      provider: 'openai',
      usage: normalizeOpenAiResponsesUsage(response.usage),
      extraCostUsd:
        countResponsesWebSearchCalls(response.output) *
        NATIVE_WEB_SEARCH_COST_PER_CALL_DOLLARS,
    });

    return response;
  }

  async openAiTranscription(
    context: MeteringContext,
    client: OpenAI,
    params: {
      file: Uploadable;
      model: string;
      language?: string;
      prompt?: string;
      // Used only when the provider does not report the audio length
      durationSecondsHint?: number;
    },
  ): Promise<{ text: string; durationSeconds: number | null }> {
    const costPerMinuteUsd = TRANSCRIPTION_COST_PER_MINUTE_USD[params.model];

    if (costPerMinuteUsd === undefined) {
      throw new MeteredLlmException(
        `No transcription price configured for model ${params.model}`,
        MeteredLlmExceptionCode.UNPRICED_MODEL,
      );
    }

    await this.assertCanSpend(context);

    const { durationSecondsHint, ...request } = params;

    // Only whisper-1 can return the audio duration in its response
    const result = (await client.audio.transcriptions.create({
      ...request,
      response_format: params.model === 'whisper-1' ? 'verbose_json' : 'json',
    })) as { text: string; duration?: number; usage?: { seconds?: number } };

    const durationSeconds =
      result.duration ?? result.usage?.seconds ?? durationSecondsHint ?? null;

    if (durationSeconds === null) {
      // The transcript is already paid for, so keep it and make the gap loud
      this.logger.error(
        `Transcription by ${params.model} gave no duration (workspace ${context.workspaceId}, feature ${context.feature}); nothing was billed`,
      );

      return { text: result.text, durationSeconds: null };
    }

    const minutes = durationSeconds / 60;

    await this.recordUsage({
      context,
      quantity: Math.max(1, Math.ceil(minutes)),
      providerCostUsd: minutes * costPerMinuteUsd,
      resourceContext: params.model,
      metadata: { provider: 'openai', durationSeconds },
    });

    return { text: result.text, durationSeconds };
  }

  async anthropicMessage(
    context: MeteringContext,
    client: Anthropic,
    params: AnthropicMessageParams,
    options?: Anthropic.RequestOptions,
  ): Promise<Anthropic.Message> {
    const pricing = this.resolvePricedModel(context, 'anthropic', params.model);

    await this.assertCanSpend(context);

    const message = await client.messages.create(params, options);

    await this.billTokens({
      context,
      pricing,
      provider: 'anthropic',
      usage: normalizeAnthropicUsage(message.usage),
    });

    return message;
  }

  // Returns the SDK stream untouched; the charge is recorded once the final
  // message is available.
  async anthropicMessageStream(
    context: MeteringContext,
    client: Anthropic,
    params: AnthropicStreamParams,
    options?: Anthropic.RequestOptions,
  ) {
    const pricing = this.resolvePricedModel(context, 'anthropic', params.model);

    await this.assertCanSpend(context);

    const stream = client.messages.stream(params, options);

    stream
      .finalMessage()
      .then((message) =>
        this.billTokens({
          context,
          pricing,
          provider: 'anthropic',
          usage: normalizeAnthropicUsage(message.usage),
        }),
      )
      .catch((error: unknown) => {
        this.logger.error(
          `Anthropic stream for ${pricing.modelId} failed before usage was known (workspace ${context.workspaceId}, feature ${context.feature}); nothing was billed`,
          error,
        );
      });

    return stream;
  }

  private getTreatmentOverride(context: MeteringContext) {
    return context.keySource === 'workspace' ? ('SYSTEM' as const) : undefined;
  }

  // The registry hands back a zero-priced config for models it knows about but
  // has no prices for, which would bill every call at $0, so treat that as
  // unpriced too.
  //
  // A call on the customer's own key is never charged in credits, so an
  // unpriced model must not stop it. It is recorded as unpriced instead.
  private resolvePricedModel(
    context: MeteringContext,
    provider: LlmProvider,
    model: string,
  ): AiModelConfig {
    const candidateModelIds = [
      `${provider}/${model}`,
      `${provider}/${stripModelSnapshotSuffix(model)}`,
    ];

    for (const modelId of candidateModelIds) {
      try {
        const config =
          this.aiModelRegistryService.getEffectiveModelConfig(modelId);

        if (
          config.inputCostPerMillionTokens > 0 ||
          config.outputCostPerMillionTokens > 0
        ) {
          return config;
        }
      } catch {
        // Not registered under this id; try the next candidate
      }
    }

    if (context.keySource === 'workspace') {
      return {
        modelId: `${provider}/${model}`,
        isUnpriced: true,
        inputCostPerMillionTokens: 0,
        outputCostPerMillionTokens: 0,
      } as AiModelConfig & { isUnpriced: boolean };
    }

    throw new MeteredLlmException(
      `No price configured for ${provider} model ${model}; add it to ai-providers.json before using it`,
      MeteredLlmExceptionCode.UNPRICED_MODEL,
    );
  }

  private async billTokens({
    context,
    pricing,
    provider,
    usage,
    extraCostUsd = 0,
  }: {
    context: MeteringContext;
    pricing: AiModelConfig;
    provider: LlmProvider;
    usage: TokenUsageInput;
    extraCostUsd?: number;
  }): Promise<void> {
    const breakdown = computeCostBreakdown(pricing, usage);

    await this.recordUsage({
      context,
      quantity: countTotalTokens(usage),
      providerCostUsd: breakdown.totalCostInDollars + extraCostUsd,
      resourceContext: pricing.modelId,
      metadata: {
        provider,
        ...('isUnpriced' in pricing ? { unpriced: true } : {}),
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        cachedInputTokens: usage.cachedInputTokens ?? 0,
        reasoningTokens: usage.reasoningTokens ?? 0,
      },
    });
  }

  // The provider call has already happened and cannot be undone, so a failure
  // to record it is logged with everything needed to replay it, not thrown.
  private async recordUsage({
    context,
    quantity,
    providerCostUsd,
    resourceContext,
    metadata,
  }: {
    context: MeteringContext;
    quantity: number;
    providerCostUsd: number;
    resourceContext: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.creditsService.record({
        workspaceId: context.workspaceId,
        feature: context.feature,
        quantity,
        providerCostUsd,
        userWorkspaceId: context.userWorkspaceId,
        resourceId: context.resourceId,
        resourceContext,
        treatment: this.getTreatmentOverride(context),
        metadata: context.keySource
          ? { ...metadata, keySource: context.keySource }
          : metadata,
      });
    } catch (error) {
      this.logger.error(
        `Failed to record LLM usage. payload=${JSON.stringify({
          workspaceId: context.workspaceId,
          feature: context.feature,
          quantity,
          providerCostUsd,
          resourceContext,
          metadata,
        })}`,
        error,
      );
    }
  }
}
