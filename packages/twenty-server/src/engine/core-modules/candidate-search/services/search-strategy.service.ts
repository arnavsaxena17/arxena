import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
    LinkedInClassicPeopleSearchRequest,
    LinkedInRecruiterPeopleSearchRequest,
    LinkedInSalesNavigatorPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { ClassicPeopleParameterName, ClassicPeopleStrategyDefinition } from '../schemas/classic-people-search.schema';
import { queryComplexitySchema } from '../schemas/query-understanding.schema';
import { RecruiterPeopleStrategyDefinition } from '../schemas/recruiter-people-search.schema';
import { SalesNavigatorPeopleStrategyDefinition } from '../schemas/sales-navigator-people-search.schema';
import {
    ClassicPeopleSearchStrategyResult, QueryUnderstanding, RecruiterPeopleSearchStrategyResult,
    SalesNavigatorPeopleSearchStrategyResult
} from '../types/candidate-search-request.type';
import { StreamProcessingService } from './stream-processing.service';

type ClassicPeopleSearchGenerationResult = {
  primary: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>;
  strategies?: ClassicPeopleSearchStrategyResult[];
};

type SalesNavigatorPeopleSearchGenerationResult = {
  primary: Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>;
  strategies?: SalesNavigatorPeopleSearchStrategyResult[];
};

type RecruiterPeopleSearchGenerationResult = {
  primary: Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>;
  strategies?: RecruiterPeopleSearchStrategyResult[];
};

@Injectable()
export class SearchStrategyService {
  private readonly logger = new Logger(SearchStrategyService.name);

  constructor(
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly streamProcessingService: StreamProcessingService,
  ) {}

  /**
   * Assess query complexity to determine if multiple strategies are needed
   * Uses LLM to analyze query understanding and determine complexity level
   */
  async assessQueryComplexity(
    openaiClient: OpenAI,
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<'simple' | 'moderate' | 'complex'> {
    const eventResult = sendEvent?.('status', { message: 'Assessing query complexity...' });
    if (eventResult === false) {
      this.logger.log('Stream aborted during query complexity assessment');
      // Default to moderate on abort
      return 'moderate';
    }

    const prompt = this.searchParametersPrompts.getQueryComplexityPrompt(
      queryUnderstanding,
      userMessage,
    );

    const stream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { 
          role: 'system' as const, 
          content: 'You are an expert recruiter and search strategist specializing in analyzing candidate search query complexity. Assess queries to determine the appropriate search strategy complexity level.' 
        },
        { role: 'user' as const, content: prompt },
      ],
      zodResponseFormat(queryComplexitySchema, 'queryComplexity'),
    );

    const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

    if (!fullContent) {
      this.logger.warn('Query complexity assessment returned empty content. Defaulting to moderate.');
      return 'moderate';
    }

