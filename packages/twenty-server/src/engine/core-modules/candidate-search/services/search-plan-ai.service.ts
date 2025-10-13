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
  enumValues: z.array(z.string()).nullable(),
});

const enrichmentConfigSchema = z.object({
  id: z.string(),
  modelName: z.string(),
  filterDescription: z.string(),
  prompt: z.string(),
  fields: z.array(enrichmentFieldSchema),
  selectedMetadataFields: z.array(z.string()),
  selectedModel: z.string(),
  bestOf: z.number().nullable(),
  status: z.string().nullable(),
  candidateEnrichmentId: z.string().nullable(),
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
  enrichmentId: z.string().nullable(),
  questionId: z.string().nullable(),
  searchType: z.string().nullable(),
  searchCategory: z.string().nullable(),
});

// Zod schemas for different response formats
const locationFilterSchema = z.object({
  include: z.array(z.string()).nullable(),
  exclude: z.array(z.string()).nullable(),
});

const industryFilterSchema = z.object({
  include: z.array(z.string()).nullable(),
  exclude: z.array(z.string()).nullable(),
});

const seniorityFilterSchema = z.object({
  include: z.array(z.string()).nullable(),
  exclude: z.array(z.string()).nullable(),
});

const headcountRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
});

const salaryRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  currency: z.string(),
});

const annualRevenueSchema = z.object({
  currency: z.string(),
  min: z.number(),
  max: z.number(),
});

const locationObjectSchema = z.object({
  id: z.string(),
  priority: z.string(),
  scope: z.string(),
  title: z.string(),
});

const roleObjectSchema = z.object({
  keywords: z.string(),
  priority: z.string(),
  scope: z.string(),
});

const skillsObjectSchema = z.object({
  keywords: z.string(),
  priority: z.string(),
});

const advancedKeywordsSchema = z.object({
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  school: z.string().nullable(),
});

// Search Parameters Schemas
const salesNavigatorPeopleSchema = z.object({
  keywords: z.string(),
  location: locationFilterSchema,
  industry: industryFilterSchema,
  company_headcount: z.array(headcountRangeSchema),
  seniority: seniorityFilterSchema,
  network_distance: z.array(z.number()),
  tenure_at_company: z.array(headcountRangeSchema),
});

const salesNavigatorCompaniesSchema = z.object({
  keywords: z.string(),
  industry: industryFilterSchema,
  location: locationFilterSchema,
  headcount: z.array(headcountRangeSchema),
  annual_revenue: annualRevenueSchema,
  technologies: z.array(z.string()),
  recent_activities: z.array(z.string()),
});

const recruiterPeopleSchema = z.object({
  keywords: z.string(),
  locale: z.string(),
  location: z.array(locationObjectSchema),
  role: z.array(roleObjectSchema),
  skills: z.array(skillsObjectSchema),
  company_headcount: z.array(headcountRangeSchema),
  seniority: seniorityFilterSchema,
  spotlights: z.array(z.string()),
});

const jobDescriptionSchema = z.object({
  jobTitle: z.string(),
  company: z.string(),
  location: z.string(),
  industry: z.string(),
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  experienceLevel: z.string(),
  education: z.array(z.string()),
  keywords: z.array(z.string()),
  responsibilities: z.array(z.string()),
  qualifications: z.array(z.string()),
  benefits: z.array(z.string()),
  employmentType: z.string(),
  remoteWork: z.boolean(),
  salaryRange: salaryRangeSchema.nullable(),
});

const classicPeopleSchema = z.object({
  keywords: z.string(),
  industry: z.array(z.string()),
  location: z.array(z.string()),
  network_distance: z.array(z.number()),
  company: z.array(z.string()),
  past_company: z.array(z.string()),
  school: z.array(z.string()),
  advanced_keywords: advancedKeywordsSchema,
});

const classicCompaniesSchema = z.object({
  keywords: z.string(),
  industry: z.array(z.string()),
  location: z.array(z.string()),
  has_job_offers: z.boolean(),
  headcount: z.array(headcountRangeSchema),
  network_distance: z.array(z.number()),
});

