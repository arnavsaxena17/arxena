import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';

import type { PromptMode, SearchType } from './constants';
import type { AnySearchRequest } from './schemas';
import { getSearchTypeConfig, injectApiField } from './search-type-config';

const PLAIN_JSON_FALLBACK_MODELS = new Set(['o1-mini', 'o4-mini-deep-research']);

export async function callOpenAI(
  client: OpenAI,
  modelId: string,
  requirement: string,
  searchType: SearchType,
  isReasoning = false,
  isDeepResearch = false,
  promptMode: PromptMode = 'detailed',
): Promise<{ requests: AnySearchRequest[]; raw: string; error?: string; inputTokens: number; outputTokens: number; cachedTokens: number }> {
  const { prompt, schema, noun } = getSearchTypeConfig(searchType, promptMode);
  const userContent = `REQUIREMENT:\n${requirement}\n\nGenerate coverage ${noun} queries — as many as needed to cover all distinct candidate archetypes (typically 2–4). Each query must target a different access path; collectively they should leave no relevant candidate pool uncovered.`;

  try {
    if (PLAIN_JSON_FALLBACK_MODELS.has(modelId) || isDeepResearch) {
      const completion = await (client.chat.completions.create as unknown as (args: Record<string, unknown>) => Promise<{
        choices: Array<{ message?: { content?: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
      }>)({
        model: modelId,
        max_completion_tokens: 4096,
        messages: [{
          role: 'user',
          content: `${prompt}\n\n${userContent}\n\nOutput ONLY valid JSON: {"searchRequests":[{...}]} — no markdown, no explanation.`,
        }],
      });
      const raw = completion.choices[0]?.message?.content ?? '';
      const inputTokens  = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;
      const cachedTokens = completion.usage?.prompt_tokens_details?.cached_tokens ?? 0;
      try {
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed  = schema.parse(JSON.parse(cleaned));
        return { requests: parsed.searchRequests as AnySearchRequest[], raw, inputTokens, outputTokens, cachedTokens };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { requests: [], raw, error: `parse error: ${msg}`, inputTokens, outputTokens, cachedTokens };
      }
    }

    const params: Record<string, unknown> = {
      model: modelId,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user',   content: userContent },
      ],
      response_format: zodResponseFormat(schema, 'linkedinSearchRequests'),
    };
    if (isReasoning) params.max_completion_tokens = 8192;

    const completion = await client.chat.completions.create(params as never) as {
      choices: Array<{ message?: { content?: string | null } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
    };
    const content   = completion.choices[0]?.message?.content ?? '';
    const parsed    = schema.parse(JSON.parse(content));
    const inputTokens  = completion.usage?.prompt_tokens ?? 0;
    const outputTokens = completion.usage?.completion_tokens ?? 0;
    const cachedTokens = completion.usage?.prompt_tokens_details?.cached_tokens ?? 0;
    return {
      requests: injectApiField(parsed.searchRequests as Record<string, unknown>[], searchType) as AnySearchRequest[],
      raw: content,
      inputTokens,
      outputTokens,
      cachedTokens,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { requests: [], raw: '', error: msg, inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  }
}
