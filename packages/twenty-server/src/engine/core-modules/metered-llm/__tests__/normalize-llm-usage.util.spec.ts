import {
  countResponsesWebSearchCalls,
  countTotalTokens,
  normalizeAnthropicUsage,
  normalizeOpenAiChatUsage,
  normalizeOpenAiResponsesUsage,
  stripModelSnapshotSuffix,
} from 'src/engine/core-modules/metered-llm/utils/normalize-llm-usage.util';

describe('normalizeOpenAiChatUsage', () => {
  it('should map prompt, completion, cached and reasoning tokens', () => {
    expect(
      normalizeOpenAiChatUsage({
        prompt_tokens: 1000,
        completion_tokens: 400,
        prompt_tokens_details: { cached_tokens: 600 },
        completion_tokens_details: { reasoning_tokens: 100 },
      }),
    ).toEqual({
      inputTokens: 1000,
      outputTokens: 400,
      cachedInputTokens: 600,
      reasoningTokens: 100,
    });
  });

  it('should treat missing usage as zero tokens', () => {
    expect(normalizeOpenAiChatUsage(undefined)).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      reasoningTokens: 0,
    });
  });
});

describe('normalizeOpenAiResponsesUsage', () => {
  it('should map the Responses API field names', () => {
    expect(
      normalizeOpenAiResponsesUsage({
        input_tokens: 500,
        output_tokens: 200,
        input_tokens_details: { cached_tokens: 50 },
        output_tokens_details: { reasoning_tokens: 20 },
      }),
    ).toEqual({
      inputTokens: 500,
      outputTokens: 200,
      cachedInputTokens: 50,
      reasoningTokens: 20,
    });
  });
});

describe('normalizeAnthropicUsage', () => {
  it('should add cache reads and writes back into the input total', () => {
    expect(
      normalizeAnthropicUsage({
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 400,
        cache_creation_input_tokens: 300,
      }),
    ).toEqual({
      inputTokens: 800,
      outputTokens: 50,
      cachedInputTokens: 400,
      cacheCreationTokens: 300,
    });
  });

  it('should handle null cache fields', () => {
    expect(
      normalizeAnthropicUsage({
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: null,
        cache_creation_input_tokens: null,
      }).inputTokens,
    ).toBe(10);
  });
});

describe('countTotalTokens', () => {
  it('should sum input, output and cache creation tokens', () => {
    expect(
      countTotalTokens({
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 25,
      }),
    ).toBe(175);
  });
});

describe('countResponsesWebSearchCalls', () => {
  it('should count only web search output items', () => {
    expect(
      countResponsesWebSearchCalls([
        { type: 'web_search_call' },
        { type: 'message' },
        { type: 'web_search_call' },
      ]),
    ).toBe(2);
  });

  it('should return zero when there is no output', () => {
    expect(countResponsesWebSearchCalls(undefined)).toBe(0);
  });
});

describe('stripModelSnapshotSuffix', () => {
  it.each([
    ['gpt-4o-mini-2024-07-18', 'gpt-4o-mini'],
    ['claude-sonnet-4-20250514', 'claude-sonnet-4'],
    ['gpt-4o-mini', 'gpt-4o-mini'],
  ])('should turn %s into %s', (input, expected) => {
    expect(stripModelSnapshotSuffix(input)).toBe(expected);
  });
});
