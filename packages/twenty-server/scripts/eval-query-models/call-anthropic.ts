import Anthropic from '@anthropic-ai/sdk';

import type { PromptMode, SearchType } from './constants';
import type { AnySearchRequest } from './schemas';
import { getSearchTypeConfig, injectApiField } from './search-type-config';

export async function callAnthropic(
  client: Anthropic,
  modelId: string,
  requirement: string,
  searchType: SearchType,
  promptMode: PromptMode = 'detailed',
): Promise<{ requests: AnySearchRequest[]; raw: string; error?: string; inputTokens: number; outputTokens: number; cachedTokens: number }> {
  const { prompt, anthropicTool, noun } = getSearchTypeConfig(searchType, promptMode);
  const toolName = anthropicTool.name;
  try {
    const response = await client.messages.create({
      model: modelId,
      max_tokens: 4096,
      system: prompt,
      tools: [anthropicTool as Anthropic.Tool],
      tool_choice: { type: 'tool', name: toolName },
      messages: [{
        role: 'user',
        content: `REQUIREMENT:\n${requirement}\n\nGenerate coverage ${noun} queries — as many as needed to cover all distinct candidate archetypes (typically 2–4). Each query must target a different access path; collectively they should leave no relevant candidate pool uncovered.`,
      }],
    });
    const toolBlock = response.content.find(b => b.type === 'tool_use');
    if (toolBlock?.type !== 'tool_use' || !toolBlock.input || typeof toolBlock.input !== 'object') {
      return {
        requests: [],
        raw: JSON.stringify(response.content),
        error: 'No tool_use block',
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        cachedTokens: 0,
      };
    }
    const input = toolBlock.input as { searchRequests?: Record<string, unknown>[] };
    if (!input.searchRequests) {
      return {
        requests: [],
        raw: JSON.stringify(response.content),
        error: 'No tool_use block',
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        cachedTokens: 0,
      };
    }
    const requests = injectApiField(input.searchRequests, searchType);
    return {
      requests: requests as AnySearchRequest[],
      raw: JSON.stringify(toolBlock.input, null, 2),
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      cachedTokens: 0,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { requests: [], raw: '', error: msg, inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  }
}
