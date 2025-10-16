import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { EnrichmentsPrompts } from '../prompts/enrichments-prompts';
import { FiltersPrompts } from '../prompts/filters-prompts';
import { ParsedJobDescription } from '../types/candidate-search-request.type';
import { LinkedInSearchResult } from '../types/linkedin-search-result.type';
import {
  EnrichmentsResponse,
  FiltersResponse,
  SearchParametersResponse
} from '../types/search-plan.types';


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
      z.tuple([z.number(), z.number()]),
      z.tuple([z.string(), z.string()]),
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
      z.tuple([z.number(), z.number()]),
      z.tuple([z.string(), z.string()]),
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
      z.tuple([z.number(), z.number()]), // numeric range
      z.tuple([z.string(), z.string()]), // date range or string range
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

@Injectable()
export class SearchGenerationService {
  private readonly logger = new Logger(SearchGenerationService.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
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
    // Validate and normalize parsedJD structure
    const normalizedParsedJD = this.validateAndNormalizeParsedJD(parsedJD);
    
    try {
      this.logger.log(`Generating enrichments for ${searchParameters.metadata.searchType} search`);
      
      const { openAIclient: openai } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
      
      const systemPrompt = EnrichmentsPrompts.getSystemPrompt();
      const userPrompt = EnrichmentsPrompts.getUserPrompt(normalizedParsedJD, searchParameters, sampleResults);
      
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

      const response = JSON.parse(completion.choices[0].message.content || '{}');
      
      this.logger.log(`response: ${JSON.stringify(response, null, 2)}`);
      // Validate response
      const validatedResponse = enrichmentsResponseSchema.parse(response);
      
      // Add metadata
      validatedResponse.metadata = {
        generatedAt: new Date().toISOString(),
        hasSampleData: !!sampleResults,
        sampleDataSize: sampleResults?.length ?? null
      };

      this.logger.log(`Generated ${validatedResponse.enrichments.length} enrichments`);
      return validatedResponse as EnrichmentsResponse;
      
    } catch (error) {
      this.logger.error('Error generating enrichments:', error);
      throw new Error(`Failed to generate enrichments: ${error.message}`);
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


}