    try {
      const parsed = JSON.parse(fullContent);
      const validated = queryComplexitySchema.parse(parsed);
      this.logger.log(`Query complexity assessment: ${validated.complexity} - ${validated.reasoning}`);
      
      return validated.complexity;
    } catch (error) {
      this.logger.error(`Failed to parse query complexity assessment: ${error}`);
      // Default to moderate on error
      return 'moderate';
    }
  }

  /**
   * Build a focused strategy definition from query understanding
   * This determines which parameters should be generated based on available information
   */
  buildFocusedStrategyFromQueryUnderstanding(
    queryUnderstanding: QueryUnderstanding,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): ClassicPeopleStrategyDefinition | SalesNavigatorPeopleStrategyDefinition | RecruiterPeopleStrategyDefinition {
    // Determine which parameters to generate based on query understanding
    const shouldGenerateKeywords = true; // Always required
    
    // Handle OR conditions for locations - use all locations in a unified strategy
    const shouldGenerateLocation = !!queryUnderstanding.locationHierarchy?.primary || 
                                   (queryUnderstanding.locationHierarchy?.secondary?.length ?? 0) > 0;
    const locationReasoning = shouldGenerateLocation
      ? queryUnderstanding.locationHierarchy?.secondary?.length
        ? `Multiple locations: ${queryUnderstanding.locationHierarchy.primary}, ${queryUnderstanding.locationHierarchy.secondary.join(', ')}`
        : `Location specified: ${queryUnderstanding.locationHierarchy.primary}`
      : 'No specific location provided in query';
    
    // Handle OR conditions for industries - use all industries in a unified strategy
    const shouldGenerateIndustry = (queryUnderstanding.industry?.length ?? 0) > 0;
    const industryReasoning = shouldGenerateIndustry && queryUnderstanding.industry
      ? queryUnderstanding.industry.length > 1
        ? `Multiple industries: ${queryUnderstanding.industry.join(', ')} (using OR condition)`
        : `Industry specified: ${queryUnderstanding.industry.join(', ')}`
      : 'No specific industry provided in query';
    
    // Handle OR conditions for companies - expand company groups if needed
    const shouldGenerateCompany = (queryUnderstanding.companyPreferences?.current?.length ?? 0) > 0;
    const companyReasoning = shouldGenerateCompany && queryUnderstanding.companyPreferences?.current
      ? queryUnderstanding.companyPreferences.current.length > 1
        ? `Multiple companies: ${queryUnderstanding.companyPreferences.current.join(', ')} (using OR condition)`
        : `Company preference specified: ${queryUnderstanding.companyPreferences.current.join(', ')}`
      : 'No company preference provided in query';
    
    const shouldGeneratePastCompany = (queryUnderstanding.companyPreferences?.past?.length ?? 0) > 0;
    const shouldGenerateSchool = false; // Rarely needed for focused searches
    
    // Use advanced keywords if certifications/technologies are critical
    const shouldGenerateAdvancedKeywords = (queryUnderstanding.certifications?.some(c => c.required) ?? false) ||
                                           (queryUnderstanding.regulatoryExperience?.length ?? 0) > 0 ||
                                           (queryUnderstanding.skills?.length ?? 0) > 0;

    // Build parameter selection based on search type
    if (searchType === 'classic') {
      return {
        id: 'focused-primary',
        label: 'Focused Search',
        goal: 'Generate precise search parameters matching the query requirements',
        aggressiveness: 'focused' as const,
        description: 'Optimized search with only necessary parameters',
        whenToUse: 'Use for well-defined queries with clear requirements',
        estimatedCandidateCount: { minimum: 40, maximum: 80 },
        filterFocus: 'Precision-focused filters',
        parameterSelection: {
          keywords: {
            shouldGenerate: shouldGenerateKeywords,
            reasoning: 'Keywords are required to anchor the search',
          },
          location: {
            shouldGenerate: shouldGenerateLocation,
            reasoning: shouldGenerateLocation 
              ? `Location specified: ${queryUnderstanding.locationHierarchy.primary}`
              : 'No specific location provided in query',
          },
          industry: {
            shouldGenerate: shouldGenerateIndustry,
            reasoning: shouldGenerateIndustry
              ? `Industry specified: ${queryUnderstanding.industry?.join(', ')}`
              : 'No specific industry provided in query',
          },
          company: {
            shouldGenerate: shouldGenerateCompany,
            reasoning: shouldGenerateCompany
              ? `Company preference specified: ${queryUnderstanding.companyPreferences?.current?.join(', ')}`
              : 'No company preference provided in query',
          },
          past_company: {
            shouldGenerate: shouldGeneratePastCompany,
            reasoning: shouldGeneratePastCompany
              ? `Past company preference specified: ${queryUnderstanding.companyPreferences?.past?.join(', ')}`
              : 'No past company preference provided in query',
          },
          school: {
            shouldGenerate: shouldGenerateSchool,
            reasoning: 'School filter not typically needed for focused searches',
          },
          advanced_keywords: {
            shouldGenerate: shouldGenerateAdvancedKeywords,
            reasoning: shouldGenerateAdvancedKeywords
              ? `Critical requirements need advanced keywords: ${[
                  ...(queryUnderstanding.certifications?.filter(c => c.required).map(c => c.name) || []),
                  ...(queryUnderstanding.regulatoryExperience || []),
                  ...(queryUnderstanding.skills?.slice(0, 3) || []),
                ].join(', ')}`
              : 'Advanced keywords not typically needed for focused searches',
          },
        },
      } as ClassicPeopleStrategyDefinition;
    } else if (searchType === 'sales_navigator') {
      return {
        id: 'focused-primary',
        label: 'Focused Search',
        goal: 'Generate precise search parameters matching the query requirements',
        aggressiveness: 'focused' as const,
        description: 'Optimized search with only necessary parameters',
        whenToUse: 'Use for well-defined queries with clear requirements',
        estimatedCandidateCount: { minimum: 40, maximum: 80 },
        filterFocus: 'Precision-focused filters',
        parameterSelection: {
          keywords: {
            shouldGenerate: shouldGenerateKeywords,
            reasoning: 'Keywords are required to anchor the search',
          },
          location: {
            shouldGenerate: shouldGenerateLocation,
            reasoning: locationReasoning,
          },
          industry: {
            shouldGenerate: shouldGenerateIndustry,
            reasoning: industryReasoning,
          },
          company: {
            shouldGenerate: shouldGenerateCompany,
            reasoning: companyReasoning,
          },
          past_company: {
            shouldGenerate: shouldGeneratePastCompany,
            reasoning: shouldGeneratePastCompany
              ? `Past company preference specified: ${queryUnderstanding.companyPreferences?.past?.join(', ')}`
              : 'No past company preference provided in query',
          },
          role: {
            shouldGenerate: !!queryUnderstanding.primaryRole,
            reasoning: queryUnderstanding.primaryRole
              ? `Role specified: ${queryUnderstanding.primaryRole}`
              : 'No specific role provided in query',
          },
          function: {
            shouldGenerate: false,
            reasoning: 'Function filter not typically needed for focused searches',
          },
          seniority: {
            shouldGenerate: !!queryUnderstanding.seniorityLevel,
            reasoning: queryUnderstanding.seniorityLevel
              ? `Seniority specified: ${queryUnderstanding.seniorityLevel}`
              : 'No seniority level provided in query',
          },
          school: {
            shouldGenerate: shouldGenerateSchool,
            reasoning: 'School filter not typically needed for focused searches',
          },
        },
      } as SalesNavigatorPeopleStrategyDefinition;
    } else {
      // recruiter
      return {
        id: 'focused-primary',
        label: 'Focused Search',
        goal: 'Generate precise search parameters matching the query requirements',
        aggressiveness: 'focused' as const,
        description: 'Optimized search with only necessary parameters',
        whenToUse: 'Use for well-defined queries with clear requirements',
        estimatedCandidateCount: { minimum: 40, maximum: 80 },
        filterFocus: 'Precision-focused filters',
        parameterSelection: {
          keywords: {
            shouldGenerate: shouldGenerateKeywords,
            reasoning: 'Keywords are required to anchor the search',
          },
          location: {
            shouldGenerate: shouldGenerateLocation,
            reasoning: locationReasoning,
          },
          industry: {
            shouldGenerate: shouldGenerateIndustry,
            reasoning: industryReasoning,
          },
          role: {
            shouldGenerate: !!queryUnderstanding.primaryRole,
            reasoning: queryUnderstanding.primaryRole
              ? `Role specified: ${queryUnderstanding.primaryRole}`
              : 'No specific role provided in query',
          },
          company: {
            shouldGenerate: shouldGenerateCompany,
            reasoning: companyReasoning,
          },
          past_company: {
            shouldGenerate: shouldGeneratePastCompany,
            reasoning: shouldGeneratePastCompany
              ? `Past company preference specified: ${queryUnderstanding.companyPreferences?.past?.join(', ')}`
              : 'No past company preference provided in query',
          },
          school: {
            shouldGenerate: shouldGenerateSchool,
            reasoning: 'School filter not typically needed for focused searches',
          },
          skills: {
            shouldGenerate: (queryUnderstanding.skills?.length ?? 0) > 0,
            reasoning: (queryUnderstanding.skills?.length ?? 0) > 0
              ? `Skills specified: ${queryUnderstanding.skills?.join(', ')}`
              : 'No specific skills provided in query',
          },
          seniority: {
            shouldGenerate: !!queryUnderstanding.seniorityLevel,
            reasoning: queryUnderstanding.seniorityLevel
              ? `Seniority specified: ${queryUnderstanding.seniorityLevel}`
              : 'No seniority level provided in query',
          },
        },
      } as RecruiterPeopleStrategyDefinition;
    }
  }

  /**
   * Build an alternative strategy definition with slightly broader parameters
   * Used for moderate complexity queries to provide a complementary search
   */
  buildAlternativeStrategyFromQueryUnderstanding(
    queryUnderstanding: QueryUnderstanding,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): ClassicPeopleStrategyDefinition | SalesNavigatorPeopleStrategyDefinition | RecruiterPeopleStrategyDefinition {
    // Alternative strategy is slightly broader - include more optional parameters
    const focusedStrategy = this.buildFocusedStrategyFromQueryUnderstanding(queryUnderstanding, searchType);
    
    // Make it "balanced" instead of "focused" and adjust parameter selection to be slightly broader
    if (searchType === 'classic') {
      const strategy = focusedStrategy as ClassicPeopleStrategyDefinition;
      return {
        ...strategy,
        id: 'alternative-1',
        label: 'Alternative Approach',
        aggressiveness: 'balanced' as const,
        goal: 'Alternative search strategy with different filter balance',
        description: 'Alternative parameter set with adjusted filters',
        whenToUse: 'Use if primary search yields insufficient results',
        parameterSelection: {
          ...strategy.parameterSelection,
          // Include location even if not explicitly specified (broader)
          location: {
            shouldGenerate: true, // Always include for broader alternative
            reasoning: strategy.parameterSelection.location.shouldGenerate 
              ? 'Location included for alternative search approach'
              : 'Including location for broader alternative search',
          },
          // Include industry even if not explicitly specified (broader)
          industry: {
            shouldGenerate: true, // Always include for broader alternative
            reasoning: strategy.parameterSelection.industry.shouldGenerate
              ? 'Industry included for alternative search approach'
              : 'Including industry for broader alternative search',
          },
        },
      };
    } else if (searchType === 'sales_navigator') {
      const strategy = focusedStrategy as SalesNavigatorPeopleStrategyDefinition;
      return {
        ...strategy,
        id: 'alternative-1',
        label: 'Alternative Approach',
        aggressiveness: 'balanced' as const,
        goal: 'Alternative search strategy with different filter balance',
        description: 'Alternative parameter set with adjusted filters',
        whenToUse: 'Use if primary search yields insufficient results',
        parameterSelection: {
          ...strategy.parameterSelection,
          location: {
            shouldGenerate: strategy.parameterSelection.location.shouldGenerate || true,
            reasoning: 'Including location for broader alternative search',
          },
          industry: {
            shouldGenerate: strategy.parameterSelection.industry.shouldGenerate || true,
            reasoning: 'Including industry for broader alternative search',
          },
        },
      };
    } else {
      const strategy = focusedStrategy as RecruiterPeopleStrategyDefinition;
      return {
        ...strategy,
        id: 'alternative-1',
        label: 'Alternative Approach',
        aggressiveness: 'balanced' as const,
        goal: 'Alternative search strategy with different filter balance',
        description: 'Alternative parameter set with adjusted filters',
        whenToUse: 'Use if primary search yields insufficient results',
        parameterSelection: {
          ...strategy.parameterSelection,
          location: {
            shouldGenerate: strategy.parameterSelection.location.shouldGenerate || true,
            reasoning: 'Including location for broader alternative search',
          },
          industry: {
            shouldGenerate: strategy.parameterSelection.industry.shouldGenerate || true,
            reasoning: 'Including industry for broader alternative search',
          },
        },
      };
    }
  }

  /**
   * Create strategy result from parameters
   */
  createStrategyResultFromParameters(
    parameters: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> | 
                 Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'> | 
                 Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    strategyDef: {
      id: string;
      label: string;
      goal: string;
      aggressiveness: 'focused' | 'balanced' | 'broad';
      description: string;
      whenToUse: string;
      estimatedCandidateCount: { minimum: number; maximum: number };
      filterFocus: string;
    },
  ): ClassicPeopleSearchStrategyResult | SalesNavigatorPeopleSearchStrategyResult | RecruiterPeopleSearchStrategyResult {
    if (searchType === 'classic') {
      return {
        ...strategyDef,
        parameterRationales: {} as Record<ClassicPeopleParameterName, string>,
        parameters: parameters as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
      } as ClassicPeopleSearchStrategyResult;
    } else if (searchType === 'sales_navigator') {
      return {
        ...strategyDef,
        parameterRationales: {} as Record<string, string>,
        parameters: parameters as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>,
      } as SalesNavigatorPeopleSearchStrategyResult;
    } else {
      return {
        ...strategyDef,
        parameterRationales: {} as Record<string, string>,
        parameters: parameters as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
      } as RecruiterPeopleSearchStrategyResult;
    }
  }
}

