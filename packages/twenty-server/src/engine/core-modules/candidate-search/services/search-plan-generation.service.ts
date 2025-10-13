import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { ParsedJobDescription } from '../../candidate-search/types/candidate-search-request.type';
import { LinkedInSearchResult } from '../../candidate-search/types/linkedin-search-result.type';
import { EnrichmentsPrompts } from '../prompts/enrichments-prompts';
import { FiltersPrompts } from '../prompts/filters-prompts';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import {
  EnrichmentsResponse,
  FiltersResponse,
  JDComplexityAnalysis,
  SearchParametersResponse
} from '../types/search-plan.types';

// Zod schemas for response validation
const searchVariationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['broad', 'narrow', 'targeted']),
  description: z.string(),
  searchParameters: z.any(), // Will be validated based on search type
  expectedResultSize: z.enum(['small', 'medium', 'large']),
  reasoning: z.string()
});

const searchParametersResponseSchema = z.object({
  variations: z.array(searchVariationSchema),
  overallStrategy: z.string(),
  complexity: z.enum(['simple', 'moderate', 'complex']),
  reasoning: z.string(),
  metadata: z.object({
    searchType: z.enum(['classic', 'sales_navigator', 'recruiter']),
    searchCategory: z.enum(['people', 'companies', 'jobs']),
    generatedAt: z.string()
  })
});

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
  condition: z.enum(['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'contains', 'not_contains', 'begins_with', 'ends_with', 'empty', 'not_empty', 'between', 'by_value']),
  value: z.any().nullable(),
  value2: z.any().nullable(),
  options: z.array(z.string()).nullable()
});

