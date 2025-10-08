import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { ParsedJobDescription } from '../../candidate-search/types/candidate-search-request.type';
import { FilterDescriptionProcessorService } from '../../candidate-sourcing/services/filter-description-processor.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

// Schemas for structured outputs
const enrichmentFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
});

const enrichmentConfigSchema = z.object({
  id: z.string(),
  modelName: z.string(),
  filterDescription: z.string(),
  prompt: z.string(),
  fields: z.array(enrichmentFieldSchema),
  selectedMetadataFields: z.array(z.string()),
  selectedModel: z.string(),
  bestOf: z.number().optional(),
  status: z.string().optional(),
  candidateEnrichmentId: z.string().optional(),
});

const enrichmentConfigArraySchema = z.object({
  enrichments: z.array(enrichmentConfigSchema),
});

const columnFilterSchema = z.object({
  fieldName: z.string(),
  operator: z.enum(['equals', 'greaterThan', 'lessThan', 'contains', 'notEquals']),
  value: z.union([z.string(), z.number()]),
  enabled: z.boolean(),
});

const columnFilterArraySchema = z.object({
  filters: z.array(columnFilterSchema),
});

const refinedSearchPlanSchema = z.object({
  searchFilterParameter: z.any(),
  enrichmentConfigs: z.array(enrichmentConfigSchema),
  columnFilters: z.array(columnFilterSchema),
});

const intentSchema = z.object({
  type: z.enum(['edit_enrichment', 'edit_filter', 'clarification', 'generate_search_params', 'general']),
  enrichmentId: z.string().optional(),
  questionId: z.string().optional(),
  searchType: z.string().optional(),
  searchCategory: z.string().optional(),
});

export type EnrichmentConfig = z.infer<typeof enrichmentConfigSchema>;
export type ColumnFilter = z.infer<typeof columnFilterSchema>;
export type Intent = z.infer<typeof intentSchema>;

@Injectable()
export class SearchPlanAIService {
  private readonly logger = new Logger(SearchPlanAIService.name);

  constructor(
    private workspaceQueryService: WorkspaceQueryService,
    private filterDescriptionProcessorService: FilterDescriptionProcessorService,
  ) {}

