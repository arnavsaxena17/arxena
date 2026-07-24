import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { StreamProcessingService } from 'src/engine/core-modules/candidate-search/services/stream-processing.service';
import {
  AGENT1_SYSTEM_PROMPT,
  buildAgent1UserPrompt,
} from 'src/engine/core-modules/linkedin-query-generation/prompts/agent1-parser.prompt';
import {
  buildAgent2UserPrompt,
  getAgent2SystemPrompt,
} from 'src/engine/core-modules/linkedin-query-generation/prompts/agent2-master-lists.prompt';
import {
  buildAgent3UserPrompt,
  getAgent3SystemPrompt,
} from 'src/engine/core-modules/linkedin-query-generation/prompts/agent3-primary-query.prompt';
import {
  buildAgent4UserPrompt,
  getAgent4SystemPrompt,
} from 'src/engine/core-modules/linkedin-query-generation/prompts/agent4-factoring.prompt';
import {
  agent1ParserSchema,
  agent2MasterListsSchema,
  agent3PrimaryQueryResponseSchema,
  agent4FactoringSchema,
} from 'src/engine/core-modules/linkedin-query-generation/schemas';
import {
  FactoredQuery,
  MasterLists,
  OrchestratorResult,
  ParsedRequirement,
  PrimaryQuery,
  SearchQuery,
  SearchQuerySet,
} from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

type LlmOptions = {
  model?: string;
  temperature?: number;
  verbose?: boolean;
  queryIpLocation?: string;
  streaming?: boolean;
  sendEvent?: (event: string, data: Record<string, unknown>) => void;
};

@Injectable()
export class LinkedinQueryGenerationService {
  private readonly logger = new Logger(LinkedinQueryGenerationService.name);
  private readonly defaultModel =
    process.env.SEARCH_QUERY_GENERATOR_MODEL ||
    process.env.SEARCH_MODELS_OPENAI_MODEL ||
    'gpt-4o-mini';

  constructor(
    @Optional()
    private readonly streamProcessingService: StreamProcessingService | null,
  ) {}

  async runAgent1(
    rawRequirement: string,
    options?: LlmOptions,
  ): Promise<ParsedRequirement> {
    console.log(`Running Agent 1 with raw requirement: ${rawRequirement}`);
    const systemPrompt = AGENT1_SYSTEM_PROMPT;
    const userPrompt = buildAgent1UserPrompt(rawRequirement, options?.queryIpLocation);
    
    if (options?.verbose) {
      console.log('[LinkedinQueryGeneration] Agent 1 - Input:', {
        rawRequirement,
        queryIpLocation: options?.queryIpLocation,
      });
      console.log('[LinkedinQueryGeneration] Agent 1 - System Prompt:', systemPrompt);
      console.log('[LinkedinQueryGeneration] Agent 1 - User Prompt:', userPrompt);
    }

    const response = await this.callLlm(systemPrompt, userPrompt, options, {
      schema: agent1ParserSchema,
      name: 'agent1Parser',
    });

    const parsed = response as ParsedRequirement;

    if (options?.verbose) {
      console.log('[LinkedinQueryGeneration] Agent 1 - Output:', JSON.stringify(parsed, null, 2));
    }

    return parsed;
  }

  async runAgent2(
    parsedRequirement: ParsedRequirement,
    options?: LlmOptions,
  ): Promise<MasterLists> {

    console.log(`Running Agent 2 with parsed requirement: ${JSON.stringify(parsedRequirement, null, 2)}`);
    const systemPrompt = getAgent2SystemPrompt(parsedRequirement.query_type);
    const userPrompt = buildAgent2UserPrompt(parsedRequirement, options?.queryIpLocation);
    
    if (options?.verbose) {
      console.log('[LinkedinQueryGeneration] Agent 2 - Input:', {
        parsedRequirement: JSON.stringify(parsedRequirement, null, 2),
        queryIpLocation: options?.queryIpLocation,
      });
      console.log('[LinkedinQueryGeneration] Agent 2 - System Prompt:', systemPrompt);
      console.log('[LinkedinQueryGeneration] Agent 2 - User Prompt:', userPrompt);
    }

    const response = await this.callLlm(systemPrompt, userPrompt, options, {
      schema: agent2MasterListsSchema,
      name: 'agent2MasterLists',
    });

    const parsed = response as z.infer<typeof agent2MasterListsSchema>;
    const masterLists: MasterLists = {
      ...parsed,
      keywords: {
        ...parsed.keywords,
        grouped_concepts: parsed.keywords.grouped_concepts.reduce<Record<string, string[]>>(
          (acc, { concept, terms }) => {
            acc[concept] = terms;
            return acc;
          },
          {},
        ),
      },
    };

    if (options?.verbose) {
      console.log('[LinkedinQueryGeneration] Agent 2 - Output:', JSON.stringify(masterLists, null, 2));
    }

    return masterLists;
  }

