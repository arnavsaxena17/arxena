import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  LinkedInClassicCompaniesSearchRequest,
  LinkedInClassicJobsSearchRequest,
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorCompaniesSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { classicCompaniesSearchSchema } from '../schemas/classic-companies-search.schema';
import { classicJobsSearchSchema } from '../schemas/classic-jobs-search.schema';
import {
  ClassicPeopleParameterName,
  classicPeopleSearchSchema
} from '../schemas/classic-people-search.schema';
import {
  recruiterPeopleSearchSchema
} from '../schemas/recruiter-people-search.schema';
import { salesNavigatorCompaniesSearchSchema } from '../schemas/sales-navigator-companies-search.schema';
import {
  salesNavigatorPeopleSearchSchema
} from '../schemas/sales-navigator-people-search.schema';
import {
  ClassicPeopleSearchStrategyResult,
  ParsedJobDescription,
  QueryUnderstanding,
  RecruiterPeopleSearchStrategyResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from '../types/candidate-search-request.type';
import { QueryUnderstandingService } from './query-understanding.service';
import { ResultValidationService } from './result-validation.service';
import { SearchStrategyService } from './search-strategy.service';
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
export class SearchParameterGenerationService {
  private readonly logger = new Logger(SearchParameterGenerationService.name);

  constructor(
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly streamProcessingService: StreamProcessingService,
    private readonly queryUnderstandingService: QueryUnderstandingService,
    private readonly searchStrategyService: SearchStrategyService,
    private readonly resultValidationService: ResultValidationService,
  ) {}

  /**
   * Main entry point for generating people search parameters with strategies
   * Handles both multi-strategy (with user message) and standard (without user message) approaches
   * Uses adaptive strategy generation based on query complexity
   */
  async generatePeopleSearchParams(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    userMessage?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding, // Accept queryUnderstanding to avoid re-computation
    apiToken?: string,
  ): Promise<
    | ClassicPeopleSearchGenerationResult
    | SalesNavigatorPeopleSearchGenerationResult
    | RecruiterPeopleSearchGenerationResult
  > {

    
    if (queryUnderstanding && userMessage) {
      const queryUnderstandingText = this.searchStrategyService.formatQueryUnderstandingAsText(
        queryUnderstanding,
        userMessage,
      );

      const strategyTexts = await this.searchStrategyService.generateStrategies(
        openaiClient,
        queryUnderstandingText,
        userMessage,
        searchType,
        sendEvent,
      );

      this.logger.log(`Generated ${strategyTexts.length} search strategies as text: ${JSON.stringify(strategyTexts, null, 2)}`);

      // Step 6: Generate parameters for each strategy
      const strategyResults: Array<ClassicPeopleSearchStrategyResult | SalesNavigatorPeopleSearchStrategyResult | RecruiterPeopleSearchStrategyResult> = [];
      let primaryParams: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> | 
                         Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'> | 
                         Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'> | null = null;

      for (let i = 0; i < strategyTexts.length; i++) {
        const strategy = strategyTexts[i];
        const eventResult = sendEvent?.('status', { 
          message: `Generating parameters for strategy ${i + 1}/${strategyTexts.length}: ${strategy.label || 'Strategy ' + (i + 1)}...` 
        });
        if (eventResult === false) {
          this.logger.log('Stream aborted, stopping strategy parameter generation');
          break;
        }

        const parameterResult = await this.generateParamsFromStrategy(
          openaiClient,
          strategy.strategyText,
          queryUnderstandingText,
          userMessage,
          rawJDText || '',
          searchType,
          sendEvent,
          includeJd,
        );

        if (!parameterResult || !parameterResult.parameters) {
          this.logger.warn(`Strategy ${i + 1} did not produce usable parameters`);
          continue;
        }

        // Set first strategy as primary
        if (i === 0) {
          primaryParams = parameterResult.parameters;
        }

        // Create strategy result from parameters and strategy text
        const strategyResult = this.searchStrategyService.buildStrategyResult(
          parameterResult.parameters,
          searchType,
          {
            id: `strategy-${i + 1}`,
            label: strategy.label || `Strategy ${i + 1}`,
            goal: `Search strategy: ${strategy.strategyText}`,
            description: strategy.strategyText,
            whenToUse: i === 0 
              ? 'Primary search strategy based on query requirements'
              : `Alternative strategy ${i} - use if primary search yields insufficient results`,
            filterFocus: strategy.strategyText,
          },
        );

        // Add parameter rationales from parameter generation result
        if (searchType === 'classic') {
          (strategyResult as ClassicPeopleSearchStrategyResult).parameterRationales = parameterResult.parameterRationales as Record<ClassicPeopleParameterName, string>;
        } else if (searchType === 'sales_navigator') {
          (strategyResult as SalesNavigatorPeopleSearchStrategyResult).parameterRationales = parameterResult.parameterRationales;
        } else {
          (strategyResult as RecruiterPeopleSearchStrategyResult).parameterRationales = parameterResult.parameterRationales;
        }

        strategyResults.push(strategyResult);
      }
      const primary = primaryParams || strategyResults[0].parameters;
      const otherStrategies = strategyResults.slice(1);

      if (searchType === 'classic') {
        return {
          primary: primary as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
          strategies: otherStrategies.length > 0 ? (otherStrategies as ClassicPeopleSearchStrategyResult[]) : undefined,
        };
      } else if (searchType === 'sales_navigator') {
        return {
          primary: primary as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>,
          strategies: otherStrategies.length > 0 ? (otherStrategies as SalesNavigatorPeopleSearchStrategyResult[]) : undefined,
        };
      } else {
        return {
          primary: primary as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
          strategies: otherStrategies.length > 0 ? (otherStrategies as RecruiterPeopleSearchStrategyResult[]) : undefined,
        };
      }
    }

    // No user message - use standard prompt generation
    const basicParams = await this.streamPeopleSearchParametersWithSinglePrompt(
      openaiClient,
      parsedJobDescription,
      rawJDText,
      searchType,
      sendEvent,
      includeJd,
    );

    return this.wrapParametersAsResult(basicParams, searchType);
  }



  /**
   * Generic function to stream people search parameters with a single prompt
   */
  async streamPeopleSearchParametersWithSinglePrompt(
    openaiClient: OpenAI,
    parsedJobDescription: ParsedJobDescription,
    rawJDText: string | undefined,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {



    let prompt = this.searchParametersPrompts.getPeopleSearchPrompt(
      searchType,
      includeJd ? parsedJobDescription : undefined,
      includeJd ? rawJDText : undefined,
      false, // Generate user prompt
    );


    const systemPrompt = prompt.system as string;
    const userPrompt = prompt.user as string;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];
    
    if (searchType === 'classic') {
      console.log(`Messages for classic people search: ${JSON.stringify(messages, null, 2)} ${userPrompt} }`);
    }
    
    sendEvent?.('status', { message: 'Analyzing job requirements and generating search parameters...' });
    
    let schema: any;
    let schemaName: string;
    
    switch (searchType) {
      case 'classic':
        schema = classicPeopleSearchSchema;
        schemaName = 'classicPeopleSearch';
        break;
      case 'sales_navigator':
        schema = salesNavigatorPeopleSearchSchema;
        schemaName = 'salesNavigatorPeopleSearch';
        break;
      case 'recruiter':
        schema = recruiterPeopleSearchSchema;
        schemaName = 'recruiterPeopleSearch';
        break;
    }
    
    const stream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      messages,
      zodResponseFormat(schema, schemaName),
    );

    const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated ${searchType} People Search Parameters: ${JSON.stringify(result, null, 2)}`);

    // Post-process to remove redundant filters
    if (result && typeof result === 'object' && Object.keys(result).length > 0) {
      this.removeRedundantFilters(result as any, searchType);
    }

    // Fallback: if the model returned an empty object, synthesize minimal parameters from the JD (only for classic)
    if (searchType === 'classic' && (!result || (typeof result === 'object' && Object.keys(result).length === 0))) {
      sendEvent?.('status', { message: 'Using fallback parameters...' });
      const synthesized = {
        keywords:
          (Array.isArray(parsedJobDescription.keywords) && parsedJobDescription.keywords.length > 0
            ? parsedJobDescription.keywords.join(' ')
            : parsedJobDescription.jobTitle) || null,
        industry: parsedJobDescription.industry ? [parsedJobDescription.industry] : null,
        location: parsedJobDescription.location ? [parsedJobDescription.location] : null,
        profile_language: null,
        network_distance: null,
        company: null,
        past_company: null,
        school: null,
        service: null,
        connections_of: null,
        followers_of: null,
        open_to: null,
        advanced_keywords: {
          first_name: null,
          last_name: null,
          title: null,
          company: null,
          school: null,
        },
      } as any;
      this.logger.warn('LLM returned empty classic people search parameters. Using synthesized fallback.');
      return synthesized;
    }

    return result;
  }


  async generateParamsFromStrategy(
    openaiClient: OpenAI,
    strategyText: string,
    queryUnderstandingText: string,
    userMessage: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<{
    parameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
      | null;
    parameterRationales: Record<string, string>;
  } | null> {
    const eventResult = sendEvent?.('status', { message: 'Generating parameters from strategy...' });
    if (eventResult === false) {
      this.logger.log('Stream aborted during parameter generation from strategy text');
      return null;
    }

    const parameterGenerationSystemPrompt = this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType);
    const parameterGenerationPrompt = this.searchParametersPrompts.buildParameterGenerationPromptFromStrategyText(
      strategyText,
      queryUnderstandingText,
      userMessage,
      includeJd ? rawJDText : '',
      searchType,
    );

    let schema: any;
    let schemaName: string;
    
    switch (searchType) {
      case 'classic':
        schema = classicPeopleSearchSchema;
        schemaName = 'classicPeopleSearch';
        break;
      case 'sales_navigator':
        schema = salesNavigatorPeopleSearchSchema;
        schemaName = 'salesNavigatorPeopleSearch';
        break;
      case 'recruiter':
        schema = recruiterPeopleSearchSchema;
        schemaName = 'recruiterPeopleSearch';
        break;
    }

    const stream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: parameterGenerationSystemPrompt },
        { role: 'user' as const, content: parameterGenerationPrompt },
      ],
      zodResponseFormat(schema, schemaName),
    );

    const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

    if (!fullContent) {
      this.logger.warn('Parameter generation from strategy text returned empty content.');
      return null;
    }

    try {
      const parsed = JSON.parse(fullContent);
      const validated = schema.parse(parsed);
      
      // Post-process to remove redundant filters
      this.removeRedundantFilters(validated, searchType);

      // Generate parameter rationales from strategy text
      const parameterRationales: Record<string, string> = {};
      // Extract which parameters were mentioned in strategy text
      const strategyLower = strategyText.toLowerCase();
      if (strategyLower.includes('keyword')) {
        parameterRationales['keywords'] = 'Keywords generated based on strategy: ' + strategyText;
      }
      if (strategyLower.includes('location')) {
        parameterRationales['location'] = 'Location generated based on strategy: ' + strategyText;
      }
      if (strategyLower.includes('industry')) {
        parameterRationales['industry'] = 'Industry generated based on strategy: ' + strategyText;
      }
      if (strategyLower.includes('company')) {
        parameterRationales['company'] = 'Company generated based on strategy: ' + strategyText;
      }

      if (!validated.keywords) {
        this.logger.warn('Generated parameters missing keywords, which are required.');
        return null;
      }

      return {
        parameters: validated,
        parameterRationales,
      };
    } catch (error) {
      this.logger.error(`Failed to parse parameters from strategy text: ${error}`);
      return null;
    }
  }

  /**
   * Generic function to stream companies search parameters
   */
  async streamCompaniesSearchParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    searchType: 'classic' | 'sales_navigator',
    userMessage?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>
  > {
    let prompt: { system: string; user: string };
    let schema: any;
    let schemaName: string;
    
    prompt = this.searchParametersPrompts.getCompaniesSearchPrompt(
      searchType,
      includeJd ? parsedJobDescription : undefined,
      includeJd ? rawJDText : undefined,
    ) as { system: string; user: string };
    switch (searchType) {
      case 'classic':
        schema = classicCompaniesSearchSchema;
        schemaName = 'classicCompaniesSearch';
        break;
      case 'sales_navigator':
        schema = salesNavigatorCompaniesSearchSchema;
        schemaName = 'salesNavigatorCompaniesSearch';
        break;
    }
    
    let enhancedUserPrompt: string;
    
    if (userMessage) {
      enhancedUserPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        includeJd ? (rawJDText || '') : '',
        'companies',
        searchType
      );
    } else {
      // Template variables are already replaced in getCompaniesSearchPrompt
      enhancedUserPrompt = prompt.user;
    }

    sendEvent?.('status', { message: 'Generating company search parameters...' });

    const stream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      zodResponseFormat(schema, schemaName),
    );

    const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated ${searchType} Companies Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Stream generation of LinkedIn Classic Jobs Search parameters
   */
  async streamJobsSearchParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>> {
    const prompt = this.searchParametersPrompts.getJobsSearchPrompt(
      includeJd ? parsedJobDescription : undefined,
      includeJd ? rawJDText : undefined,
    );
    
    let enhancedUserPrompt: string;
    
    if (userMessage) {
      enhancedUserPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        includeJd ? (rawJDText || '') : '',
        'jobs',
        'classic'
      );
    } else {
      // Template variables are already replaced in getJobsSearchPrompt
      enhancedUserPrompt = prompt.user;
    }

    sendEvent?.('status', { message: 'Generating job search parameters...' });

    const stream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      zodResponseFormat(
        classicJobsSearchSchema,
        'classicJobsSearch',
      ),
    );

    const fullContent = await this.streamProcessingService.processStreamChunks(stream, sendEvent);

    return fullContent ? JSON.parse(fullContent) : {};
  }


  /**
   * Post-process parameters to remove redundant filters
   * Removes industry filter when company filter is present (company is more precise)
   */
  removeRedundantFilters(
    parameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): void {
    // Remove industry filter if company filter is present (company is more precise)
    if (searchType === 'classic') {
      const classicParams = parameters as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>;
      const hasCompany = classicParams.company && Array.isArray(classicParams.company) && classicParams.company.length > 0;
      const hasPastCompany = classicParams.past_company && Array.isArray(classicParams.past_company) && classicParams.past_company.length > 0;
      
      if ((hasCompany || hasPastCompany) && classicParams.industry) {
        this.logger.log(`Removing redundant industry filter because company filter is present (company: ${hasCompany ? classicParams.company?.join(', ') : 'none'}, past_company: ${hasPastCompany ? classicParams.past_company?.join(', ') : 'none'})`);
        classicParams.industry = undefined;
      }
    } else if (searchType === 'sales_navigator') {
      const salesNavParams = parameters as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>;
      const hasCompany = salesNavParams.company && 
        ((salesNavParams.company.include && salesNavParams.company.include.length > 0) || 
         (salesNavParams.company.exclude && salesNavParams.company.exclude.length > 0));
      const hasPastCompany = salesNavParams.past_company && 
        ((salesNavParams.past_company.include && salesNavParams.past_company.include.length > 0) || 
         (salesNavParams.past_company.exclude && salesNavParams.past_company.exclude.length > 0));
      
      if ((hasCompany || hasPastCompany) && salesNavParams.industry) {
        this.logger.log(`Removing redundant industry filter because company filter is present`);
        salesNavParams.industry = undefined;
      }
    } else {
      // recruiter
      const recruiterParams = parameters as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>;
      const hasCompany = recruiterParams.company && Array.isArray(recruiterParams.company) && recruiterParams.company.length > 0;
      const hasPastCompany = recruiterParams.past_company && Array.isArray(recruiterParams.past_company) && recruiterParams.past_company.length > 0;
      
      if ((hasCompany || hasPastCompany) && recruiterParams.industry) {
        this.logger.log(`Removing redundant industry filter because company filter is present`);
        recruiterParams.industry = undefined;
      }
    }
  }

  /**
   * Wraps generated parameters in the appropriate result type
   */
  wrapParametersAsResult(
    parameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): 
    | ClassicPeopleSearchGenerationResult
    | SalesNavigatorPeopleSearchGenerationResult
    | RecruiterPeopleSearchGenerationResult
  {
    if (searchType === 'classic') {
      return { primary: parameters as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> };
    } else if (searchType === 'sales_navigator') {
      return { primary: parameters as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'> };
    } else {
      return { primary: parameters as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'> };
    }
  }
}