  async suggestEnrichments(parsedJD: ParsedJobDescription, apiToken: string): Promise<EnrichmentConfig[]> {
    try {
      const openaiClient = await this.getOpenAIClient(apiToken);
      
      const prompt = `Based on this job description, suggest 3-5 enrichments that would help identify the best candidates:

Job Title: ${parsedJD.jobTitle}
Required Skills: ${parsedJD.requiredSkills?.join(', ') || 'Not specified'}
Experience Level: ${parsedJD.experienceLevel || 'Not specified'}
Responsibilities: ${parsedJD.responsibilities?.join(', ') || 'Not specified'}
Company: ${parsedJD.company || 'Not specified'}
Location: ${parsedJD.location || 'Not specified'}

For each enrichment, provide:
1. A filter description (what to evaluate)
2. The model name (descriptive name for the enrichment)
3. The prompt to use for evaluation
4. Output fields (name, type, description)
5. Which candidate metadata fields to use as input

Format as JSON array of enrichment configs.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are an expert recruitment AI assistant specializing in candidate evaluation and enrichment strategies.' },
          { role: 'user', content: prompt },
        ],
        response_format: zodResponseFormat(enrichmentConfigArraySchema, 'enrichments'),
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content returned from LLM');
      }

      const result = JSON.parse(content);
      const enrichments = result.enrichments || [];
      
      // Process each enrichment through FilterDescriptionProcessorService
      const processedEnrichments = await Promise.all(
        enrichments.map(async (e: any) => {
          try {
            const processed = await this.filterDescriptionProcessorService.generateSingleFilter(e.filterDescription);
            return {
              ...e,
              ...processed,
              filterDescription: e.filterDescription,
              id: this.generateId(),
              status: 'pending',
            };
          } catch (error) {
            this.logger.warn(`Failed to process enrichment ${e.modelName}:`, error);
            return {
              ...e,
              id: this.generateId(),
              status: 'pending',
            };
          }
        })
      );
      
      this.logger.log(`Generated ${processedEnrichments.length} enrichment suggestions`);
      return processedEnrichments;
    } catch (error) {
      this.logger.error('Failed to suggest enrichments:', error);
      throw error;
    }
  }

  async generateColumnFilters(enrichments: EnrichmentConfig[], apiToken: string): Promise<ColumnFilter[]> {
    try {
      const openaiClient = await this.getOpenAIClient(apiToken);
      
      const enrichmentFields = enrichments.flatMap(e => e.fields);
      const prompt = `Based on these enrichment output fields, suggest column filters to identify top candidates:

Fields: ${JSON.stringify(enrichmentFields, null, 2)}

For each filter, provide:
- fieldName (which enrichment field to filter on)
- operator (equals, greaterThan, lessThan, contains, notEquals)
- value (threshold value)
- enabled (true/false)

Format as JSON array.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: zodResponseFormat(columnFilterArraySchema, 'filters'),
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content returned from LLM');
      }

      const result = JSON.parse(content);
      const filters = result.filters || [];
      
      this.logger.log(`Generated ${filters.length} column filters`);
      return filters;
    } catch (error) {
      this.logger.error('Failed to generate column filters:', error);
      throw error;
    }
  }

  async generateClarificationQuestions(parsedJD: ParsedJobDescription, apiToken: string): Promise<string[]> {
    try {
      const openaiClient = await this.getOpenAIClient(apiToken);
      
      const prompt = `Based on this job description, generate 3-5 clarification questions to understand priorities:

${JSON.stringify(parsedJD, null, 2)}

Ask about:
- Which skills/experiences are most critical vs nice-to-have
- Geographic flexibility
- Seniority level flexibility
- Industry experience importance
- Cultural fit priorities
- Salary expectations
- Remote work preferences

Format as numbered list.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content returned from LLM');
      }

      const questions = content.split('\n').filter(q => q.trim() && q.match(/^\d+\./));
      this.logger.log(`Generated ${questions.length} clarification questions`);
      return questions;
    } catch (error) {
      this.logger.error('Failed to generate clarification questions:', error);
      throw error;
    }
  }

  async analyzeIntent(message: string, apiToken: string): Promise<Intent> {
    try {
      const openaiClient = await this.getOpenAIClient(apiToken);
      
      const prompt = `Analyze this user message and determine the intent:

Message: "${message}"

Possible intents:
- edit_enrichment: User wants to modify an enrichment (look for enrichment names, IDs, or "change", "modify", "edit" + enrichment context)
- edit_filter: User wants to modify column filters (look for "filter", "show only", "exclude", "include" + field names)
- clarification: User is answering a clarification question
- generate_search_params: User wants to generate search parameters for a specific type (look for "generate", "create" + search type names)
- general: General conversation or unclear intent

Extract relevant IDs, search types, or other parameters if applicable.

Format as JSON with type and any extracted parameters.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: zodResponseFormat(intentSchema, 'intent'),
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content returned from LLM');
      }

      const result = JSON.parse(content);
      return result;
    } catch (error) {
      this.logger.error('Failed to analyze intent:', error);
      return { type: 'general' };
    }
  }

  async processNaturalLanguageEnrichmentEdit(
    searchFilterId: string,
    enrichmentId: string,
    userInput: string,
    apiToken: string
  ): Promise<void> {
    try {
      const openaiClient = await this.getOpenAIClient(apiToken);
      
      // This would need to be implemented to get the current search filter
      // For now, we'll create a mock structure
      const prompt = `Modify this enrichment based on user input:

User Request: "${userInput}"
Enrichment ID: ${enrichmentId}

Return updated enrichment config with modified:
- modelName (if name change requested)
- prompt (if evaluation criteria changed)
- fields (if output fields changed)
- selectedMetadataFields (if input fields changed)
- selectedModel (if model change requested)

Format as JSON.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: zodResponseFormat(enrichmentConfigSchema, 'enrichment'),
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content returned from LLM');
      }

      const updatedEnrichment = JSON.parse(content);
      
      // This would need to be implemented to update the search filter
      this.logger.log(`Processed enrichment edit for ${enrichmentId}:`, updatedEnrichment);
      
    } catch (error) {
      this.logger.error('Failed to process enrichment edit:', error);
      throw error;
    }
  }

  async processNaturalLanguageFilterEdit(
    searchFilterId: string,
    userInput: string,
    apiToken: string
  ): Promise<void> {
    try {
      const openaiClient = await this.getOpenAIClient(apiToken);
      
      const prompt = `Modify these column filters based on user input:

User Request: "${userInput}"

Return updated columnFilters array with:
- fieldName (which enrichment field to filter on)
- operator (equals, greaterThan, lessThan, contains, notEquals)
- value (threshold value)
- enabled (true/false)

Format as JSON array.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: zodResponseFormat(columnFilterArraySchema, 'filters'),
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content returned from LLM');
      }

      const result = JSON.parse(content);
      const updatedFilters = result.filters || [];
      
      // This would need to be implemented to update the search filter
      this.logger.log(`Processed filter edit for ${searchFilterId}:`, updatedFilters);
      
    } catch (error) {
      this.logger.error('Failed to process filter edit:', error);
      throw error;
    }
  }

  private async getOpenAIClient(apiToken: string): Promise<OpenAI> {
    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const openaiKey = await this.workspaceQueryService.getWorkspaceApiKey(workspaceId, 'openaikey');

      if (!openaiKey) {
        throw new Error('OpenAI API key not found in workspace API keys');
      }

      return new OpenAI({
        apiKey: openaiKey,
      });
    } catch (error) {
      this.logger.error('Error getting OpenAI client:', error);
      throw new Error('Failed to initialize OpenAI client');
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