  async runAgent3(
    parsedRequirement: ParsedRequirement,
    masterLists: MasterLists,
    options?: LlmOptions,
  ): Promise<PrimaryQuery> {
    const systemPrompt = getAgent3SystemPrompt(parsedRequirement.query_type);
    const userPrompt = buildAgent3UserPrompt(
      parsedRequirement,
      masterLists,
      options?.queryIpLocation,
    );
    
    if (options?.verbose) {
      console.log('[LinkedinQueryGeneration] Agent 3 - Input:', {
        parsedRequirement: JSON.stringify(parsedRequirement, null, 2),
        masterLists: JSON.stringify(masterLists, null, 2),
        queryIpLocation: options?.queryIpLocation,
      });
      console.log('[LinkedinQueryGeneration] Agent 3 - System Prompt:', systemPrompt);
      console.log('[LinkedinQueryGeneration] Agent 3 - User Prompt:', userPrompt);
    }

    const response = await this.callLlm(systemPrompt, userPrompt, options, {
      schema: agent3PrimaryQueryResponseSchema,
      name: 'agent3PrimaryQuery',
    });

    const result = response as { primary_query: PrimaryQuery };
    const parsed = result.primary_query;

    if (options?.verbose) {
      console.log('[LinkedinQueryGeneration] Agent 3 - Output:', JSON.stringify(parsed, null, 2));
    }

    return parsed;
  }

  async runAgent4(
    parsedRequirement: ParsedRequirement,
    primaryQuery: PrimaryQuery,
    options?: LlmOptions,
  ): Promise<FactoredQuery> {
    const systemPrompt = getAgent4SystemPrompt(parsedRequirement.query_type);
    const userPrompt = buildAgent4UserPrompt(
      parsedRequirement,
      primaryQuery,
      options?.queryIpLocation,
    );
    
    if (options?.verbose) {
      console.log('[LinkedinQueryGeneration] Agent 4 - Input:', {
        parsedRequirement: JSON.stringify(parsedRequirement, null, 2),
        primaryQuery: JSON.stringify(primaryQuery, null, 2),
        queryIpLocation: options?.queryIpLocation,
      });
      console.log('[LinkedinQueryGeneration] Agent 4 - System Prompt:', systemPrompt);
      console.log('[LinkedinQueryGeneration] Agent 4 - User Prompt:', userPrompt);
    }

    const response = await this.callLlm(systemPrompt, userPrompt, options, {
      schema: agent4FactoringSchema,
      name: 'agent4Factoring',
    });

    const parsed = response as FactoredQuery;

    if (options?.verbose) {
      console.log('[LinkedinQueryGeneration] Agent 4 - Output:', JSON.stringify(parsed, null, 2));
    }

    return parsed;
  }