const classicJobsSchema = z.object({
  keywords: z.string(),
  sort_by: z.string(),
  date_posted: z.number(),
  location: z.array(z.string()),
  industry: z.array(z.string()),
  seniority: z.array(z.string()),
  function: z.array(z.string()),
  job_type: z.array(z.string()),
  company: z.array(z.string()),
  presence: z.array(z.string()),
  easy_apply: z.boolean(),
  minimum_salary: z.object({
    currency: z.string(),
    value: z.number(),
  }),
});

// Enrichment Schemas
const skillsExtractionSchema = z.object({
  primarySkills: z.string(),
  secondarySkills: z.string(),
  yearsOfExperience: z.number(),
  skillLevel: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']),
});

const culturalFitAssessmentSchema = z.object({
  communicationStyle: z.enum(['Direct', 'Diplomatic', 'Collaborative', 'Assertive']),
  workStyle: z.enum(['Independent', 'Team-oriented', 'Mixed']),
  culturalFitScore: z.number().min(1).max(10),
  leadershipPotential: z.boolean(),
});

const experienceAnalysisSchema = z.object({
  totalExperience: z.number(),
  relevantExperience: z.number(),
  industryExperience: z.array(z.string()),
  careerProgression: z.enum(['Steady', 'Rapid', 'Stagnant', 'Variable']),
  leadershipExperience: z.boolean(),
});

const educationAssessmentSchema = z.object({
  highestDegree: z.enum(['High School', 'Associate', 'Bachelor', 'Master', 'PhD']),
  fieldOfStudy: z.string(),
  institutionTier: z.enum(['Top-tier', 'Mid-tier', 'Standard']),
  educationRelevance: z.enum(['Highly Relevant', 'Moderately Relevant', 'Not Relevant']),
});

const salaryExpectationSchema = z.object({
  expectedSalary: z.number(),
  salaryNegotiable: z.boolean(),
  benefitsPriority: z.array(z.string()),
  compensationSatisfaction: z.enum(['Satisfied', 'Neutral', 'Dissatisfied']),
});

// Filter Schemas
const handsontableFilterSchema = z.object({
  column: z.string(),
  type: z.enum(['text', 'numeric', 'dropdown', 'checkbox', 'date']),
  condition: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  value2: z.union([z.string(), z.number()]).nullable(),
  options: z.array(z.string()).nullable(),
});

const candidateSearchFilterSchema = z.object({
  field: z.string(),
  type: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]).nullable(),
  values: z.array(z.union([z.string(), z.number()])).nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  placeholder: z.string().nullable(),
  options: z.array(z.string()).nullable(),
});

