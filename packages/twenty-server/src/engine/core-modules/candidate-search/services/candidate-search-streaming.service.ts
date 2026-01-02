import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { LinkedInSearchTransformerService } from '../../candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { ResumeReaderService } from '../../candidate-sourcing/services/resume-reader.service';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { LinkedInSearchService } from '../../linkedin-search/services/linkedin-search.service';
import {
  LinkedInClassicCompaniesSearchRequest,
  LinkedInClassicJobsSearchRequest,
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorCompaniesSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

import { classicCompaniesSearchSchema } from '../schemas/classic-companies-search.schema';
import { classicJobsSearchSchema } from '../schemas/classic-jobs-search.schema';
import {
  ClassicPeopleParameterDecision,
  ClassicPeopleParameterName,
  ClassicPeopleParameterSelection,
  ClassicPeopleStrategyDefinition,
  ClassicPeopleStrategyPlan,
  classicPeopleSearchSchema,
  classicPeopleStrategyPlanSchema
} from '../schemas/classic-people-search.schema';
import {
  RecruiterPeopleParameterDecision,
  RecruiterPeopleParameterName,
  RecruiterPeopleParameterSelection,
  RecruiterPeopleStrategyDefinition,
  RecruiterPeopleStrategyPlan,
  recruiterPeopleSearchSchema,
  recruiterPeopleStrategyPlanSchema,
} from '../schemas/recruiter-people-search.schema';
import { salesNavigatorCompaniesSearchSchema } from '../schemas/sales-navigator-companies-search.schema';
import {
  SalesNavigatorPeopleParameterDecision,
  SalesNavigatorPeopleParameterName,
  SalesNavigatorPeopleParameterSelection,
  SalesNavigatorPeopleStrategyDefinition,
  SalesNavigatorPeopleStrategyPlan,
  salesNavigatorPeopleSearchSchema,
  salesNavigatorPeopleStrategyPlanSchema
} from '../schemas/sales-navigator-people-search.schema';

import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import {
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  ParsedJobDescription,
  RecruiterPeopleSearchStrategyResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from '../types/candidate-search-request.type';
import {
  FileUtils,
  LinkedinParameterResolver,
  ParameterSanitizer
} from '../utils';
import { CandidateSearchBaseService } from './candidate-search-base.service';
import {
  assignClassicPeopleParameterValue,
  assignRecruiterPeopleParameterValue,
  assignSalesNavigatorPeopleParameterValue,
  buildDefaultParameterSelection,
  buildDefaultRecruiterPeopleParameterSelection,
  buildDefaultSalesNavigatorPeopleParameterSelection,
  classicPeopleParameterSchemaMap,
  createClassicPeopleBaseResult,
  createRecruiterPeopleBaseResult,
  createSalesNavigatorPeopleBaseResult,
  recruiterPeopleParameterSchemaMap,
  salesNavigatorPeopleParameterSchemaMap,
} from './candidate-search-utils';
import { JobDescriptionService } from './job-description.service';

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
export class CandidateSearchStreamingService extends CandidateSearchBaseService {
  constructor(
    linkedInSearchService: LinkedInSearchService,
    private readonly searchParametersPrompts: SearchParametersPrompts,
    workspaceQueryService: WorkspaceQueryService,
    linkedinParameterResolver: LinkedinParameterResolver,
    parameterSanitizer: ParameterSanitizer,
    fileUtils: FileUtils,
    linkedinSearchResultTransformer: LinkedInSearchTransformerService,
    staticGraphQLService: StaticGraphQLService,
    resumeReaderService: ResumeReaderService,
    jobDescriptionService: JobDescriptionService,
  ) {
    super(
      linkedInSearchService,
      workspaceQueryService,
      linkedinParameterResolver,
      parameterSanitizer,
      fileUtils,
      linkedinSearchResultTransformer,
      staticGraphQLService,
      resumeReaderService,
      jobDescriptionService,
    );
  }

  /**
   * Generate LinkedIn search parameters with streaming support
   */
  async streamSearchParametersAndStrategies(
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    userMessage?: string,
    classificationReasoning?: string,
    jobId?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<GeneratedSearchParameters> {
    try {
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
      const generatedParameters: GeneratedSearchParameters = {};      
      this.logger.log(`Generating search parameters for ${searchType} ${searchCategory}`);
      if (userMessage)
        this.logger.log(`User message: ${userMessage}`);
      if (classificationReasoning)
        this.logger.log(`Classification reasoning: ${classificationReasoning}`);

      const rawJDText = jobId
        ? await this.jobDescriptionService.getJDContentFromJobAttachments(jobId, apiToken)
        : '';
      
      if (rawJDText) {
        this.logger.log(`Fetched raw JD text, length: ${rawJDText.length} characters`);
      }

      sendEvent?.('status', { message: `Generating ${searchType} ${searchCategory} search parameters...` });

      // Handle people search (same logic for all search types)
      if (searchCategory === 'people') {
        const peopleResult = await this.streamPeopleSearchStrategiesParameters(
          parsedJobDescription,
          openaiClient,
          searchType,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
        );

        if (searchType === 'classic') {
          const result = peopleResult as ClassicPeopleSearchGenerationResult;
          generatedParameters.classicPeopleSearch = result.primary;
          if (result.strategies?.length) {
            generatedParameters.classicPeopleSearchStrategies = result.strategies;
          }
        } else if (searchType === 'sales_navigator') {
          const result = peopleResult as SalesNavigatorPeopleSearchGenerationResult;
          generatedParameters.salesNavigatorPeopleSearch = result.primary;
          if (result.strategies?.length) {
            generatedParameters.salesNavigatorPeopleSearchStrategies = result.strategies;
          }
        } else if (searchType === 'recruiter') {
          const result = peopleResult as RecruiterPeopleSearchGenerationResult;
          generatedParameters.recruiterPeopleSearch = result.primary;
          if (result.strategies?.length) {
            generatedParameters.recruiterPeopleSearchStrategies = result.strategies;
          }
        }
        return generatedParameters;
      }

      // Handle companies search (classic and sales_navigator)
      if (searchCategory === 'companies' && (searchType === 'classic' || searchType === 'sales_navigator')) {
        const companiesResult = await this.streamCompaniesSearchParameters(
          parsedJobDescription,
          openaiClient,
          searchType,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
        );

        if (searchType === 'classic') {
          generatedParameters.classicCompaniesSearch = companiesResult as Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>;
        } else {
          generatedParameters.salesNavigatorCompaniesSearch = companiesResult as Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>;
        }
        return generatedParameters;
      }

      // Handle jobs search (only classic)
      if (searchCategory === 'jobs' && searchType === 'classic') {
        generatedParameters.classicJobsSearch = await this.streamJobsSearchParameters(
          parsedJobDescription,
          openaiClient,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
        );
        return generatedParameters;
      }

      return generatedParameters;
    } catch (error) {
      this.logger.error(`Failed to generate search parameters for ${searchType} ${searchCategory}: ${error}`);
      throw error;
    }
  }


  /**
   * Create a streaming OpenAI chat completion
   */
  private async createStreamingCompletion(
    openaiClient: OpenAI,
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    responseFormat: ReturnType<typeof zodResponseFormat>,
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    return openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages,
      stream: true,
      response_format: responseFormat,
    });
  }

  /**
   * Process stream chunks and accumulate content
   */
  private async processStreamChunks(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<string> {
    let fullContent = '';
    
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        sendEvent?.('chunk', { content: delta });
      }
    }
    
    return fullContent;
  }

  /**
   * Generic function to stream people search strategies parameters
   */
  /**
   * Main entry point for generating people search parameters with strategies
   * Handles both multi-strategy (with user message) and standard (without user message) approaches
   */
  private async streamPeopleSearchStrategiesParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<
    | ClassicPeopleSearchGenerationResult
    | SalesNavigatorPeopleSearchGenerationResult
    | RecruiterPeopleSearchGenerationResult
  > {
    if (userMessage && classificationReasoning) {
      // Try multi-strategy approach first
      const multiStrategyResult = await this.tryMultiStrategyApproach(
        openaiClient,
        userMessage,
        classificationReasoning,
        rawJDText || '',
        searchType,
        sendEvent,
      );

      if (multiStrategyResult) {
        return multiStrategyResult;
      }

      // Fallback to single-call with user-prioritized prompt
      this.logger.warn(`Multi-strategy ${searchType} people parameter generation returned no usable result. Falling back to single-call prompt.`);
      const fallbackParameters = await this.generateFallbackParameters(
        openaiClient,
        parsedJobDescription,
        userMessage,
        classificationReasoning,
        rawJDText || '',
        searchType,
        sendEvent,
      );

      return this.wrapParametersAsResult(fallbackParameters, searchType);
    }

    // No user message - use standard prompt generation
    const standardParameters = await this.generateStandardParameters(
      openaiClient,
      parsedJobDescription,
      rawJDText,
      searchType,
      sendEvent,
    );

    return this.wrapParametersAsResult(standardParameters, searchType);
  }

  /**
   * Attempts to generate parameters using multi-strategy approach
   */
  private async tryMultiStrategyApproach(
    openaiClient: OpenAI,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => void,
  ): Promise<
    | ClassicPeopleSearchGenerationResult
    | SalesNavigatorPeopleSearchGenerationResult
    | RecruiterPeopleSearchGenerationResult
    | null
  > {
    const strategyPlanningSystemPrompt = this.searchParametersPrompts.getPeopleSearchStrategySystemPrompt(searchType);
    const strategyPlanningUserPrompt = this.searchParametersPrompts.decidingWhichParametersToCreateForPeopleSearch(
      userMessage,
      classificationReasoning,
      rawJDText,
      'people',
      searchType
    );

    this.logger.log(`Strategy planning user prompt: ${strategyPlanningUserPrompt}`);

    const multiStrategyResult = await this.streamPeopleSearchParametersWithStrategies(
      openaiClient,
      strategyPlanningSystemPrompt,
      strategyPlanningUserPrompt,
      userMessage,
      classificationReasoning,
      rawJDText,
      searchType,
      sendEvent,
    );

    if (multiStrategyResult) {
      this.logger.log(`Multi-strategy ${searchType} people parameter generation returned usable result: ${JSON.stringify(multiStrategyResult, null, 2)}`);
      return multiStrategyResult;
    }

    this.logger.warn(`Multi-strategy ${searchType} people parameter generation returned no usable result.`);
    return null;
  }

  /**
   * Generates parameters using fallback single-call approach with user-prioritized prompt
   */
  private async generateFallbackParameters(
    openaiClient: OpenAI,
    parsedJobDescription: ParsedJobDescription,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => void,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    const userPrioritizedPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
      userMessage,
      classificationReasoning,
      rawJDText,
      'people',
      searchType
    );
    
    const parameterGenerationSystemPrompt = this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType);
    
    return await this.generateSingleCallParameters(
      openaiClient,
      parameterGenerationSystemPrompt,
      userPrioritizedPrompt,
      parsedJobDescription,
      searchType,
      sendEvent,
    );
  }

  /**
   * Generates parameters using standard prompt (no user message)
   */
  private async generateStandardParameters(
    openaiClient: OpenAI,
    parsedJobDescription: ParsedJobDescription,
    rawJDText: string | undefined,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => void,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    const prompt = this.searchParametersPrompts.getPeopleSearchPrompt(
      searchType,
      parsedJobDescription,
      rawJDText,
      false, // Generate user prompt
    );
    
    this.logger.log(`Prompt after template replacement for ${searchType} people search: ${prompt.user.substring(0, 500)}...`);
    
    return await this.generateSingleCallParameters(
      openaiClient,
      prompt.system,
      prompt.user,
      parsedJobDescription,
      searchType,
      sendEvent,
    );
  }

  /**
   * Generates parameters using a single prompt call
   */
  private async generateSingleCallParameters(
    openaiClient: OpenAI,
    systemPrompt: string,
    userPrompt: string,
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => void,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    return await this.streamPeopleSearchParametersWithSinglePrompt(
      openaiClient,
      systemPrompt,
      userPrompt,
      parsedJobDescription,
      searchType,
      sendEvent,
    ) as any;
  }

  /**
   * Wraps generated parameters in the appropriate result type
   */
  private wrapParametersAsResult(
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

  /**
   * Generic function to stream people search parameters with a single prompt
   */
  private async streamPeopleSearchParametersWithSinglePrompt(
    openaiClient: OpenAI,
    systemPrompt: string,
    userPrompt: string,
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => void,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
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
    
    const stream = await this.createStreamingCompletion(
      openaiClient,
      messages,
      zodResponseFormat(schema, schemaName),
    );

    const fullContent = await this.processStreamChunks(stream, sendEvent);

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated ${searchType} People Search Parameters: ${JSON.stringify(result, null, 2)}`);

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
        network_distance: [2] as Array<1 | 2 | 3>,
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

  /**
   * Generic function to stream people search parameters with strategies
   */
  private async streamPeopleSearchParametersWithStrategies(
    openaiClient: OpenAI,
    strategyPlanningSystemPrompt: string,
    strategyPlanningUserPrompt: string,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => void,
  ): Promise<
    | ClassicPeopleSearchGenerationResult
    | SalesNavigatorPeopleSearchGenerationResult
    | RecruiterPeopleSearchGenerationResult
    | null
  > {
    try {
      sendEvent?.('status', { message: 'Planning search strategy...' });
      
      let strategyPlanSchema: any;
      let schemaName: string;
      
      switch (searchType) {
        case 'classic':
          strategyPlanSchema = classicPeopleStrategyPlanSchema;
          schemaName = 'classicPeopleStrategyPlan';
          break;
        case 'sales_navigator':
          strategyPlanSchema = salesNavigatorPeopleStrategyPlanSchema;
          schemaName = 'salesNavigatorPeopleStrategyPlan';
          break;
        case 'recruiter':
          strategyPlanSchema = recruiterPeopleStrategyPlanSchema;
          schemaName = 'recruiterPeopleStrategyPlan';
          break;
      }
      
      const stream = await this.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system' as const, content: strategyPlanningSystemPrompt },
          { role: 'user' as const, content: strategyPlanningUserPrompt },
        ],
        zodResponseFormat(strategyPlanSchema, schemaName),
      );

      const fullContent = await this.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn('Strategy planning call returned empty content.');
        return null;
      }

      let strategyPlan: ClassicPeopleStrategyPlan | SalesNavigatorPeopleStrategyPlan | RecruiterPeopleStrategyPlan | null = null;
      try {
        const parsed = JSON.parse(fullContent);
        switch (searchType) {
          case 'classic':
            strategyPlan = parsed as ClassicPeopleStrategyPlan;
            break;
          case 'sales_navigator':
            strategyPlan = parsed as SalesNavigatorPeopleStrategyPlan;
            break;
          case 'recruiter':
            strategyPlan = parsed as RecruiterPeopleStrategyPlan;
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to parse ${searchType} people strategy plan: ${error}`);
      }

      if (!strategyPlan || !strategyPlan.strategies || strategyPlan.strategies.length === 0) {
        this.logger.warn('Strategy plan did not include any strategies.');
        return null;
      }

      let strategyResults: ClassicPeopleSearchStrategyResult[] | SalesNavigatorPeopleSearchStrategyResult[] | RecruiterPeopleSearchStrategyResult[];

      switch (searchType) {
        case 'classic':
          strategyResults = [] as ClassicPeopleSearchStrategyResult[];
          break;
        case 'sales_navigator':
          strategyResults = [] as SalesNavigatorPeopleSearchStrategyResult[];
          break;
        case 'recruiter':
          strategyResults = [] as RecruiterPeopleSearchStrategyResult[];
          break;
      }

      // Use parameter generation system prompt (not strategy system prompt) for individual parameter generation
      const parameterGenerationSystemPrompt = this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType);

      for (const strategy of strategyPlan.strategies) {
        sendEvent?.('status', { message: `Generating parameters for strategy: ${strategy.label}...` });
        
        const strategyOutcome = await this.streamPeopleParametersForStrategy(
          openaiClient,
          parameterGenerationSystemPrompt,
          strategy,
          userMessage,
          classificationReasoning,
          rawJDText,
          searchType,
          sendEvent,
        );

        if (!strategyOutcome || !strategyOutcome.parameters) {
          this.logger.warn(`Skipping strategy "${strategy.label}" because no parameters were generated.`);
          continue;
        }

        const strategyResult = {
          id: strategy.id,
          label: strategy.label,
          goal: strategy.goal,
          aggressiveness: strategy.aggressiveness,
          description: strategy.description,
          whenToUse: strategy.whenToUse,
          estimatedCandidateCount: strategy.estimatedCandidateCount,
          filterFocus: strategy.filterFocus,
          parameterRationales: strategyOutcome.parameterRationales,
          parameters: strategyOutcome.parameters,
        };

        if (searchType === 'classic') {
          (strategyResults as ClassicPeopleSearchStrategyResult[]).push(strategyResult as ClassicPeopleSearchStrategyResult);
        } else if (searchType === 'sales_navigator') {
          (strategyResults as SalesNavigatorPeopleSearchStrategyResult[]).push(strategyResult as SalesNavigatorPeopleSearchStrategyResult);
        } else {
          (strategyResults as RecruiterPeopleSearchStrategyResult[]).push(strategyResult as RecruiterPeopleSearchStrategyResult);
        }
      }

      if (strategyResults.length === 0) {
        this.logger.warn('All strategy parameter generations failed.');
        return null;
      }

      const primaryStrategy =
        strategyResults.find((strategy) => strategy.aggressiveness === 'balanced') ||
        strategyResults[0];

      if (searchType === 'classic') {
      return {
          primary: primaryStrategy.parameters as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
          strategies: strategyResults as ClassicPeopleSearchStrategyResult[],
        };
      } else if (searchType === 'sales_navigator') {
        return {
          primary: primaryStrategy.parameters as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>,
          strategies: strategyResults as SalesNavigatorPeopleSearchStrategyResult[],
        };
      } else {
        return {
          primary: primaryStrategy.parameters as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
          strategies: strategyResults as RecruiterPeopleSearchStrategyResult[],
        };
      }
    } catch (error) {
      this.logger.error(`Multi-strategy ${searchType} people parameter generation failed: ${error}`);
      return null;
    }
  }

  /**
   * Generic function to stream people parameters for a specific strategy
   */
  private async streamPeopleParametersForStrategy(
    openaiClient: OpenAI,
    systemPrompt: string,
    strategy: ClassicPeopleStrategyDefinition | SalesNavigatorPeopleStrategyDefinition | RecruiterPeopleStrategyDefinition,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => void,
  ): Promise<{
    parameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
      | null;
    parameterRationales: Record<string, string>;
  } | null> {
    let aggregatedResult: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>;
    let parameterDecisions: ClassicPeopleParameterSelection | SalesNavigatorPeopleParameterSelection | RecruiterPeopleParameterSelection;
    let parameterRationales: Record<ClassicPeopleParameterName, string> | Record<SalesNavigatorPeopleParameterName, string> | Record<RecruiterPeopleParameterName, string>;
    let parameterSchemaMap: Record<string, any>;
    let assignParameterValue: (target: any, param: string, value: unknown) => void;

    switch (searchType) {
      case 'classic': {
        aggregatedResult = createClassicPeopleBaseResult();
        parameterDecisions = (strategy as ClassicPeopleStrategyDefinition).parameterSelection ?? buildDefaultParameterSelection();
        parameterSchemaMap = classicPeopleParameterSchemaMap;
        assignParameterValue = assignClassicPeopleParameterValue;
        parameterRationales = Object.keys(parameterDecisions).reduce(
          (acc, key) => ({
            ...acc,
            [key]: parameterDecisions[key as ClassicPeopleParameterName]?.reasoning || '',
          }),
          {} as Record<ClassicPeopleParameterName, string>,
        );
        break;
      }
      case 'sales_navigator': {
        aggregatedResult = createSalesNavigatorPeopleBaseResult();
        parameterDecisions = (strategy as SalesNavigatorPeopleStrategyDefinition).parameterSelection ?? buildDefaultSalesNavigatorPeopleParameterSelection();
        parameterSchemaMap = salesNavigatorPeopleParameterSchemaMap;
        assignParameterValue = assignSalesNavigatorPeopleParameterValue;
        parameterRationales = Object.keys(parameterDecisions).reduce(
          (acc, key) => ({
            ...acc,
            [key]: parameterDecisions[key as SalesNavigatorPeopleParameterName]?.reasoning || '',
          }),
          {} as Record<SalesNavigatorPeopleParameterName, string>,
        );
        break;
      }
      case 'recruiter': {
        aggregatedResult = createRecruiterPeopleBaseResult();
        parameterDecisions = (strategy as RecruiterPeopleStrategyDefinition).parameterSelection ?? buildDefaultRecruiterPeopleParameterSelection();
        parameterSchemaMap = recruiterPeopleParameterSchemaMap;
        assignParameterValue = assignRecruiterPeopleParameterValue;
        parameterRationales = Object.keys(parameterDecisions).reduce(
          (acc, key) => ({
            ...acc,
            [key]: parameterDecisions[key as RecruiterPeopleParameterName]?.reasoning || '',
          }),
          {} as Record<RecruiterPeopleParameterName, string>,
        );
        break;
      }
    }

    const candidateRange = strategy.estimatedCandidateCount || { minimum: 40, maximum: 80 };
    const parametersToGenerate = Object.entries(parameterDecisions).filter(
      ([, decision]) => (decision as ClassicPeopleParameterDecision | SalesNavigatorPeopleParameterDecision | RecruiterPeopleParameterDecision).shouldGenerate
    ) as Array<[string, ClassicPeopleParameterDecision | SalesNavigatorPeopleParameterDecision | RecruiterPeopleParameterDecision]>;

    if (parametersToGenerate.length === 0) {
      this.logger.warn(`Strategy "${strategy.label}" requested no parameters.`);
      return null;
    }

    let generatedAny = false;

    for (const [parameterName, decision] of parametersToGenerate) {
      sendEvent?.('status', { message: `Generating ${parameterName} parameter...: ` });
      
      const generationPrompt = this.searchParametersPrompts.buildPeopleParameterGenerationPrompt(
        parameterName as ClassicPeopleParameterName | SalesNavigatorPeopleParameterName | RecruiterPeopleParameterName,
        searchType,
        {
          userMessage,
          classificationReasoning,
          rawJDText,
          selectionReasoning: decision.reasoning,
          strategyLabel: strategy.label,
          strategyGoal: strategy.goal,
          strategyAggressiveness: strategy.aggressiveness,
          estimatedCandidateRange: candidateRange,
        },
      );

      const stream = await this.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: generationPrompt },
        ],
        zodResponseFormat(
          parameterSchemaMap[parameterName],
          `${searchType === 'classic' ? 'classic' : searchType === 'sales_navigator' ? 'salesNavigator' : 'recruiter'}People${parameterName}Parameter`,
        ),
      );

      const fullContent = await this.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn(`Parameter generation for ${parameterName} returned empty content.`);
        continue;
      }

      try {
        const parsedParameter = JSON.parse(fullContent) as Record<string, unknown>;
        assignParameterValue(
          aggregatedResult,
          parameterName,
          parsedParameter[parameterName],
        );
        generatedAny = true;
      } catch (error) {
        this.logger.error(`Failed to parse generated ${parameterName} parameter: ${error}`);
      }
    }

    if (!generatedAny || !aggregatedResult.keywords) {
      this.logger.warn(`Strategy "${strategy.label}" did not produce usable parameter values.`);
      return null;
    }

    return {
      parameters: aggregatedResult,
      parameterRationales,
    };
  }

  /**
   * Generic function to stream companies search parameters
   */
  private async streamCompaniesSearchParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    searchType: 'classic' | 'sales_navigator',
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<
    | Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>
  > {
    let prompt: { system: string; user: string };
    let schema: any;
    let schemaName: string;
    
    prompt = this.searchParametersPrompts.getCompaniesSearchPrompt(
      searchType,
      parsedJobDescription,
      rawJDText,
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
    
    if (userMessage && classificationReasoning) {
        enhancedUserPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'companies',
        searchType
      );
    } else {
      // Template variables are already replaced in getCompaniesSearchPrompt
      enhancedUserPrompt = prompt.user;
    }

    sendEvent?.('status', { message: 'Generating company search parameters...' });

    const stream = await this.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      zodResponseFormat(schema, schemaName),
    );

    const fullContent = await this.processStreamChunks(stream, sendEvent);

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated ${searchType} Companies Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Stream generation of LinkedIn Classic Jobs Search parameters
   */
  private async streamJobsSearchParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>> {
    const prompt = this.searchParametersPrompts.getJobsSearchPrompt(
      parsedJobDescription,
      rawJDText,
    );
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'jobs',
        'classic'
      );
    } else {
      // Template variables are already replaced in getJobsSearchPrompt
      enhancedUserPrompt = prompt.user;
    }

    sendEvent?.('status', { message: 'Generating job search parameters...' });

    const stream = await this.createStreamingCompletion(
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

    const fullContent = await this.processStreamChunks(stream, sendEvent);

    return fullContent ? JSON.parse(fullContent) : {};
  }

}