  async generateSearchQuerySet(
    rawRequirement: string,
    options?: LlmOptions & { verbose?: boolean; sendEvent?: (event: string, data: Record<string, unknown>) => void },
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const sendEvent = options?.sendEvent;

    // Enable streaming if sendEvent is provided
    const streamingOptions: LlmOptions = {
      ...options,
      streaming: !!sendEvent,
      sendEvent,
    };

    sendEvent?.('status', {
      message: `Parsing requirement...`,
    });

    const agent1Start = Date.now();
    const parsedRequirement = await this.runAgent1(rawRequirement, streamingOptions);
    this.logger.log(`Parsed requirement: ${JSON.stringify(parsedRequirement, null, 2)}`);
    if (options?.verbose) {
      console.log('[LinkedinQueryGeneration] Stage 1 - Parsed requirement:', JSON.stringify(parsedRequirement, null, 2));
    }
    const agent1Time = Date.now() - agent1Start;

    sendEvent?.('status', {
      message: 'Generating master lists...',
    });
    sendEvent?.('message', {
      type: 'parsed_requirement',
      data: parsedRequirement,
    });

    const agent2Start = Date.now();
    const masterLists = await this.runAgent2(parsedRequirement, streamingOptions);
    this.logger.log(`Master lists: ${JSON.stringify(masterLists, null, 2)}`);
    if (options?.verbose) {
      console.log('[LinkedinQueryGeneration] Stage 2 - Master lists:', JSON.stringify(masterLists, null, 2));
    }
    const agent2Time = Date.now() - agent2Start;

    sendEvent?.('status', {
      message: 'Building primary query...',
    });
    sendEvent?.('message', {
      type: 'master_lists',
      data: masterLists,
    });

    const agent3Start = Date.now();
    const primaryQuery = await this.runAgent3(
      parsedRequirement,
      masterLists,
      streamingOptions,
    );
    this.logger.log(`Primary query: ${JSON.stringify(primaryQuery, null, 2)}`);
    if (options?.verbose) {
      console.log('[LinkedinQueryGeneration] Stage 3 - Primary query:', JSON.stringify(primaryQuery, null, 2));
    }
    const agent3Time = Date.now() - agent3Start;

    sendEvent?.('status', {
      message: 'Factoring query...',
    });
    sendEvent?.('message', {
      type: 'primary_query',
      data: primaryQuery,
    });

    const agent4Start = Date.now();
    const factoredQuery = await this.runAgent4(
      parsedRequirement,
      primaryQuery,
      streamingOptions,
    );
    this.logger.log(`Factored query: ${JSON.stringify(factoredQuery, null, 2)}`);
    if (options?.verbose) {
      console.log('[LinkedinQueryGeneration] Stage 4 - Factored query:', JSON.stringify(factoredQuery, null, 2));
    }
    const agent4Time = Date.now() - agent4Start;

    sendEvent?.('status', {
      message: 'Splitting queries to meet LinkedIn limits...',
    });
    sendEvent?.('message', {
      type: 'factored_query',
      data: factoredQuery,
    });

    // Deterministic splitting based on factored query
    const query_set = this.enforceLinkedInLimits({
      search_query_set: [factoredQuery.factored_query],
    });
    
    // Create splitting strategy metadata
    const splitting_strategy = {
      strategy_type: factoredQuery.recommended_strategy,
      strategy_description: factoredQuery.splitting_reason || 'Deterministic splitting based on term limits',
      number_of_queries: query_set.search_query_set.length,
      distribution_logic: `Split factored expressions into groups of max 5 OR terms per query so total terms per field stay within 6`,
    };
    
    this.logger.log(`Splitting strategy: ${JSON.stringify(splitting_strategy, null, 2)}`);
    this.logger.log(`Query set: ${JSON.stringify(query_set, null, 2)}`);
    if (options?.verbose) {
      console.log('[LinkedinQueryGeneration] Stage 5 - Splitting strategy:', JSON.stringify(splitting_strategy, null, 2));
      console.log('[LinkedinQueryGeneration] Stage 5 - Query set:', JSON.stringify(query_set, null, 2));
    }

    sendEvent?.('status', {
      message: `Generated ${query_set.search_query_set.length} search query${query_set.search_query_set.length !== 1 ? 's' : ''}`,
    });
    sendEvent?.('message', {
      type: 'splitting_strategy',
      data: splitting_strategy,
    });
    sendEvent?.('message', {
      type: 'query_set',
      data: query_set,
    });

    const totalTime = Date.now() - startTime;

    if (options?.verbose) {
      this.logger.log(
        `Generated ${query_set.search_query_set.length} queries in ${totalTime}ms`,
      );
      console.log(`[LinkedinQueryGeneration] Generated ${query_set.search_query_set.length} queries in ${totalTime}ms`);
    }

    return {
      parsed_requirement: parsedRequirement,
      master_lists: masterLists,
      primary_query: primaryQuery,
      factored_query: factoredQuery,
      splitting_strategy,
      final_query_set: query_set,
      metadata: {
        processing_time_ms: totalTime,
        agent1_time_ms: agent1Time,
        agent2_time_ms: agent2Time,
        agent3_time_ms: agent3Time,
        agent4_time_ms: agent4Time,
        total_queries_generated: query_set.search_query_set.length,
      },
    };
  }