const candidateSearchFilterSchema = z.object({
  field: z.string(),
  type: z.enum(['text_search', 'dropdown_selection', 'date_range', 'numeric_range', 'boolean', 'multi_select', 'location', 'company', 'industry', 'seniority', 'network_distance', 'experience_range', 'salary_range']),
  label: z.string(),
  value: z.any().nullable(),
  values: z.array(z.any()).nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  options: z.array(z.string()).nullable(),
  placeholder: z.string().nullable()
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
export class SearchPlanGenerationService {
  private readonly logger = new Logger(SearchPlanGenerationService.name);

  constructor() {}

  async generateSearchParameters(
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'jobs',
    apiToken: string
  ): Promise<SearchParametersResponse> {
    try {
      this.logger.log(`Generating search parameters for ${searchType} ${searchCategory} search`);
      
      const openai = this.getOpenAIClient(apiToken);
      const complexity = this.analyzeJDComplexity(parsedJD);
      
      const systemPrompt = SearchParametersPrompts.getSystemPrompt();
      const userPrompt = SearchParametersPrompts.getUserPrompt(parsedJD, searchType, searchCategory);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: zodResponseFormat(
          searchParametersResponseSchema,
          'searchParametersResponse',
        ),
      });

      const response = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Validate response
      const validatedResponse = searchParametersResponseSchema.parse(response);
      
      // Ensure searchParameters is present for each variation
      validatedResponse.variations.forEach(variation => {
        if (!variation.searchParameters) {
          variation.searchParameters = {};
        }
      });
      
      // Add metadata
      validatedResponse.metadata = {
        searchType,
        searchCategory,
        generatedAt: new Date().toISOString()
      };

      this.logger.log(`Generated ${validatedResponse.variations.length} search variations`);
      return validatedResponse as SearchParametersResponse;
      
    } catch (error) {
      this.logger.error('Error generating search parameters:', error);
      throw new Error(`Failed to generate search parameters: ${error.message}`);
    }
  }

  async generateEnrichments(
    parsedJD: ParsedJobDescription,
    searchParameters: SearchParametersResponse,
    sampleResults: LinkedInSearchResult[] | undefined,
    apiToken: string
  ): Promise<EnrichmentsResponse> {
    try {
      this.logger.log(`Generating enrichments for ${searchParameters.metadata.searchType} search`);
      
      const openai = this.getOpenAIClient(apiToken);
      
      const systemPrompt = EnrichmentsPrompts.getSystemPrompt();
      const userPrompt = EnrichmentsPrompts.getUserPrompt(parsedJD, searchParameters, sampleResults);
      
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
    try {
      this.logger.log(`Generating filters for enrichments: ${enrichments.enrichments.map(e => e.name).join(', ')}`);
      
      const openai = this.getOpenAIClient(apiToken);
      
      const systemPrompt = FiltersPrompts.getSystemPrompt();
      const userPrompt = FiltersPrompts.getUserPrompt(parsedJD, enrichments, sampleResults, dataDistribution);
      
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

  private analyzeJDComplexity(parsedJD: ParsedJobDescription): JDComplexityAnalysis {
    const factors = {
      skillsCount: parsedJD.requiredSkills.length + parsedJD.preferredSkills.length,
      seniorityLevels: this.extractSeniorityLevels(parsedJD),
      roleDiversity: this.calculateRoleDiversity(parsedJD),
      locationSpecificity: !parsedJD.remoteWork && parsedJD.location !== 'Remote',
      industrySpecificity: parsedJD.industry !== 'Any',
      experienceRange: this.extractExperienceRange(parsedJD)
    };

    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    
    // Simple: Basic requirements, single role, common skills
    if (factors.skillsCount <= 5 && factors.roleDiversity <= 1 && !factors.locationSpecificity) {
      complexity = 'simple';
    }
    // Complex: Many requirements, multiple roles, specific location/industry
    else if (factors.skillsCount >= 10 || factors.roleDiversity >= 3 || (factors.locationSpecificity && factors.industrySpecificity)) {
      complexity = 'complex';
    }
    // Moderate: Everything else
    else {
      complexity = 'moderate';
    }

    return {
      complexity,
      factors,
      reasoning: `Complexity determined by: ${factors.skillsCount} skills, ${factors.roleDiversity} role types, ${factors.locationSpecificity ? 'specific' : 'flexible'} location, ${factors.industrySpecificity ? 'specific' : 'general'} industry`
    };
  }

  private extractSeniorityLevels(parsedJD: ParsedJobDescription): string[] {
    const levels: string[] = [];
    const text = `${parsedJD.jobTitle} ${parsedJD.responsibilities.join(' ')} ${parsedJD.qualifications.join(' ')}`.toLowerCase();
    
    if (text.includes('executive') || text.includes('c-level') || text.includes('chief')) levels.push('executive');
    if (text.includes('senior') || text.includes('lead') || text.includes('principal')) levels.push('senior');
    if (text.includes('mid') || text.includes('intermediate')) levels.push('mid');
    if (text.includes('junior') || text.includes('entry') || text.includes('associate')) levels.push('junior');
    
    return levels.length > 0 ? levels : ['mid']; // Default to mid if unclear
  }

  private calculateRoleDiversity(parsedJD: ParsedJobDescription): number {
    const roles = new Set();
    const text = `${parsedJD.jobTitle} ${parsedJD.responsibilities.join(' ')}`.toLowerCase();
    
    if (text.includes('engineer') || text.includes('developer')) roles.add('engineering');
    if (text.includes('manager') || text.includes('director')) roles.add('management');
    if (text.includes('designer') || text.includes('ux') || text.includes('ui')) roles.add('design');
    if (text.includes('analyst') || text.includes('data')) roles.add('analytics');
    if (text.includes('sales') || text.includes('marketing')) roles.add('business');
    
    return roles.size;
  }

  private extractExperienceRange(parsedJD: ParsedJobDescription): { min: number; max: number } {
    const text = `${parsedJD.responsibilities.join(' ')} ${parsedJD.qualifications.join(' ')}`.toLowerCase();
    
    // Look for experience patterns
    const experienceMatch = text.match(/(\d+)[\s-]*(\d+)?\s*years?/);
    if (experienceMatch) {
      const min = parseInt(experienceMatch[1]);
      const max = experienceMatch[2] ? parseInt(experienceMatch[2]) : min + 5;
      return { min, max };
    }
    
    // Default based on seniority
    const seniority = this.extractSeniorityLevels(parsedJD)[0];
    switch (seniority) {
      case 'executive': return { min: 10, max: 20 };
      case 'senior': return { min: 5, max: 15 };
      case 'mid': return { min: 2, max: 8 };
      case 'junior': return { min: 0, max: 3 };
      default: return { min: 2, max: 8 };
    }
  }

  private getOpenAIClient(apiToken: string): OpenAI {
    return new OpenAI({
      apiKey: apiToken,
    });
  }
}