const unifiedFilterSchema = z.object({
  handsontable: z.array(handsontableFilterSchema),
  candidateSearch: z.array(candidateSearchFilterSchema),
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
      return { 
        type: 'general',
        enrichmentId: null,
        questionId: null,
        searchType: null,
        searchCategory: null,
      };
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

  async processSearchParametersPrompt(
    jdText: string,
    prompt: string,
    responseFormat: string,
    apiToken: string
  ): Promise<any> {
    try {
      const openaiClient = await this.getOpenAIClient(apiToken);
      const zodSchema = this.getSearchParametersSchema(responseFormat);
      
      const systemPrompt = `You are an expert LinkedIn search parameter generator. Based on the job description and user prompt, generate LinkedIn search parameters in the specified format.

Response Format: ${responseFormat}

Generate search parameters that will help find the best candidates for this role. Ensure all required fields are populated with realistic values based on the job description.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Job Description:\n${jdText}\n\nUser Prompt:\n${prompt}` },
        ],
        response_format: zodResponseFormat(zodSchema, 'search_parameters'),
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content returned from LLM');
      }

      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Failed to process search parameters prompt:', error);
      throw error;
    }
  }

  async processEnrichmentsPrompt(
    jdText: string,
    prompt: string,
    responseFormat: string,
    apiToken: string
  ): Promise<any> {
    try {
      const openaiClient = await this.getOpenAIClient(apiToken);
      const zodSchema = this.getEnrichmentsSchema(responseFormat);
      
      const systemPrompt = `You are an expert candidate enrichment specialist. Based on the job description and user prompt, generate enrichment configurations that will help evaluate candidates.

Response Format: ${responseFormat}

Generate enrichment configurations that will provide valuable insights about candidates for this role. Ensure all required fields are populated with realistic values based on the job description.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Job Description:\n${jdText}\n\nUser Prompt:\n${prompt}` },
        ],
        response_format: zodResponseFormat(zodSchema, 'enrichments'),
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content returned from LLM');
      }

      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Failed to process enrichments prompt:', error);
      throw error;
    }
  }

  async processFiltersPrompt(
    jdText: string,
    prompt: string,
    responseFormat: string,
    apiToken: string
  ): Promise<any> {
    try {
      const openaiClient = await this.getOpenAIClient(apiToken);
      const zodSchema = this.getFiltersSchema(responseFormat);
      
      const systemPrompt = `You are an expert candidate filtering specialist. Based on the job description and user prompt, generate filter configurations that will help identify the best candidates.

Response Format: ${responseFormat}

Generate filter configurations that will effectively narrow down candidates to those most suitable for this role. Ensure all required fields are populated with realistic values based on the job description.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Job Description:\n${jdText}\n\nUser Prompt:\n${prompt}` },
        ],
        response_format: zodResponseFormat(zodSchema, 'filters'),
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content returned from LLM');
      }

      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Failed to process filters prompt:', error);
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

  /**
   * Get Zod schema for search parameters based on response format
   */
  private getSearchParametersSchema(responseFormat: string): z.ZodSchema {
    switch (responseFormat) {
      case 'sales_navigator_people':
        return salesNavigatorPeopleSchema;
      case 'sales_navigator_companies':
        return salesNavigatorCompaniesSchema;
      case 'recruiter_people':
        return recruiterPeopleSchema;
      case 'job_description':
        return jobDescriptionSchema;
      case 'classic_people':
        return classicPeopleSchema;
      case 'classic_companies':
        return classicCompaniesSchema;
      case 'classic_jobs':
        return classicJobsSchema;
      default:
        this.logger.warn(`Unknown search parameters format: ${responseFormat}, using default`);
        return z.object({
          keywords: z.string(),
          location: z.string().nullable(),
          industry: z.string().nullable(),
        });
    }
  }

  /**
   * Get Zod schema for enrichments based on response format
   */
  private getEnrichmentsSchema(responseFormat: string): z.ZodSchema {
    switch (responseFormat) {
      case 'skills_extraction':
        return skillsExtractionSchema;
      case 'cultural_fit_assessment':
        return culturalFitAssessmentSchema;
      case 'experience_analysis':
        return experienceAnalysisSchema;
      case 'education_assessment':
        return educationAssessmentSchema;
      case 'salary_expectation':
        return salaryExpectationSchema;
      default:
        this.logger.warn(`Unknown enrichments format: ${responseFormat}, using default`);
        return z.object({
          primarySkills: z.string(),
          experienceLevel: z.string(),
          culturalFit: z.string(),
        });
    }
  }

  /**
   * Get Zod schema for filters based on response format
   */
  private getFiltersSchema(responseFormat: string): z.ZodSchema {
    switch (responseFormat) {
      case 'handsontable_basic':
      case 'handsontable_advanced':
      case 'enrichment_filters':
      case 'conversation_filters':
        return z.array(handsontableFilterSchema);
      case 'candidate_search_basic':
      case 'candidate_search_advanced':
        return z.array(candidateSearchFilterSchema);
      case 'unified_filtering':
      case 'job_specific_filters':
        return unifiedFilterSchema;
      default:
        this.logger.warn(`Unknown filters format: ${responseFormat}, using default`);
        return z.array(z.object({
          field: z.string(),
          operator: z.string(),
          value: z.any(),
        }));
    }
  }
}