  async generateSearchQuerySetBatch(
    requirements: string[],
    options?: LlmOptions & { verbose?: boolean; parallel?: boolean },
  ): Promise<OrchestratorResult[]> {
    if (options?.parallel) {
      return Promise.all(
        requirements.map((requirement) =>
          this.generateSearchQuerySet(requirement, {
            ...options,
            verbose: false,
          }),
        ),
      );
    }

    const results: OrchestratorResult[] = [];
    for (const requirement of requirements) {
      const result = await this.generateSearchQuerySet(requirement, options);
      results.push(result);
    }

    return results;
  }

  validateQuerySet(querySet: SearchQuerySet): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    querySet.search_query_set.forEach((query, index) => {
      const queryNumber = index + 1;

      if (query.keywords) {
        const keywordTerms = this.countTerms(query.keywords);
        if (keywordTerms > 6) {
          errors.push(
            `Query ${queryNumber}: keywords has ${keywordTerms} terms (max 6)`,
          );
        }
      }

      if (query.job_title) {
        const jobTitleTerms = this.countTerms(query.job_title);
        if (jobTitleTerms > 6) {
          errors.push(
            `Query ${queryNumber}: job_title has ${jobTitleTerms} terms (max 6)`,
          );
        }
      }

      if (query.keywords && query.job_title) {
        const keywordTerms = this.countTerms(query.keywords);
        const jobTitleTerms = this.countTerms(query.job_title);
        const combinedTerms = keywordTerms + jobTitleTerms;

        if (combinedTerms > 10) {
          errors.push(
            `Query ${queryNumber}: combined terms ${combinedTerms} exceeds max 10`,
          );
        }
      }

      if (query.keywords === '') {
        warnings.push(`Query ${queryNumber}: keywords is empty string (use null)`);
      }

      if (query.job_title === '') {
        warnings.push(`Query ${queryNumber}: job_title is empty string (use null)`);
      }

      if (!query.keywords && !query.job_title) {
        errors.push(`Query ${queryNumber}: keywords and job_title are both null`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private enforceLinkedInLimits(querySet: SearchQuerySet): SearchQuerySet {
    const expandedQueries: SearchQuery[] = [];

    for (const query of querySet.search_query_set) {
      const queries = this.splitQueryIfNeeded(query);
      expandedQueries.push(...queries);
    }

    return {
      search_query_set: expandedQueries,
    };
  }

  private splitQueryIfNeeded(query: SearchQuery): SearchQuery[] {
    const keywordsTerms = this.extractTerms(query.keywords);
    const jobTitleTerms = this.extractTerms(query.job_title);

    const keywordsWithinLimit = keywordsTerms.length <= 6;
    const jobTitleWithinLimit = jobTitleTerms.length <= 6;
    const combinedWithinLimit =
      keywordsTerms.length + jobTitleTerms.length <= 10;

    // If within limits, return as-is
    if (
      keywordsWithinLimit &&
      jobTitleWithinLimit &&
      combinedWithinLimit
    ) {
      return [
        {
          ...query,
          keywords: query.keywords,
          job_title: query.job_title,
          company: this.sanitizeArray(query.company),
          location: this.sanitizeArray(query.location),
        },
      ];
    }

    // Check if we have factored expressions that need splitting
    const keywordsFactored = this.parseFactoredExpression(query.keywords);
    const jobTitleFactored = this.parseFactoredExpression(query.job_title);

    // If we have factored expressions, split them properly
    if (keywordsFactored || jobTitleFactored) {
      return this.splitFactoredQuery(query, keywordsFactored, jobTitleFactored);
    }

    // Fallback to simple trimming (for non-factored expressions)
    let trimmedKeywords = keywordsTerms;
    let trimmedJobTitles = jobTitleTerms;

    if (keywordsTerms.length > 6) {
      trimmedKeywords = keywordsTerms.slice(0, 6);
    }
    if (jobTitleTerms.length > 6) {
      trimmedJobTitles = jobTitleTerms.slice(0, 6);
    }
    while (trimmedKeywords.length + trimmedJobTitles.length > 10) {
      if (
        trimmedKeywords.length >= trimmedJobTitles.length &&
        trimmedKeywords.length > 0
      ) {
        trimmedKeywords = trimmedKeywords.slice(0, -1);
      } else if (trimmedJobTitles.length > 0) {
        trimmedJobTitles = trimmedJobTitles.slice(0, -1);
      } else {
        break;
      }
    }

    return [
      {
        ...query,
        keywords: this.termsToExpression(trimmedKeywords),
        job_title: this.termsToExpression(trimmedJobTitles),
        company: this.sanitizeArray(query.company),
        location: this.sanitizeArray(query.location),
      },
    ];
  }

  private parseFactoredExpression(
    expression: string | null,
  ): { andPart: string; andTerms: string[]; orTerms: string[] } | null {
    if (!expression?.trim()) {
      return null;
    }

    // Check if expression contains AND with parentheses
    // Pattern: "term" AND ("term1" OR "term2" OR ...)
    // or: term AND (term1 OR term2 OR ...)
    const andMatch = expression.match(/^(.+?)\s+AND\s+\((.+)\)$/i);
    if (!andMatch) {
      return null;
    }

    const andPartRaw = andMatch[1].trim();
    const orPart = andMatch[2].trim();

    // Remove quotes from AND part if present
    const cleanAndPart = andPartRaw.replace(/^["']|["']$/g, '');

    // Extract OR terms
    const orTerms = this.extractOrTerms(orPart);
    // Extract all anchor terms (can itself be a grouped expression like "sales OR business development")
    const andTerms = this.extractTerms(cleanAndPart);

    return { andPart: cleanAndPart, andTerms, orTerms };
  }

  private extractOrTerms(orExpression: string): string[] {
    const terms: string[] = [];
    
    // Split by OR, handling quoted terms and spaces
    const parts = orExpression.split(/\s+OR\s+/i);
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        // Remove quotes if present but keep the term
        const unquoted = trimmed.replace(/^["']|["']$/g, '');
        if (unquoted) {
          terms.push(unquoted);
        }
      }
    }

    return terms;
  }

  private splitFactoredQuery(
    query: SearchQuery,
    keywordsFactored: { andPart: string; andTerms: string[]; orTerms: string[] } | null,
    jobTitleFactored: { andPart: string; andTerms: string[]; orTerms: string[] } | null,
  ): SearchQuery[] {
    const queries: SearchQuery[] = [];

    // Check which fields need splitting
    const keywordsNeedsSplitting = keywordsFactored && keywordsFactored.orTerms.length > 6;
    const jobTitleNeedsSplitting = jobTitleFactored && jobTitleFactored.orTerms.length > 6;

    if (keywordsNeedsSplitting && jobTitleNeedsSplitting) {
      const keywordsAnchorTerms = keywordsFactored!.andTerms.length || 1;
      const jobTitleAnchorTerms = jobTitleFactored!.andTerms.length || 1;
      const maxKeywordsOrTermsPerGroup = Math.max(1, 6 - keywordsAnchorTerms);
      const maxJobTitleOrTermsPerGroup = Math.max(1, 6 - jobTitleAnchorTerms);

      // Both need splitting - create cartesian product
      const keywordsGroups = this.chunkArray(
        keywordsFactored!.orTerms,
        maxKeywordsOrTermsPerGroup,
      );
      const jobTitleGroups = this.chunkArray(
        jobTitleFactored!.orTerms,
        maxJobTitleOrTermsPerGroup,
      );
      
      for (const keywordGroup of keywordsGroups) {
        for (const jobTitleGroup of jobTitleGroups) {
          const keywordsExpression = `${keywordsFactored!.andPart} AND (${keywordGroup.map(term => /\s/.test(term) ? `"${term}"` : term).join(' OR ')})`;
          const jobTitleExpression = `${jobTitleFactored!.andPart} AND (${jobTitleGroup.map(term => /\s/.test(term) ? `"${term}"` : term).join(' OR ')})`;
          
          queries.push({
            ...query,
            keywords: keywordsExpression,
            job_title: jobTitleExpression,
            company: this.sanitizeArray(query.company),
            location: this.sanitizeArray(query.location),
          });
        }
      }
    } else if (keywordsNeedsSplitting) {
      const anchorTerms = keywordsFactored!.andTerms.length || 1;
      const maxOrTermsPerGroup = Math.max(1, 6 - anchorTerms);
      const orTermGroups = this.chunkArray(
        keywordsFactored!.orTerms,
        maxOrTermsPerGroup,
      );
      
      for (const group of orTermGroups) {
        const factoredExpression = `${keywordsFactored!.andPart} AND (${group.map(term => /\s/.test(term) ? `"${term}"` : term).join(' OR ')})`;
        
        queries.push({
          ...query,
          keywords: factoredExpression,
          job_title: query.job_title,
          company: this.sanitizeArray(query.company),
          location: this.sanitizeArray(query.location),
        });
      }
    } else if (jobTitleNeedsSplitting) {
      const anchorTerms = jobTitleFactored!.andTerms.length || 1;
      const maxOrTermsPerGroup = Math.max(1, 6 - anchorTerms);
      const orTermGroups = this.chunkArray(
        jobTitleFactored!.orTerms,
        maxOrTermsPerGroup,
      );
      
      for (const group of orTermGroups) {
        const factoredExpression = `${jobTitleFactored!.andPart} AND (${group.map(term => /\s/.test(term) ? `"${term}"` : term).join(' OR ')})`;
        
        queries.push({
          ...query,
          keywords: query.keywords,
          job_title: factoredExpression,
          company: this.sanitizeArray(query.company),
          location: this.sanitizeArray(query.location),
        });
      }
    } else {
      // Verify the full expression actually fits within LinkedIn's term limits.
      // parseFactoredExpression can misparse multi-AND expressions (e.g. A AND B AND C),
      // reporting orTerms.length <= 6 even when extractTerms returns > 6 total terms.
      const actualKeywordsCount = this.extractTerms(query.keywords).length;
      const actualJobTitleCount = this.extractTerms(query.job_title).length;
      if (
        actualKeywordsCount <= 6 &&
        actualJobTitleCount <= 6 &&
        actualKeywordsCount + actualJobTitleCount <= 10
      ) {
        queries.push({
          ...query,
          keywords: query.keywords,
          job_title: query.job_title,
          company: this.sanitizeArray(query.company),
          location: this.sanitizeArray(query.location),
        });
      } else {
        // Complex factored expression still exceeds limits — simplify to the anchor (AND) terms only.
        const simplifiedKeywords = keywordsFactored
          ? this.termsToExpression(keywordsFactored.andTerms.slice(0, 6))
          : this.termsToExpression(this.extractTerms(query.keywords).slice(0, 6));
        const simplifiedJobTitle = jobTitleFactored
          ? this.termsToExpression(jobTitleFactored.andTerms.slice(0, 6))
          : this.termsToExpression(this.extractTerms(query.job_title ?? null).slice(0, 6));
        queries.push({
          ...query,
          keywords: simplifiedKeywords,
          job_title: simplifiedJobTitle,
          company: this.sanitizeArray(query.company),
          location: this.sanitizeArray(query.location),
        });
      }
    }

    return queries.length > 0 ? queries : [query];
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async callLlm<T>(
    systemPrompt: string,
    userPrompt: string,
    options: LlmOptions | undefined,
    schemaOption: { schema: z.ZodType<T>; name: string },
  ): Promise<T> {
    const openai = this.createOpenAiClient();
    const { schema, name } = schemaOption;
    const shouldStream = options?.streaming && options?.sendEvent;

    // When streaming, reuse StreamProcessingService when available (retries, timeout, event shape for assistant frontend)
    if (shouldStream) {
      const model = options?.model || this.defaultModel;
      const temperature = options?.temperature ?? 0;
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      if (this.streamProcessingService) {
        const streamFactory = async () =>
          openai.chat.completions.create({
            model,
            temperature,
            messages,
            stream: true,
            response_format: zodResponseFormat(schema, name),
          });

        const { content: accumulatedContent } =
          await this.streamProcessingService.executeStreamingLlmCall(
            streamFactory,
            {
              sendEvent: options.sendEvent,
              chunkEventName: 'text',
              chunkPayloadKey: 'delta',
            },
          );

        if (!accumulatedContent?.trim()) {
          throw new HttpException(
            'Empty response received from LLM',
            HttpStatus.BAD_GATEWAY,
          );
        }

        const raw = this.parseJson(accumulatedContent);
        return schema.parse(raw) as T;
      }

      // Fallback when StreamProcessingService not injected (e.g. standalone LinkedinQueryGenerationModule)
      const stream = await openai.chat.completions.create({
        model,
        temperature,
        messages,
        stream: true,
        response_format: zodResponseFormat(schema, name),
      });
      let accumulatedContent = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          accumulatedContent += delta;
          options.sendEvent?.('text', { delta });
        }
      }
      if (!accumulatedContent.trim()) {
        throw new HttpException(
          'Empty response received from LLM',
          HttpStatus.BAD_GATEWAY,
        );
      }
      const raw = this.parseJson(accumulatedContent);
      return schema.parse(raw) as T;
    }

    // Non-streaming path
    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? 0;

    // Only some models support `response_format: { type: "json_schema" }`.
    // For models that don't (e.g. gpt-3.5-turbo), fall back to plain JSON-in-text parsing.
    // const supportsStructuredOutputs = !/^gpt-3\.5/i.test(model);

    const completion = await openai.chat.completions.create({
      model,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(schema, name)
      // ...(supportsStructuredOutputs
      //   ? { response_format: zodResponseFormat(schema, name) }
      //   : {}),
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new HttpException(
        'Empty response received from LLM',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const raw = this.parseJson(content);
    return schema.parse(raw) as T;
  }

  private parseJson(content: string): unknown {
    const cleaned = content
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (error) {
      this.logger.error('Failed to parse LLM response as JSON', {
        error,
        response: cleaned,
      });
      throw new HttpException(
        'Invalid JSON returned from LLM',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private createOpenAiClient(): OpenAI {
    const apiKey = process.env.OPENAI_KEY;

    if (!apiKey) {
      throw new HttpException(
        'OPENAI_KEY is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return new OpenAI({ apiKey });
  }

  private countTerms(expression: string): number {
    return this.extractTerms(expression).length;
  }

  private extractTerms(expression: string | null): string[] {
    if (!expression?.trim()) {
      return [];
    }

    const terms: string[] = [];
    const tokenRegex = /"[^"]+"|'[^']+'|\(|\)|\bAND\b|\bOR\b|\bNOT\b|[^\s()]+/gi;
    const rawTokens = expression.match(tokenRegex) || [];
    let buffer: string[] = [];

    const flushBuffer = () => {
      if (!buffer.length) {
        return;
      }

      terms.push(buffer.join(' ').trim());
      buffer = [];
    };

    for (const rawToken of rawTokens) {
      const token = rawToken.trim();
      if (!token) {
        continue;
      }

      if (token === '(' || token === ')' || /^(AND|OR|NOT)$/i.test(token)) {
        flushBuffer();
        continue;
      }

      if (/^"[^"]+"$/.test(token) || /^'[^']+'$/.test(token)) {
        flushBuffer();
        terms.push(this.normalizeTermToken(token));
        continue;
      }

      buffer.push(token);
    }

    flushBuffer();

    return terms;
  }

  private normalizeTermToken(token: string): string {
    const singleQuoted = token.match(/^'(.*)'$/);
    if (singleQuoted) {
      return singleQuoted[1].trim();
    }

    const doubleQuoted = token.match(/^"(.*)"$/);
    if (doubleQuoted) {
      return doubleQuoted[1].trim();
    }

    return token;
  }

  private termsToExpression(terms: string[]): string | null {
    if (!terms.length) {
      return null;
    }

    return terms
      .map((term) => {
        if (/\s/.test(term)) {
          return `"${term}"`;
        }

        return term;
      })
      .join(' OR ');
  }

  private sanitizeArray(value: string[] | null): string[] | null {
    if (!value || value.length === 0) {
      return null;
    }

    return value;
  }
}
