import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { ClassicPeopleParameterName } from '../schemas/classic-people-search.schema';
import { searchStrategyTextSchema } from '../schemas/query-understanding.schema';
import {
  ClassicPeopleSearchStrategyResult, QueryUnderstanding, RecruiterPeopleSearchStrategyResult,
  SalesNavigatorPeopleSearchStrategyResult
} from '../types/candidate-search-request.type';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class SearchStrategyService {
  private readonly logger = new Logger(SearchStrategyService.name);

  constructor(
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly streamProcessingService: StreamProcessingService,
  ) {}

  /**
   * Format QueryUnderstanding as natural language text for passing between LLM calls
   */
  formatQueryUnderstandingAsText(queryUnderstanding: QueryUnderstanding, userMessage: string): string {
    const parts: string[] = [];

    parts.push(`ORIGINAL USER QUERY: "${userMessage}"`);
    parts.push('');

    parts.push('QUERY UNDERSTANDING:');
    parts.push(`Primary Role: ${queryUnderstanding.primaryRole}`);
    
    if (queryUnderstanding.roleVariations.length > 0) {
      parts.push(`Role Variations: ${queryUnderstanding.roleVariations.join(', ')} (${queryUnderstanding.roleVariations.length} variations)`);
    }

    if (queryUnderstanding.industry && queryUnderstanding.industry.length > 0) {
      parts.push(`Industry: ${queryUnderstanding.industry.join(', ')} (${queryUnderstanding.industry.length} industries)`);
    } else {
      parts.push('Industry: Not specified');
    }

    parts.push('Location Hierarchy:');
    parts.push(`  - Primary: ${queryUnderstanding.locationHierarchy.primary || 'Not specified'}`);
    if (queryUnderstanding.locationHierarchy.secondary && queryUnderstanding.locationHierarchy.secondary.length > 0) {
      parts.push(`  - Secondary: ${queryUnderstanding.locationHierarchy.secondary.join(', ')} (${queryUnderstanding.locationHierarchy.secondary.length} locations)`);
    }
    if (queryUnderstanding.locationHierarchy.regional) {
      parts.push(`  - Regional: ${queryUnderstanding.locationHierarchy.regional}`);
    }

    if (queryUnderstanding.companyPreferences) {
      parts.push('Company Preferences:');
      if (queryUnderstanding.companyPreferences.current && queryUnderstanding.companyPreferences.current.length > 0) {
        parts.push(`  - Current: ${queryUnderstanding.companyPreferences.current.join(', ')} (${queryUnderstanding.companyPreferences.current.length} companies)`);
      }
      if (queryUnderstanding.companyPreferences.past && queryUnderstanding.companyPreferences.past.length > 0) {
        parts.push(`  - Past: ${queryUnderstanding.companyPreferences.past.join(', ')} (${queryUnderstanding.companyPreferences.past.length} companies)`);
      }
      if (queryUnderstanding.companyPreferences.types && queryUnderstanding.companyPreferences.types.length > 0) {
        parts.push(`  - Types: ${queryUnderstanding.companyPreferences.types.join(', ')}`);
      }
    }

    if (queryUnderstanding.seniorityLevel) {
      parts.push(`Seniority Level: ${queryUnderstanding.seniorityLevel}`);
    }

    if (queryUnderstanding.domainContext) {
      parts.push(`Domain Context: ${queryUnderstanding.domainContext}`);
    }

    if (queryUnderstanding.skills && queryUnderstanding.skills.length > 0) {
      parts.push(`Skills: ${queryUnderstanding.skills.join(', ')}`);
    }

    if (queryUnderstanding.experienceRequirements) {
      parts.push(`Experience Requirements: ${queryUnderstanding.experienceRequirements}`);
    }

    if (queryUnderstanding.explicitRequirements.length > 0) {
      parts.push(`Explicit Requirements: ${queryUnderstanding.explicitRequirements.join(', ')}`);
    }

    if (queryUnderstanding.preferredRequirements.length > 0) {
      parts.push(`Preferred Requirements: ${queryUnderstanding.preferredRequirements.join(', ')}`);
    }

    if (queryUnderstanding.certifications && queryUnderstanding.certifications.length > 0) {
      const requiredCerts = queryUnderstanding.certifications.filter(c => c.required).map(c => c.name);
      const preferredCerts = queryUnderstanding.certifications.filter(c => !c.required).map(c => c.name);
      if (requiredCerts.length > 0) {
        parts.push(`Required Certifications: ${requiredCerts.join(', ')}`);
      }
      if (preferredCerts.length > 0) {
        parts.push(`Preferred Certifications: ${preferredCerts.join(', ')}`);
      }
    }

    if (queryUnderstanding.regulatoryExperience && queryUnderstanding.regulatoryExperience.length > 0) {
      parts.push(`Regulatory Experience: ${queryUnderstanding.regulatoryExperience.join(', ')}`);
    }

    if (queryUnderstanding.companyGroupPreferences && queryUnderstanding.companyGroupPreferences.length > 0) {
      parts.push(`Company Groups: ${queryUnderstanding.companyGroupPreferences.join(', ')}`);
    }

    if (queryUnderstanding.needsClarification) {
      parts.push(`Needs Clarification: Yes`);
      if (queryUnderstanding.clarificationQuestions && queryUnderstanding.clarificationQuestions.length > 0) {
        parts.push(`Clarification Questions: ${queryUnderstanding.clarificationQuestions.join('; ')}`);
      }
    }

    if (queryUnderstanding.clarificationAnswers) {
      parts.push(`Clarification Answers: ${queryUnderstanding.clarificationAnswers}`);
    }

    return parts.join('\n');
  }

  /**
   * Generate search strategies as natural language text descriptions
   * Uses LLM to generate strategy descriptions based on query understanding and complexity
   */
  async generateSearchStrategiesAsText(
    openaiClient: OpenAI,
    queryUnderstandingText: string,
    userMessage: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<Array<{ strategyText: string; label?: string; estimatedCandidateCount?: { minimum: number; maximum: number } }>> {
    const eventResult = sendEvent?.('status', { message: 'Generating search strategies...' });
    if (eventResult === false) {
      this.logger.log('Stream aborted during strategy generation');
      // Return default strategy on abort
      return [{
        strategyText: `Use keywords (job titles) and location and industry`,
        label: 'Default Strategy',
        estimatedCandidateCount: { minimum: 40, maximum: 80 },
      }];
    }

    const prompt = this.searchParametersPrompts.getStrategyGenerationPrompt(
      queryUnderstandingText,
      userMessage,
      searchType,
    );

    const stream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: 'You are an expert recruiter and search strategist specializing in generating natural language search strategy descriptions. Generate clear, specific strategy descriptions that explain which parameters to use and how to combine them.' },
        { role: 'user' as const, content: prompt },
      ],
      zodResponseFormat(searchStrategyTextSchema, 'searchStrategyText'),
    );

    const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

    if (!fullContent) {
      this.logger.warn('Strategy generation returned empty content. Using default strategy.');
      return [{
        strategyText: `Use keywords (job titles) and location and industry`,
        label: 'Default Strategy',
        estimatedCandidateCount: { minimum: 40, maximum: 80 },
      }];
    }

    try {
      const parsed = JSON.parse(fullContent);
      const validated = searchStrategyTextSchema.parse(parsed);
      this.logger.log(`Generated ${validated.strategies.length} search strategies`);
      
      return validated.strategies.map(s => ({
        strategyText: s.strategyText,
        label: s.label || undefined,
        estimatedCandidateCount: s.estimatedCandidateCount || undefined,
      }));
    } catch (error) {
      this.logger.error(`Failed to parse strategy generation: ${error}`);
      // Return default strategy on error
      return [{
        strategyText: `Use keywords (job titles) and location and industry`,
        label: 'Default Strategy',
        estimatedCandidateCount: { minimum: 40, maximum: 80 },
      }];
    }
  }

  /**
   * Assess query complexity to determine if multiple strategies are needed
   * Uses LLM to analyze query understanding and determine complexity level
   * Returns both complexity level and reasoning text for use in strategy generation
   */
  // async assessQueryComplexity(
  //   openaiClient: OpenAI,
  //   queryUnderstanding: QueryUnderstanding,
  //   userMessage: string,
  //   sendEvent?: (event: string, data: any) => boolean | void,
  // ): Promise<{ complexity: 'simple' | 'moderate' | 'complex'; reasoning: string }> {
  //   const eventResult = sendEvent?.('status', { message: 'Assessing query complexity...' });
  //   if (eventResult === false) {
  //     this.logger.log('Stream aborted during query complexity assessment');
  //     // Default to moderate on abort
  //     return { complexity: 'moderate', reasoning: 'Stream aborted, using default moderate complexity' };
  //   }

  //   const prompt = this.searchParametersPrompts.getQueryComplexityPrompt(
  //     queryUnderstanding,
  //     userMessage,
  //   );

  //   const stream = await this.streamProcessingService.createStreamingCompletion(
  //     openaiClient,
  //     [
  //       { 
  //         role: 'system' as const, 
  //         content: 'You are an expert recruiter and search strategist specializing in analyzing candidate search query complexity. Assess queries to determine the appropriate search strategy complexity level.' 
  //       },
  //       { role: 'user' as const, content: prompt },
  //     ],
  //     zodResponseFormat(discoveryComplexitySchema, 'discoveryComplexity'),
  //   );

  //   const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

  //   if (!fullContent) {
  //     this.logger.warn('Query complexity assessment returned empty content. Defaulting to moderate.');
  //     return { complexity: 'moderate', reasoning: 'Empty response from LLM, using default moderate complexity' };
  //   }

  //   try {
  //     const parsed = JSON.parse(fullContent);
  //     const validated = queryComplexitySchema.parse(parsed);
  //     this.logger.log(`Query complexity assessment: ${validated.complexity} - ${validated.reasoning}`);
      
  //     return { complexity: validated.complexity, reasoning: validated.reasoning };
  //   } catch (error) {
  //     this.logger.error(`Failed to parse query complexity assessment: ${error}`);
  //     // Default to moderate on error
  //     return { complexity: 'moderate', reasoning: `Error parsing complexity assessment: ${error}` };
  //   }
  // }


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
      description: string; // Can contain strategy text
      whenToUse: string;
      estimatedCandidateCount: { minimum: number; maximum: number };
      filterFocus: string; // Can contain strategy text
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

