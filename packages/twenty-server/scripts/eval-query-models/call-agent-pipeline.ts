/**
 * Standalone agent-pipeline runner for eval scripts.
 *
 * Runs the same agent1→2→3→4 pipeline used by the production
 * LinkedinQueryGenerationService, but without NestJS DI overhead,
 * and with per-agent token-usage tracking for cost comparison.
 *
 * Output is converted to the eval scripts' AnySearchRequest format so the
 * same scorer can evaluate all three prompt modes side-by-side.
 */

import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import {
  AGENT1_SYSTEM_PROMPT,
  buildAgent1UserPrompt,
} from '../../src/engine/core-modules/linkedin-query-generation/prompts/agent1-parser.prompt';
import {
  buildAgent2UserPrompt,
  getAgent2SystemPrompt,
} from '../../src/engine/core-modules/linkedin-query-generation/prompts/agent2-master-lists.prompt';
import {
  buildAgent3UserPrompt,
  getAgent3SystemPrompt,
} from '../../src/engine/core-modules/linkedin-query-generation/prompts/agent3-primary-query.prompt';
import {
  buildAgent4UserPrompt,
  getAgent4SystemPrompt,
} from '../../src/engine/core-modules/linkedin-query-generation/prompts/agent4-factoring.prompt';
import {
  agent1ParserSchema,
  agent2MasterListsSchema,
  agent3PrimaryQueryResponseSchema,
  agent4FactoringSchema,
} from '../../src/engine/core-modules/linkedin-query-generation/schemas';
import type {
  FactoredQuery,
  MasterLists,
  ParsedRequirement,
  PrimaryQuery,
  SearchQuery,
} from '../../src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

import type { SearchType } from './constants';
import type { AnySearchRequest } from './schemas';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

type TokenUsage = { input: number; output: number; cached: number };

