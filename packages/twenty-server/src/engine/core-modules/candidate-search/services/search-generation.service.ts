import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { EnrichmentsPrompts } from '../prompts/enrichments-prompts';
import { FiltersPrompts } from '../prompts/filters-prompts';
import { QueryCleanupPrompts } from '../prompts/query-cleanup-prompts';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { SortsPrompts } from '../prompts/sorts-prompts';
import { queryCleanupSchema } from '../schemas/query-cleanup.schema';
import { ParsedJobDescription } from '../types/candidate-search-request.type';
import { LinkedInSearchResult } from '../types/linkedin-search-result.type';
import {
  EnrichmentsResponse,
  FiltersResponse,
  SearchParametersResponse,
  SortsResponse
} from '../types/search-plan.types';
  // import { CandidateSearchPromptService } from './candidate-search-prompt.service';


const enrichmentFieldSchema = z.object({
  name: z.string(),
  type: z.enum(['text', 'number', 'boolean', 'enum']),
  description: z.string(),
  enumValues: z.array(z.string()).nullable(),
  required: z.boolean().nullable()
});

const enrichmentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['skills', 'seniority', 'location', 'experience', 'cultural', 'custom']),
  fields: z.array(enrichmentFieldSchema),
  prompt: z.string(),
  selectedMetadataFields: z.array(z.string()),
  model: z.string(),
  reasoning: z.string()
});

const enrichmentsResponseSchema = z.object({
  enrichments: z.array(enrichmentConfigSchema),
  overallStrategy: z.string(),
  reasoning: z.string(),
  metadata: z.object({
    generatedAt: z.string(),
    hasSampleData: z.boolean(),
    sampleDataSize: z.number().nullable()
  })
});

const handsontableFilterSchema = z.object({
  column: z.string(),
  type: z.enum(['text', 'numeric', 'date', 'dropdown', 'checkbox', 'autocomplete']),
  condition: z.enum([
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'contains',
    'not_contains',
    'begins_with',
    'ends_with',
    'empty',
    'not_empty',
    'between',
    'by_value',
  ]),
  // Explicit value types to satisfy OpenAI JSON schema requirements
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.array(z.number()),
      z.object({ min: z.number(), max: z.number() }), // numeric range
      z.object({ start: z.string(), end: z.string() }), // date/string range
      z.null(),
    ])
    .nullable(),
  value2: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.array(z.number()),
      z.object({ min: z.number(), max: z.number() }), // numeric range
      z.object({ start: z.string(), end: z.string() }), // date/string range
      z.null(),
    ])
    .nullable(),
  options: z.array(z.string()).nullable(),
});

const candidateSearchFilterSchema = z.object({
  field: z.string(),
  type: z.enum([
    'text_search',
    'dropdown_selection',
    'date_range',
    'numeric_range',
    'boolean',
    'multi_select',
    'location',
    'company',
    'industry',
    'seniority',
    'network_distance',
    'experience_range',
    'salary_range',
  ]),
  label: z.string(),
  // Explicit union for single value
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.array(z.number()),
      z.object({ min: z.number(), max: z.number() }), // numeric range
      z.object({ start: z.string(), end: z.string() }), // date range or string range
      z.null(),
    ])
    .nullable(),
  // Explicit union for multiple values
  values: z
    .union([
      z.array(z.string()),
      z.array(z.number()),
      z.array(z.boolean()),
      z.null(),
    ])
    .nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  options: z.array(z.string()).nullable(),
  placeholder: z.string().nullable(),
});

const filterStrategySchema = z.object({
  name: z.string(),
  description: z.string(),
  targetShortlistSize: z.number(),
  priority: z.enum(['quality', 'quantity', 'balanced']),
  reasoning: z.string()
});

const filtersResponseSchema = z.object({
  filterStrategy: filterStrategySchema,
  handsontableFilters: z.array(handsontableFilterSchema),
  candidateSearchFilters: z.array(candidateSearchFilterSchema),
  reasoning: z.string(),
  metadata: z.object({
    generatedAt: z.string(),
    hasDataDistribution: z.boolean(),
    dataDistributionFields: z.array(z.string()).nullable(),
    hasSampleData: z.boolean().nullable(),
    sampleDataSize: z.number().nullable()
  })
});

const sortColumnSchema = z.object({
  column: z.string(),
  sortOrder: z.enum(['asc', 'desc']),
  priority: z.number(),
  reasoning: z.string()
});

