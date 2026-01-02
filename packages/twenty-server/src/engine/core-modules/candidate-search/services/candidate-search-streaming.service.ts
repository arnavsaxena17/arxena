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
  ClassicPeopleParameterName,
  ClassicPeopleParameterSelection,
  ClassicPeopleStrategyDefinition,
  ClassicPeopleStrategyPlan,
  classicPeopleSearchSchema,
  classicPeopleStrategyPlanSchema
} from '../schemas/classic-people-search.schema';
import {
  RecruiterPeopleParameterName,
  RecruiterPeopleParameterSelection,
  RecruiterPeopleStrategyDefinition,
  recruiterPeopleSearchSchema,
  recruiterPeopleStrategyPlanSchema,
} from '../schemas/recruiter-people-search.schema';
import { salesNavigatorCompaniesSearchSchema } from '../schemas/sales-navigator-companies-search.schema';
import {
  SalesNavigatorPeopleParameterName,
  SalesNavigatorPeopleParameterSelection,
  SalesNavigatorPeopleStrategyDefinition,
  salesNavigatorPeopleSearchSchema,
  salesNavigatorPeopleStrategyPlanSchema,
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
  ParameterSanitizer,
  replaceTemplateVariables,
} from '../utils';
import { CandidateSearchBaseService } from './candidate-search-base.service';
import { CandidateSearchPromptService } from './candidate-search-prompt.service';
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
    private readonly promptService: CandidateSearchPromptService,
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

      let rawJDText = '';
      if (jobId)
        rawJDText = await this.jobDescriptionService.getJDContentFromJobAttachments(jobId, apiToken);
        this.logger.log(`Fetched raw JD text, length: ${rawJDText.length} characters`);

      sendEvent?.('status', { message: `Generating ${searchType} ${searchCategory} search parameters...:` });

      // Generate parameters based on search type and category with streaming
      if (searchType === 'classic') {
        if (searchCategory === 'people') {
          const classicPeopleResult = await this.streamClassicPeopleSearchStrategiesParameters(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
            sendEvent,
          );
          generatedParameters.classicPeopleSearch = classicPeopleResult.primary;
          if (classicPeopleResult.strategies && classicPeopleResult.strategies.length > 0) {
            generatedParameters.classicPeopleSearchStrategies = classicPeopleResult.strategies;
          }
        } else if (searchCategory === 'companies') {
          generatedParameters.classicCompaniesSearch = await this.streamClassicCompaniesSearchParameters(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
            sendEvent,
          );
        } else if (searchCategory === 'jobs') {
          generatedParameters.classicJobsSearch = await this.streamClassicJobsSearchParameters(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
            sendEvent,
          );
        }
      } else if (searchType === 'sales_navigator') {
        if (searchCategory === 'people') {
          const salesNavigatorPeopleResult = await this.streamSalesNavigatorPeopleSearchStrategiesParameters(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
            sendEvent,
          );
          generatedParameters.salesNavigatorPeopleSearch = salesNavigatorPeopleResult.primary;
          if (salesNavigatorPeopleResult.strategies && salesNavigatorPeopleResult.strategies.length > 0) {
            generatedParameters.salesNavigatorPeopleSearchStrategies = salesNavigatorPeopleResult.strategies;
          }
        } else if (searchCategory === 'companies') {
          generatedParameters.salesNavigatorCompaniesSearch = await this.streamSalesNavigatorCompaniesSearchParameters(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
            sendEvent,
          );
        }
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        const recruiterPeopleResult = await this.streamRecruiterPeopleSearchStrategiesParameters(
          parsedJobDescription,
          openaiClient,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
        );
        generatedParameters.recruiterPeopleSearch = recruiterPeopleResult.primary;
        if (recruiterPeopleResult.strategies && recruiterPeopleResult.strategies.length > 0) {
          generatedParameters.recruiterPeopleSearchStrategies = recruiterPeopleResult.strategies;
        }
      }

      return generatedParameters;
    } catch (error) {
      this.logger.error(`Failed to generate search parameters for ${searchType} ${searchCategory}: ${error}`);
      throw error;
    }
  }

  /**
   * Generate search parameters - implements base class method for streaming
   */
  //   async generateSearchParameters(
  //   parsedJobDescription: ParsedJobDescription,
  //   searchType: 'classic' | 'sales_navigator' | 'recruiter',
  //   searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  //   apiToken: string,
  //   userMessage?: string,
  //   classificationReasoning?: string,
  //   jobId?: string,
  // ): Promise<GeneratedSearchParameters> {
  //   // For streaming, we need sendEvent but base class doesn't have it
  //   // So we'll throw an error if called without streaming
  //   throw new Error('Use generateSearch Parameters From LLM Streaming for streaming support');
  // }

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
   * Stream generation of LinkedIn Classic People Search parameters
   */
  private async streamClassicPeopleSearchStrategiesParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<ClassicPeopleSearchGenerationResult> {
    const prompt = this.promptService.getClassicPeopleSearchPrompt();

    if (userMessage && classificationReasoning) {
      const strategyPrompt = SearchParametersPrompts.decidingWhichParametersToCreateForPeopleSearch(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'classic'
      );

      const multiStrategyResult = await this.streamClassicPeopleSearchParametersWithStrategies(
        openaiClient,
        prompt.system,
        strategyPrompt,
        userMessage,
        classificationReasoning,
        rawJDText || '',
        sendEvent,
      );

      if (multiStrategyResult) {
        this.logger.log(`Multi-strategy classic people parameter generation returned usable result: ${JSON.stringify(multiStrategyResult, null, 2)}`);
        return multiStrategyResult;
      }

      this.logger.warn('Multi-strategy classic people parameter generation returned no usable result. Falling back to single-call prompt.');
      const userPrioritizedPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'classic'
      );
      
      const fallbackParameters = await this.streamClassicPeopleSearchParametersWithSinglePrompt(
        openaiClient,
        prompt.system,
        userPrioritizedPrompt,
        parsedJobDescription,
        sendEvent,
      );
      return { primary: fallbackParameters };
    }

    const fallbackPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    const fallbackParameters = await this.streamClassicPeopleSearchParametersWithSinglePrompt(
      openaiClient,
      prompt.system,
      fallbackPrompt,
      parsedJobDescription,
      sendEvent,
    );
    return { primary: fallbackParameters };
  }

  private async streamClassicPeopleSearchParametersWithSinglePrompt(
    openaiClient: OpenAI,
    systemPrompt: string,
    userPrompt: string,
    parsedJobDescription: ParsedJobDescription,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>> {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];
    console.log(`Messages for classic people search: ${JSON.stringify(messages, null, 2)} ${userPrompt} }`);
    
    sendEvent?.('status', { message: 'Analyzing job requirements and generating search parameters...' });
    
    const stream = await this.createStreamingCompletion(
      openaiClient,
      messages,
      zodResponseFormat(
        classicPeopleSearchSchema,
        'classicPeopleSearch',
      ),
    );

    const fullContent = await this.processStreamChunks(stream, sendEvent);

    // For structured outputs, we need to parse the full JSON
    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated Classic People Search Parameters: ${JSON.stringify(result, null, 2)}`);

    // Fallback: if the model returned an empty object, synthesize minimal parameters from the JD
    if (!result || (typeof result === 'object' && Object.keys(result).length === 0)) {
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

  private async streamClassicPeopleSearchParametersWithStrategies(
    openaiClient: OpenAI,
    systemPrompt: string,
    strategyPrompt: string,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<ClassicPeopleSearchGenerationResult | null> {
    try {
      sendEvent?.('status', { message: 'Planning search strategy...' });
      
      const stream = await this.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: strategyPrompt },
        ],
        zodResponseFormat(
          classicPeopleStrategyPlanSchema,
          'classicPeopleStrategyPlan',
        ),
      );

      const fullContent = await this.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn('Strategy planning call returned empty content.');
        return null;
      }

      let strategyPlan: ClassicPeopleStrategyPlan | null = null;
      try {
        strategyPlan = JSON.parse(fullContent) as ClassicPeopleStrategyPlan;
      } catch (error) {
        this.logger.error(`Failed to parse classic people strategy plan: ${error}`);
      }

      if (!strategyPlan || !strategyPlan.strategies || strategyPlan.strategies.length === 0) {
        this.logger.warn('Strategy plan did not include any strategies.');
        return null;
      }

      const strategyResults: ClassicPeopleSearchStrategyResult[] = [];

      for (const strategy of strategyPlan.strategies) {
        sendEvent?.('status', { message: `Generating parameters for strategy: ${strategy.label}...` });
        
        const strategyOutcome = await this.streamClassicPeopleParametersForStrategy(
          openaiClient,
          systemPrompt,
          strategy,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
        );

        if (!strategyOutcome || !strategyOutcome.parameters) {
          this.logger.warn(`Skipping strategy "${strategy.label}" because no parameters were generated.`);
          continue;
        }

        strategyResults.push({
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
        });
      }

      if (strategyResults.length === 0) {
        this.logger.warn('All strategy parameter generations failed.');
        return null;
      }

      const primaryStrategy =
        strategyResults.find((strategy) => strategy.aggressiveness === 'balanced') ||
        strategyResults[0];

      return {
        primary: primaryStrategy.parameters,
        strategies: strategyResults,
      };
    } catch (error) {
      this.logger.error(`Multi-strategy classic people parameter generation failed: ${error}`);
      return null;
    }
  }

  private async streamClassicPeopleParametersForStrategy(
    openaiClient: OpenAI,
    systemPrompt: string,
    strategy: ClassicPeopleStrategyDefinition,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<{
    parameters: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> | null;
    parameterRationales: Record<ClassicPeopleParameterName, string>;
  } | null> {
    const aggregatedResult = createClassicPeopleBaseResult();
    const candidateRange = strategy.estimatedCandidateCount || { minimum: 40, maximum: 80 };
    const parameterDecisions: ClassicPeopleParameterSelection =
      strategy.parameterSelection ?? buildDefaultParameterSelection();
    const parameterRationales = Object.keys(parameterDecisions).reduce(
      (acc, key) => ({
        ...acc,
        [key as ClassicPeopleParameterName]: parameterDecisions[key as ClassicPeopleParameterName]
          ?.reasoning || '',
      }),
      {} as Record<ClassicPeopleParameterName, string>,
    );

    const parametersToGenerate = (Object.entries(parameterDecisions) as Array<
      [ClassicPeopleParameterName, { shouldGenerate: boolean; reasoning: string }]
    >).filter(([, decision]) => decision.shouldGenerate);

    if (parametersToGenerate.length === 0) {
      this.logger.warn(`Strategy "${strategy.label}" requested no parameters.`);
      return null;
    }

    let generatedAny = false;

    for (const [parameterName, decision] of parametersToGenerate) {
      sendEvent?.('status', { message: `Generating ${parameterName} parameter...: ` });
      
      const generationPrompt = SearchParametersPrompts.buildClassicPeopleParameterGenerationPrompt(
        parameterName,
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
          classicPeopleParameterSchemaMap[parameterName],
          `classicPeople${parameterName}Parameter`,
        ),
      );

      const fullContent = await this.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn(`Parameter generation for ${parameterName} returned empty content.`);
        continue;
      }

      try {
        const parsedParameter = JSON.parse(fullContent) as Record<string, unknown>;
        assignClassicPeopleParameterValue(
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
   * Stream generation of LinkedIn Classic Companies Search parameters
   */
  private async streamClassicCompaniesSearchParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getClassicCompaniesSearchPrompt();
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'companies',
        'classic'
      );
    } else {
      enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    }

    sendEvent?.('status', { message: 'Generating company search parameters...' });

    const stream = await this.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      zodResponseFormat(
        classicCompaniesSearchSchema,
        'classicCompaniesSearch',
      ),
    );

    const fullContent = await this.processStreamChunks(stream, sendEvent);

    return fullContent ? JSON.parse(fullContent) : {};
  }

  /**
   * Stream generation of LinkedIn Classic Jobs Search parameters
   */
  private async streamClassicJobsSearchParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getClassicJobsSearchPrompt();
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'jobs',
        'classic'
      );
    } else {
      enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
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

  /**
   * Stream generation of LinkedIn Sales Navigator People Search parameters with strategies
   */
  private async streamSalesNavigatorPeopleSearchStrategiesParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<SalesNavigatorPeopleSearchGenerationResult> {
    const prompt = this.promptService.getSalesNavigatorPeopleSearchPrompt();

    if (userMessage && classificationReasoning) {
      const strategyPrompt = SearchParametersPrompts.decidingWhichParametersToCreateForPeopleSearch(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'sales_navigator'
      );

      const multiStrategyResult = await this.streamSalesNavigatorPeopleSearchParametersWithStrategies(
        openaiClient,
        prompt.system,
        strategyPrompt,
        userMessage,
        classificationReasoning,
        rawJDText || '',
        sendEvent,
      );

      if (multiStrategyResult) {
        this.logger.log(`Multi-strategy Sales Navigator people parameter generation returned usable result: ${JSON.stringify(multiStrategyResult, null, 2)}`);
        return multiStrategyResult;
      }

      this.logger.warn('Multi-strategy Sales Navigator people parameter generation returned no usable result. Falling back to single-call prompt.');
      const userPrioritizedPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'sales_navigator'
      );
      const fallbackParameters = await this.streamSalesNavigatorPeopleSearchParametersWithSinglePrompt(
        openaiClient,
        prompt.system,
        userPrioritizedPrompt,
        parsedJobDescription,
        sendEvent,
      );
      return { primary: fallbackParameters };
    }

    const fallbackPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    const fallbackParameters = await this.streamSalesNavigatorPeopleSearchParametersWithSinglePrompt(
      openaiClient,
      prompt.system,
      fallbackPrompt,
      parsedJobDescription,
      sendEvent,
    );
    return { primary: fallbackParameters };
  }

  private async streamSalesNavigatorPeopleSearchParametersWithSinglePrompt(
    openaiClient: OpenAI,
    systemPrompt: string,
    userPrompt: string,
    parsedJobDescription: ParsedJobDescription,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>> {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];
    
    sendEvent?.('status', { message: 'Analyzing job requirements and generating search parameters...' });
    
    const stream = await this.createStreamingCompletion(
      openaiClient,
      messages,
      zodResponseFormat(
        salesNavigatorPeopleSearchSchema,
        'salesNavigatorPeopleSearch',
      ),
    );

    const fullContent = await this.processStreamChunks(stream, sendEvent);

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated Sales Navigator People Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  private async streamSalesNavigatorPeopleSearchParametersWithStrategies(
    openaiClient: OpenAI,
    systemPrompt: string,
    strategyPrompt: string,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<SalesNavigatorPeopleSearchGenerationResult | null> {
    try {
      sendEvent?.('status', { message: 'Planning search strategy...' });
      
      const stream = await this.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: strategyPrompt },
        ],
        zodResponseFormat(
          salesNavigatorPeopleStrategyPlanSchema,
          'salesNavigatorPeopleStrategyPlan',
        ),
      );

      const fullContent = await this.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn('Strategy planning call returned empty content.');
        return null;
      }

      let strategyPlan: any = null;
      try {
        strategyPlan = JSON.parse(fullContent);
      } catch (error) {
        this.logger.error(`Failed to parse Sales Navigator people strategy plan: ${error}`);
      }

      if (!strategyPlan || !strategyPlan.strategies || strategyPlan.strategies.length === 0) {
        this.logger.warn('Strategy plan did not include any strategies.');
        return null;
      }

      const strategyResults: SalesNavigatorPeopleSearchStrategyResult[] = [];

      for (const strategy of strategyPlan.strategies) {
        sendEvent?.('status', { message: `Generating parameters for strategy: ${strategy.label}...` });
        
        const strategyOutcome = await this.streamSalesNavigatorPeopleParametersForStrategy(
          openaiClient,
          systemPrompt,
          strategy,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
        );

        if (!strategyOutcome || !strategyOutcome.parameters) {
          this.logger.warn(`Skipping strategy "${strategy.label}" because no parameters were generated.`);
          continue;
        }

        strategyResults.push({
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
        });
      }

      if (strategyResults.length === 0) {
        this.logger.warn('All strategy parameter generations failed.');
        return null;
      }

      const primaryStrategy =
        strategyResults.find((strategy) => strategy.aggressiveness === 'balanced') ||
        strategyResults[0];

      return {
        primary: primaryStrategy.parameters,
        strategies: strategyResults,
      };
    } catch (error) {
      this.logger.error(`Multi-strategy Sales Navigator people parameter generation failed: ${error}`);
      return null;
    }
  }

  private async streamSalesNavigatorPeopleParametersForStrategy(
    openaiClient: OpenAI,
    systemPrompt: string,
    strategy: SalesNavigatorPeopleStrategyDefinition,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<{
    parameters: Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'> | null;
    parameterRationales: Record<SalesNavigatorPeopleParameterName, string>;
  } | null> {
    const aggregatedResult = createSalesNavigatorPeopleBaseResult();
    const candidateRange = strategy.estimatedCandidateCount || { minimum: 40, maximum: 80 };
    const parameterDecisions: SalesNavigatorPeopleParameterSelection =
      strategy.parameterSelection ?? buildDefaultSalesNavigatorPeopleParameterSelection();
    const parameterRationales = Object.keys(parameterDecisions).reduce(
      (acc, key) => ({
        ...acc,
        [key as SalesNavigatorPeopleParameterName]: parameterDecisions[key as SalesNavigatorPeopleParameterName]
          ?.reasoning || '',
      }),
      {} as Record<SalesNavigatorPeopleParameterName, string>,
    );

    const parametersToGenerate = (Object.entries(parameterDecisions) as Array<
      [SalesNavigatorPeopleParameterName, { shouldGenerate: boolean; reasoning: string }]
    >).filter(([, decision]) => decision.shouldGenerate);

    if (parametersToGenerate.length === 0) {
      this.logger.warn(`Strategy "${strategy.label}" requested no parameters.`);
      return null;
    }

    let generatedAny = false;

    for (const [parameterName, decision] of parametersToGenerate) {
      sendEvent?.('status', { message: `Generating ${parameterName} parameter...: ` });
      
      const generationPrompt = SearchParametersPrompts.buildSalesNavigatorPeopleParameterGenerationPrompt(
        parameterName,
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
          salesNavigatorPeopleParameterSchemaMap[parameterName],
          `salesNavigatorPeople${parameterName}Parameter`,
        ),
      );

      const fullContent = await this.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn(`Parameter generation for ${parameterName} returned empty content.`);
        continue;
      }

      try {
        const parsedParameter = JSON.parse(fullContent) as Record<string, unknown>;
        assignSalesNavigatorPeopleParameterValue(
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

  // /**
  //  * Stream generation of LinkedIn Sales Navigator People Search parameters
  //  */
  // private async streamSalesNavigatorPeopleSearchParameters(
  //   parsedJobDescription: ParsedJobDescription,
  //   openaiClient: OpenAI,
  //   userMessage?: string,
  //   classificationReasoning?: string,
  //   rawJDText?: string,
  //   sendEvent?: (event: string, data: any) => void,
  // ): Promise<Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>> {
  //   const prompt = this.promptService.getSalesNavigatorPeopleSearchPrompt();
    
  //   let enhancedUserPrompt: string;
    
  //   if (userMessage && classificationReasoning) {
  //     enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
  //       userMessage,
  //       classificationReasoning,
  //       rawJDText || '',
  //       'people',
  //       'sales_navigator'
  //     );
  //   } else {
  //     enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
  //   }
    
  //   this.logger.log(`User prompt: ${JSON.stringify(enhancedUserPrompt, null, 2)}`);
    
  //   sendEvent?.('status', { message: 'Generating Sales Navigator search parameters...' });

  //   const stream = await openaiClient.chat.completions.create({
  //     model: 'gpt-4.1',
  //     messages: [
  //       { role: 'system' as const, content: prompt.system },
  //       { role: 'user' as const, content: enhancedUserPrompt },
  //     ],
  //     stream: true,
  //     response_format: zodResponseFormat(
  //       salesNavigatorPeopleSearchSchema,
  //       'salesNavigatorPeopleSearch',
  //     ),
  //   });

  //   let fullContent = '';
  //   for await (const chunk of stream) {
  //     const delta = chunk.choices[0]?.delta?.content;
  //     if (delta) {
  //       fullContent += delta;
  //       sendEvent?.('chunk', { content: delta });
  //     }
  //   }

  //   const result = fullContent ? JSON.parse(fullContent) : {};
  //   this.logger.log(`AI Generated Sales Navigator People Search Parameters: ${JSON.stringify(result, null, 2)}`);
  //   return result;
  // }

  /**
   * Stream generation of LinkedIn Sales Navigator Companies Search parameters
   */
  private async streamSalesNavigatorCompaniesSearchParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getSalesNavigatorCompaniesSearchPrompt();
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'companies',
        'sales_navigator'
      );
    } else {
      enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    }

    sendEvent?.('status', { message: 'Generating Sales Navigator company search parameters...' });

    const stream = await this.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      zodResponseFormat(
        salesNavigatorCompaniesSearchSchema,
        'salesNavigatorCompaniesSearch',
      ),
    );

    const fullContent = await this.processStreamChunks(stream, sendEvent);

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated Sales Navigator Companies Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Stream generation of LinkedIn Recruiter People Search parameters with strategies
   */
  private async streamRecruiterPeopleSearchStrategiesParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<RecruiterPeopleSearchGenerationResult> {
    const prompt = this.promptService.getRecruiterPeopleSearchPrompt();

    if (userMessage && classificationReasoning) {
      const strategyPrompt = SearchParametersPrompts.decidingWhichParametersToCreateForPeopleSearch(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'recruiter'
      );

      const multiStrategyResult = await this.streamRecruiterPeopleSearchParametersWithStrategies(
        openaiClient,
        prompt.system,
        strategyPrompt,
        userMessage,
        classificationReasoning,
        rawJDText || '',
        sendEvent,
      );

      if (multiStrategyResult) {
        this.logger.log(`Multi-strategy Recruiter people parameter generation returned usable result: ${JSON.stringify(multiStrategyResult, null, 2)}`);
        return multiStrategyResult;
      }

      this.logger.warn('Multi-strategy Recruiter people parameter generation returned no usable result. Falling back to single-call prompt.');
      const userPrioritizedPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'recruiter'
      );
      const fallbackParameters = await this.streamRecruiterPeopleSearchParametersWithSinglePrompt(
        openaiClient,
        prompt.system,
        userPrioritizedPrompt,
        parsedJobDescription,
        sendEvent,
      );
      return { primary: fallbackParameters };
    }

    const fallbackPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    const fallbackParameters = await this.streamRecruiterPeopleSearchParametersWithSinglePrompt(
      openaiClient,
      prompt.system,
      fallbackPrompt,
      parsedJobDescription,
      sendEvent,
    );
    return { primary: fallbackParameters };
  }

  private async streamRecruiterPeopleSearchParametersWithSinglePrompt(
    openaiClient: OpenAI,
    systemPrompt: string,
    userPrompt: string,
    parsedJobDescription: ParsedJobDescription,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>> {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];
    
    sendEvent?.('status', { message: 'Analyzing job requirements and generating search parameters...' });
    
    const stream = await this.createStreamingCompletion(
      openaiClient,
      messages,
      zodResponseFormat(
        recruiterPeopleSearchSchema,
        'recruiterPeopleSearch',
      ),
    );

    const fullContent = await this.processStreamChunks(stream, sendEvent);

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated Recruiter People Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  private async streamRecruiterPeopleSearchParametersWithStrategies(
    openaiClient: OpenAI,
    systemPrompt: string,
    strategyPrompt: string,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<RecruiterPeopleSearchGenerationResult | null> {
    try {
      sendEvent?.('status', { message: 'Planning search strategy...' });
      
      const stream = await this.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: strategyPrompt },
        ],
        zodResponseFormat(
          recruiterPeopleStrategyPlanSchema,
          'recruiterPeopleStrategyPlan',
        ),
      );

      const fullContent = await this.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn('Strategy planning call returned empty content.');
        return null;
      }

      let strategyPlan: any = null;
      try {
        strategyPlan = JSON.parse(fullContent);
      } catch (error) {
        this.logger.error(`Failed to parse Recruiter people strategy plan: ${error}`);
      }

      if (!strategyPlan || !strategyPlan.strategies || strategyPlan.strategies.length === 0) {
        this.logger.warn('Strategy plan did not include any strategies.');
        return null;
      }

      const strategyResults: RecruiterPeopleSearchStrategyResult[] = [];

      for (const strategy of strategyPlan.strategies) {
        sendEvent?.('status', { message: `Generating parameters for strategy: ${strategy.label}...` });
        
        const strategyOutcome = await this.streamRecruiterPeopleParametersForStrategy(
          openaiClient,
          systemPrompt,
          strategy,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
        );

        if (!strategyOutcome || !strategyOutcome.parameters) {
          this.logger.warn(`Skipping strategy "${strategy.label}" because no parameters were generated.`);
          continue;
        }

        strategyResults.push({
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
        });
      }

      if (strategyResults.length === 0) {
        this.logger.warn('All strategy parameter generations failed.');
        return null;
      }

      const primaryStrategy =
        strategyResults.find((strategy) => strategy.aggressiveness === 'balanced') ||
        strategyResults[0];

      return {
        primary: primaryStrategy.parameters,
        strategies: strategyResults,
      };
    } catch (error) {
      this.logger.error(`Multi-strategy Recruiter people parameter generation failed: ${error}`);
      return null;
    }
  }

  private async streamRecruiterPeopleParametersForStrategy(
    openaiClient: OpenAI,
    systemPrompt: string,
    strategy: RecruiterPeopleStrategyDefinition,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<{
    parameters: Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'> | null;
    parameterRationales: Record<RecruiterPeopleParameterName, string>;
  } | null> {
    const aggregatedResult = createRecruiterPeopleBaseResult();
    const candidateRange = strategy.estimatedCandidateCount || { minimum: 40, maximum: 80 };
    const parameterDecisions: RecruiterPeopleParameterSelection =
      strategy.parameterSelection ?? buildDefaultRecruiterPeopleParameterSelection();
    const parameterRationales = Object.keys(parameterDecisions).reduce(
      (acc, key) => ({
        ...acc,
        [key as RecruiterPeopleParameterName]: parameterDecisions[key as RecruiterPeopleParameterName]
          ?.reasoning || '',
      }),
      {} as Record<RecruiterPeopleParameterName, string>,
    );

    const parametersToGenerate = (Object.entries(parameterDecisions) as Array<
      [RecruiterPeopleParameterName, { shouldGenerate: boolean; reasoning: string }]
    >).filter(([, decision]) => decision.shouldGenerate);

    if (parametersToGenerate.length === 0) {
      this.logger.warn(`Strategy "${strategy.label}" requested no parameters.`);
      return null;
    }

    let generatedAny = false;

    for (const [parameterName, decision] of parametersToGenerate) {
      sendEvent?.('status', { message: `Generating ${parameterName} parameter...: ` });
      
      const generationPrompt = SearchParametersPrompts.buildRecruiterPeopleParameterGenerationPrompt(
        parameterName,
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
          recruiterPeopleParameterSchemaMap[parameterName],
          `recruiterPeople${parameterName}Parameter`,
        ),
      );

      const fullContent = await this.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn(`Parameter generation for ${parameterName} returned empty content.`);
        continue;
      }

      try {
        const parsedParameter = JSON.parse(fullContent) as Record<string, unknown>;
        assignRecruiterPeopleParameterValue(
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

  // /**
  //  * Stream generation of LinkedIn Recruiter People Search parameters
  //  */
  // private async streamRecruiterPeopleSearchParameters(
  //   parsedJobDescription: ParsedJobDescription,
  //   openaiClient: OpenAI,
  //   userMessage?: string,
  //   classificationReasoning?: string,
  //   rawJDText?: string,
  //   sendEvent?: (event: string, data: any) => void,
  // ): Promise<Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>> {
  //   const prompt = this.promptService.getRecruiterPeopleSearchPrompt();
    
  //   let enhancedUserPrompt: string;
    
  //   if (userMessage && classificationReasoning) {
  //     enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
  //       userMessage,
  //       classificationReasoning,
  //       rawJDText || '',
  //       'people',
  //       'recruiter'
  //     );
  //   } else {
  //     enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
  //   }

  //   sendEvent?.('status', { message: 'Generating Recruiter search parameters...' });

  //   const stream = await this.createStreamingCompletion(
  //     openaiClient,
  //     [
  //       { role: 'system' as const, content: prompt.system },
  //       { role: 'user' as const, content: enhancedUserPrompt },
  //     ],
  //     zodResponseFormat(
  //       recruiterPeopleSearchSchema,
  //       'recruiterPeopleSearch',
  //     ),
  //   );

  //   const fullContent = await this.processStreamChunks(stream, sendEvent);

  //   const result = fullContent ? JSON.parse(fullContent) : {};
  //   this.logger.log(`AI Generated Recruiter People Search Parameters: ${JSON.stringify(result, null, 2)}`);
  //   return result;
  // }
}