/** Call the OpenAI structured-output endpoint and return the parsed result + token counts. */
async function callLlm<T>(
  client: OpenAI,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  schemaName: string,
): Promise<{ result: T; tokens: TokenUsage }> {
  const completion = await client.chat.completions.create({
    model: modelId,
    temperature: 0,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: zodResponseFormat(schema, schemaName),
  }) as typeof completion & {
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
  };

  const content = completion.choices[0]?.message?.content?.trim() ?? '';
  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const raw = JSON.parse(cleaned);
  const result = schema.parse(raw) as T;

  return {
    result,
    tokens: {
      input:  (completion as { usage?: { prompt_tokens?: number } }).usage?.prompt_tokens ?? 0,
      output: (completion as { usage?: { completion_tokens?: number } }).usage?.completion_tokens ?? 0,
      cached: (completion as { usage?: { prompt_tokens_details?: { cached_tokens?: number } } })
                .usage?.prompt_tokens_details?.cached_tokens ?? 0,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Output format adapter
//
// The agent pipeline produces SearchQuery[] — a search-type-agnostic format:
//   { keywords, job_title, company[], location[], years_of_experience }
//
// The eval scorer expects AnySearchRequest[] (search-type-specific).
// This adapter converts between the two WITHOUT changing upstream types.
// ─────────────────────────────────────────────────────────────────────────────

function splitOrExpression(expr: string | null): string[] {
  if (!expr) return [];
  return expr
    .split(/\s+OR\s+/i)
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function toRecruiterRequests(queries: SearchQuery[]): AnySearchRequest[] {
  return queries.map((q) => ({
    api: 'recruiter' as const,
    category: 'people' as const,
    keywords: q.keywords,
    // job_title → role[] (title-scan field in Recruiter)
    role: q.job_title
      ? [{ keywords: q.job_title, priority: 'MUST_HAVE' as const, scope: 'CURRENT_OR_PAST' as const }]
      : null,
    // location strings stay as human-readable names (same as detailed/simple modes)
    location: q.location?.map((l) => ({
      name: l,
      priority: 'CAN_HAVE' as const,
      scope: 'CURRENT_OR_OPEN_TO_RELOCATE' as const,
    })) ?? null,
    company: q.company?.map((c) => ({
      keywords: c,
      priority: 'CAN_HAVE' as const,
      scope: 'CURRENT_OR_PAST' as const,
    })) ?? null,
  }));
}

function toSalesNavRequests(queries: SearchQuery[]): AnySearchRequest[] {
  return queries.map((q) => ({
    api: 'sales_navigator' as const,
    category: 'people' as const,
    keywords: q.keywords,
    // job_title → role.include[] (stem words)
    role: q.job_title
      ? { include: splitOrExpression(q.job_title), exclude: null }
      : null,
    location: q.location ? { include: q.location, exclude: null } : null,
    company: q.company ? { include: q.company, exclude: null } : null,
  }));
}

function toClassicRequests(queries: SearchQuery[]): AnySearchRequest[] {
  return queries.map((q) => ({
    api: 'classic' as const,
    category: 'people' as const,
    // Classic eval: `keywords` = job-title boolean expression
    // Agent job_title has the title variants; agent keywords has domain words
    keywords: q.job_title,
    location: q.location,
    company: q.company,
    past_company: null,
    school: null,
  }));
}

function searchQueriesToAnySearchRequests(
  queries: SearchQuery[],
  searchType: SearchType,
): AnySearchRequest[] {
  if (searchType === 'recruiter') return toRecruiterRequests(queries);
  if (searchType === 'sales_navigator') return toSalesNavRequests(queries);
  return toClassicRequests(queries);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the agent1→2→3→4 pipeline on a single requirement.
 *
 * Token counts are summed across all four agent LLM calls.
 * The output is converted to AnySearchRequest[] using the search-type adapter
 * above so it can be fed directly to the existing scorer.
 *
 * NOTE: Only OpenAI models are supported (the pipeline uses OpenAI structured
 * outputs via zodResponseFormat).  Pass the same OpenAI client used elsewhere.
 */
export async function callAgentPipeline(
  client: OpenAI,
  modelId: string,
  requirement: string,
  searchType: SearchType,
): Promise<{
  requests: AnySearchRequest[];
  raw: string;
  error?: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}> {
  let totalInput = 0;
  let totalOutput = 0;
  let totalCached = 0;

  try {
    // ── Agent 1: parse requirement ────────────────────────────────────────────
    const { result: parsedRequirement, tokens: t1 } = await callLlm(
      client, modelId,
      AGENT1_SYSTEM_PROMPT,
      buildAgent1UserPrompt(requirement),
      agent1ParserSchema,
      'agent1Parser',
    );
    totalInput  += t1.input;
    totalOutput += t1.output;
    totalCached += t1.cached;

    // ── Agent 2: master lists ─────────────────────────────────────────────────
    // agent2MasterListsSchema returns grouped_concepts as {concept,terms}[] array;
    // the service converts it to Record<string,string[]> — replicate that here.
    const { result: agent2Raw, tokens: t2 } = await callLlm(
      client, modelId,
      getAgent2SystemPrompt((parsedRequirement as ParsedRequirement).query_type),
      buildAgent2UserPrompt(parsedRequirement as ParsedRequirement),
      agent2MasterListsSchema,
      'agent2MasterLists',
    );
    totalInput  += t2.input;
    totalOutput += t2.output;
    totalCached += t2.cached;

    const masterLists: MasterLists = {
      ...(agent2Raw as object),
      keywords: {
        ...(agent2Raw as { keywords: object }).keywords,
        grouped_concepts: (
          (agent2Raw as { keywords: { grouped_concepts: Array<{ concept: string; terms: string[] }> } })
            .keywords.grouped_concepts
        ).reduce<Record<string, string[]>>(
          (acc, { concept, terms }) => { acc[concept] = terms; return acc; },
          {},
        ),
      },
    } as MasterLists;

    // ── Agent 3: primary query ────────────────────────────────────────────────
    const { result: agent3Raw, tokens: t3 } = await callLlm(
      client, modelId,
      getAgent3SystemPrompt((parsedRequirement as ParsedRequirement).query_type),
      buildAgent3UserPrompt(parsedRequirement as ParsedRequirement, masterLists),
      agent3PrimaryQueryResponseSchema,
      'agent3PrimaryQuery',
    );
    totalInput  += t3.input;
    totalOutput += t3.output;
    totalCached += t3.cached;

    const primaryQuery: PrimaryQuery =
      (agent3Raw as { primary_query: PrimaryQuery }).primary_query;

    // ── Agent 4: factoring ────────────────────────────────────────────────────
    const { result: factoredQuery, tokens: t4 } = await callLlm(
      client, modelId,
      getAgent4SystemPrompt((parsedRequirement as ParsedRequirement).query_type),
      buildAgent4UserPrompt(parsedRequirement as ParsedRequirement, primaryQuery),
      agent4FactoringSchema,
      'agent4Factoring',
    );
    const factoredQueryTyped = factoredQuery as FactoredQuery;
    totalInput  += t4.input;
    totalOutput += t4.output;
    totalCached += t4.cached;

    // Use the factored query as the final query set.
    // (In production, enforceLinkedInLimits may split this further, but for eval
    //  purposes we evaluate the factored form which already incorporates the
    //  agent's term-reduction reasoning.)
    const finalQueries: SearchQuery[] = [factoredQueryTyped.factored_query];
    const requests = searchQueriesToAnySearchRequests(finalQueries, searchType);

    const raw = JSON.stringify(
      { parsedRequirement, primaryQuery, factoredQuery: factoredQueryTyped },
      null,
      2,
    );

    return { requests, raw, inputTokens: totalInput, outputTokens: totalOutput, cachedTokens: totalCached };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      requests: [],
      raw: '',
      error: msg,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cachedTokens: totalCached,
    };
  }
}