const sortStrategySchema = z.object({
  name: z.string(),
  description: z.string(),
  reasoning: z.string(),
  sortColumns: z.array(sortColumnSchema)
});

const sortsResponseSchema = z.object({
  sortStrategy: sortStrategySchema,
  reasoning: z.string(),
  metadata: z.object({
    generatedAt: z.string(),
    hasSampleData: z.boolean(),
    sampleDataSize: z.number().nullable(),
    hasEnrichments: z.boolean(),
    enrichmentsCount: z.number(),
    hasFilters: z.boolean(),
    filtersCount: z.number()
  })
});

const messageClassificationSchema = z.object({
  classification: z.enum(['search_parameters', 'enrichments', 'filters', 'sorts', 'complete_plan', 'general_help', 'clarification_response']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string()
});

@Injectable()
export class SearchGenerationService {
  private readonly logger = new Logger(SearchGenerationService.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly searchParametersPrompts: SearchParametersPrompts,
  ) {}

  private validateAndNormalizeParsedJD(parsedJD: ParsedJobDescription): ParsedJobDescription {
    // Validate parsedJD structure
    if (!parsedJD) {
      throw new Error('ParsedJobDescription is required');
    }
    
    // Ensure required arrays are defined
    if (!parsedJD.requiredSkills) {
      parsedJD.requiredSkills = [];
    }
    if (!parsedJD.preferredSkills) {
      parsedJD.preferredSkills = [];
    }
    if (!parsedJD.education) {
      parsedJD.education = [];
    }
    if (!parsedJD.keywords) {
      parsedJD.keywords = [];
    }
    if (!parsedJD.responsibilities) {
      parsedJD.responsibilities = [];
    }
    if (!parsedJD.qualifications) {
      parsedJD.qualifications = [];
    }
    if (!parsedJD.benefits) {
      parsedJD.benefits = [];
    }
    
    return parsedJD;
  }

  async generateEnrichments(
    parsedJD: ParsedJobDescription,
    searchParameters: SearchParametersResponse,
    sampleResults: LinkedInSearchResult[] | undefined,
    apiToken: string
  ): Promise<EnrichmentsResponse> {
    console.log("generateEnrichments called");
    console.log("parsedJD for generateEnrichments: ", JSON.stringify(parsedJD, null, 2));
    console.log("searchParameters for generateEnrichments: ", JSON.stringify(searchParameters, null, 2));
    console.log("sampleResults for generateEnrichments: ", JSON.stringify(sampleResults, null, 2));
    const normalizedParsedJD = this.validateAndNormalizeParsedJD(parsedJD);
    console.log("normalizedParsedJD for generateEnrichments: ", JSON.stringify(normalizedParsedJD, null, 2));
    try {
      const { openAIclient: openai } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
      const systemPrompt = EnrichmentsPrompts.getSystemPrompt();
      console.log("systemPrompt for generateEnrichments: ", systemPrompt);
      const userPrompt = EnrichmentsPrompts.getUserPrompt(normalizedParsedJD, searchParameters, sampleResults);
      console.log("userPrompt for generateEnrichments: ", userPrompt);
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: zodResponseFormat(
          enrichmentsResponseSchema,
          'enrichmentsResponse',
        ),
      });
      console.log("completion for generateEnrichments: ", JSON.stringify(completion, null, 2));

      const response = JSON.parse(completion.choices[0].message.content || '{}');
      console.log("response for generateEnrichments: ", JSON.stringify(response, null, 2));
      this.logger.log(`response: ${JSON.stringify(response, null, 2)}`);
      // Validate response
      const validatedResponse = enrichmentsResponseSchema.parse(response);
      console.log("validatedResponse for generateEnrichments: ", JSON.stringify(validatedResponse, null, 2));
      // Add metadata
      validatedResponse.metadata = {
        generatedAt: new Date().toISOString(),
        hasSampleData: !!sampleResults,
        sampleDataSize: sampleResults?.length ?? null
      };
      console.log("validatedResponse.metadata for generateEnrichments: ", JSON.stringify(validatedResponse.metadata, null, 2));
      this.logger.log(`Generated ${validatedResponse.enrichments.length} enrichments`);
      return validatedResponse as EnrichmentsResponse;
      
    } catch (error) {
      this.logger.error(`Error generating enrichments::::: ${error}`);
      throw new Error(`Failed to generate enrichments::: ${error.message}`);
    }
  }

  async generateFilters(
    parsedJD: ParsedJobDescription,
    enrichments: EnrichmentsResponse,
    sampleResults: LinkedInSearchResult[] | undefined,
    dataDistribution: Record<string, { min: number; max: number; avg: number; count: number }> | undefined,
    apiToken: string
  ): Promise<FiltersResponse> {
    // Validate and normalize parsedJD structure
    const normalizedParsedJD = this.validateAndNormalizeParsedJD(parsedJD);
    
    try {
      this.logger.log(`Generating filters for enrichments: ${enrichments.enrichments.map(e => e.name).join(', ')}`);
      
      const { openAIclient: openai } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
      
      const systemPrompt = FiltersPrompts.getSystemPrompt();
      const userPrompt = FiltersPrompts.getUserPrompt(normalizedParsedJD, enrichments, sampleResults, dataDistribution);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: zodResponseFormat(
          filtersResponseSchema,
          'filtersResponse',
        ),
      });

      const response = JSON.parse(completion.choices[0].message.content || '{}');
      this.logger.log(`response: ${JSON.stringify(response, null, 2)}`);
      // Validate response
      const validatedResponse = filtersResponseSchema.parse(response);
      
      // Add metadata
      validatedResponse.metadata = {
        generatedAt: new Date().toISOString(),
        hasDataDistribution: !!dataDistribution,
        dataDistributionFields: dataDistribution ? Object.keys(dataDistribution) : null,
        hasSampleData: !!sampleResults,
        sampleDataSize: sampleResults?.length ?? null
      };

      this.logger.log(`Generated ${validatedResponse.handsontableFilters.length} Handsontable filters and ${validatedResponse.candidateSearchFilters.length} CandidateSearch filters`);
      return validatedResponse as FiltersResponse;
      
    } catch (error) {
      this.logger.error('Error generating filters:', error);
      throw new Error(`Failed to generate filters: ${error.message}`);
    }
  }

  async generateSorts(
    parsedJD: ParsedJobDescription,
    searchParameters: SearchParametersResponse,
    enrichments: EnrichmentsResponse,
    filters: FiltersResponse,
    sampleResults: LinkedInSearchResult[] | undefined,
    apiToken: string
  ): Promise<SortsResponse> {
    // Validate and normalize parsedJD structure
    const normalizedParsedJD = this.validateAndNormalizeParsedJD(parsedJD);
    
    try {
      this.logger.log(`Generating sorts for enrichments: ${enrichments.enrichments.map(e => e.name).join(', ')}`);
      
      const { openAIclient: openai } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
      
      const systemPrompt = SortsPrompts.getSystemPrompt();
      const userPrompt = SortsPrompts.getUserPrompt(normalizedParsedJD, searchParameters, enrichments, filters, sampleResults);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: zodResponseFormat(
          sortsResponseSchema,
          'sortsResponse',
        ),
      });

      const response = JSON.parse(completion.choices[0].message.content || '{}');
      this.logger.log(`response: ${JSON.stringify(response, null, 2)}`);
      // Validate response
      const validatedResponse = sortsResponseSchema.parse(response);
      
      // Add metadata
      validatedResponse.metadata = {
        generatedAt: new Date().toISOString(),
        hasSampleData: !!sampleResults,
        sampleDataSize: sampleResults?.length ?? null,
        hasEnrichments: !!enrichments,
        enrichmentsCount: enrichments.enrichments.length,
        hasFilters: !!filters,
        filtersCount: filters.handsontableFilters.length + filters.candidateSearchFilters.length
      };

      this.logger.log(`Generated ${validatedResponse.sortStrategy.sortColumns.length} sort columns`);
      return validatedResponse as SortsResponse;
      
    } catch (error) {
      this.logger.error('Error generating sorts:', error);
      throw new Error(`Failed to generate sorts: ${error.message}`);
    }
  }

  /**
   * Classify a chat message to determine user intent using AI
   * @param message - The user message to classify
   * @param apiToken - API token for authentication
   * @param chatHistory - Optional chat history for context
   * @param rawJDText - Optional raw job description text for context
   */
  async classifyMessage(
    message: string,
    apiToken: string,
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>,
    rawJDText?: string,
  ): Promise<{ type: string; confidence: number; reasoning: string }> {
    try {
      this.logger.log(`Classifying message: "${message}"`);
      
      const { openAIclient: openai } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
      
      const prompt = this.searchParametersPrompts.getMessageClassificationPrompt(chatHistory, rawJDText);
      
      // Replace template variables
      const systemPrompt = prompt.system;
      const userPrompt = prompt.user.replace('{{message}}', message);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1, // Low temperature for consistent classification
        response_format: zodResponseFormat(
          messageClassificationSchema,
          'messageClassification',
        ),
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content returned from LLM for message classification');
      }

      const result = JSON.parse(content);
      const validatedResult = messageClassificationSchema.parse(result);
      
      this.logger.log(`Message classified as: ${validatedResult.classification} (confidence: ${validatedResult.confidence}) with reasoning: ${validatedResult.reasoning}`);
      
      return {
        type: validatedResult.classification,
        confidence: validatedResult.confidence,
        reasoning: validatedResult.reasoning
      };
      
    } catch (error) {
      this.logger.error(`Error classifying message: ${error.message}`);
      
      // Fallback to simple keyword-based classification
      const fallbackClassification = this.fallbackMessageClassification(message);
      this.logger.warn(`Using fallback classification: ${fallbackClassification.type}`);
      
      return fallbackClassification;
    }
  }


  private fallbackMessageClassification(message: string): { type: string; confidence: number; reasoning: string } {
    const lowerMessage = message.toLowerCase();
    
    const searchParamsKeywords = [ 'search parameters', 'generate parameters', 'linkedin parameters', 'search criteria', 'search filters', 'parameters', 'search config' ];
    
    const enrichmentsKeywords = [ 'enrichments', 'enrichment', 'enrich data', 'add fields', 'candidate data', 'profile data', 'additional data' ];
    
    const filtersKeywords = [
      'filters', 'filter', 'filtering', 'filter data', 'apply filters',
      'narrow down', 'refine search', 'filter results'
    ];
    
    const sortsKeywords = [
      'sort', 'sorting', 'order', 'rank', 'prioritize', 'arrange',
      'sort by', 'order by', 'ranking', 'priority'
    ];
    
    const completePlanKeywords = [
      'complete plan', 'full plan', 'entire plan', 'all components',
      'generate everything', 'create plan', 'build plan', 'setup plan'
    ];
    
    if (completePlanKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return { type: 'complete_plan', confidence: 0.8, reasoning: 'Detected complete plan keywords' };
    }
    
    if (searchParamsKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return { type: 'search_parameters', confidence: 0.7, reasoning: 'Detected search parameters keywords' };
    }
    
    if (enrichmentsKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return { type: 'enrichments', confidence: 0.7, reasoning: 'Detected enrichments keywords' };
    }
    
    if (filtersKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return { type: 'filters', confidence: 0.7, reasoning: 'Detected filters keywords' };
    }
    
    if (sortsKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return { type: 'sorts', confidence: 0.7, reasoning: 'Detected sorts keywords' };
    }
    
    // Default to general help
    return { type: 'general_help', confidence: 0.5, reasoning: 'No specific intent detected, defaulting to general help' };
  }

  /**
   * Clean up a client search query to make it more realistic
   * Removes overly demanding requirements that candidates don't explicitly mention in resumes/LinkedIn profiles
   * @param rawQuery - The original client search query
   * @param apiToken - API token for authentication
   * @returns The cleaned up realistic search query
   */
  async cleanupQuery(
    rawQuery: string,
    apiToken: string,
  ): Promise<string> {
    try {
      this.logger.log(`Cleaning up query: "${rawQuery}..."`);
      
      const { openAIclient: openai } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
      
      const systemPrompt = QueryCleanupPrompts.getSystemPrompt();
      const userPrompt = QueryCleanupPrompts.getUserPrompt(rawQuery);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: zodResponseFormat(queryCleanupSchema, 'queryCleanup'),
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        this.logger.warn('Query cleanup returned empty content, using original query');
        return rawQuery;
      }

      const parsed = JSON.parse(content);
      const validated = queryCleanupSchema.parse(parsed);
      
      this.logger.log(`Cleaned query: "${validated.cleanedQuery}..."`);
      if (validated.reasoning) {
        this.logger.debug(`Query cleanup reasoning: ${validated.reasoning}`);
      }
      
      return validated.cleanedQuery;
      
    } catch (error) {
      this.logger.error(`Error cleaning up query: ${error}`);
      // Return original query on error
      return rawQuery;
    }
  }

}
