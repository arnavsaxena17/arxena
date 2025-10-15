import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
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



const columnFilterSchema = z.object({
  fieldName: z.string(),
  operator: z.enum(['equals', 'greaterThan', 'lessThan', 'contains', 'notEquals']),
  value: z.union([z.string(), z.number()]),
  enabled: z.boolean(),
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
  async processSearchParametersPrompt(
    jdText: string,
    prompt: string,
    responseFormat: string,
    apiToken: string
  ): Promise<any> {
    try {
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
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
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
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
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
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
