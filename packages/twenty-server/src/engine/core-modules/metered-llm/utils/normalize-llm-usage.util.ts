/* @license Enterprise */

import { type TokenUsageInput } from 'src/engine/metadata-modules/ai/ai-billing/utils/compute-cost-breakdown.util';

type OpenAiChatUsage =
  | {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number } | null;
      completion_tokens_details?: { reasoning_tokens?: number } | null;
    }
  | null
  | undefined;

type OpenAiResponsesUsage =
  | {
      input_tokens?: number;
      output_tokens?: number;
      input_tokens_details?: { cached_tokens?: number } | null;
      output_tokens_details?: { reasoning_tokens?: number } | null;
    }
  | null
  | undefined;

type AnthropicUsage =
  | {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number | null;
      cache_creation_input_tokens?: number | null;
    }
  | null
  | undefined;

// OpenAI reports prompt tokens including cached ones, which is what the
// shared cost breakdown expects.
export const normalizeOpenAiChatUsage = (
  usage: OpenAiChatUsage,
): TokenUsageInput => ({
  inputTokens: usage?.prompt_tokens ?? 0,
  outputTokens: usage?.completion_tokens ?? 0,
  cachedInputTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
  reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
});

export const normalizeOpenAiResponsesUsage = (
  usage: OpenAiResponsesUsage,
): TokenUsageInput => ({
  inputTokens: usage?.input_tokens ?? 0,
  outputTokens: usage?.output_tokens ?? 0,
  cachedInputTokens: usage?.input_tokens_details?.cached_tokens ?? 0,
  reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? 0,
});

// Anthropic reports input tokens EXCLUDING cache reads and cache writes, while
// the shared cost breakdown expects the full prompt size, so add them back.
export const normalizeAnthropicUsage = (
  usage: AnthropicUsage,
): TokenUsageInput => {
  const cacheReadTokens = usage?.cache_read_input_tokens ?? 0;
  const cacheCreationTokens = usage?.cache_creation_input_tokens ?? 0;

  return {
    inputTokens:
      (usage?.input_tokens ?? 0) + cacheReadTokens + cacheCreationTokens,
    outputTokens: usage?.output_tokens ?? 0,
    cachedInputTokens: cacheReadTokens,
    cacheCreationTokens,
  };
};

export const countTotalTokens = (usage: TokenUsageInput): number =>
  (usage.inputTokens ?? 0) +
  (usage.outputTokens ?? 0) +
  (usage.cacheCreationTokens ?? 0);

// Responses API results list each web search the model ran as an output item
export const countResponsesWebSearchCalls = (
  output: ReadonlyArray<{ type?: string }> | null | undefined,
): number =>
  (output ?? []).filter((item) => item.type === 'web_search_call').length;

// Dated snapshots such as gpt-4o-mini-2024-07-18 are priced as their base model
export const stripModelSnapshotSuffix = (model: string): string =>
  model.replace(/-\d{4}-\d{2}-\d{2}$/, '').replace(/-\d{8}$/, '');
