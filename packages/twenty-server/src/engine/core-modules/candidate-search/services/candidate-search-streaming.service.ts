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
import { recruiterPeopleSearchSchema } from '../schemas/recruiter-people-search.schema';
import { salesNavigatorCompaniesSearchSchema } from '../schemas/sales-navigator-companies-search.schema';
import { salesNavigatorPeopleSearchSchema } from '../schemas/sales-navigator-people-search.schema';

import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import {
    ClassicPeopleSearchStrategyResult,
    GeneratedSearchParameters,
    ParsedJobDescription
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
    buildDefaultParameterSelection,
    classicPeopleParameterSchemaMap,
    createClassicPeopleBaseResult,
} from './candidate-search-utils';
import { JobDescriptionService } from './job-description.service';

type ClassicPeopleSearchGenerationResult = {
  primary: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>;
  strategies?: ClassicPeopleSearchStrategyResult[];
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
  async generateSearchParametersFromLLMStream(
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
      if (userMessage) {
        this.logger.log(`User message: ${userMessage}`);
      }
      if (classificationReasoning) {
        this.logger.log(`Classification reasoning: ${classificationReasoning}`);
      }

      // Fetch raw JD text from job attachments if jobId is provided
      let rawJDText = '';
      if (jobId) {
        rawJDText = await this.jobDescriptionService.getJDContentFromJobAttachments(jobId, apiToken);
        this.logger.log(`Fetched raw JD text, length: ${rawJDText.length} characters`);
      }

      sendEvent?.('status', { message: `Generating ${searchType} ${searchCategory} search parameters...:` });

      // Generate parameters based on search type and category with streaming
      if (searchType === 'classic') {
        if (searchCategory === 'people') {
          const classicPeopleResult = await this.generateClassicPeopleSearchStream(
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
          generatedParameters.classicCompaniesSearch = await this.generateClassicCompaniesSearchStream(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
            sendEvent,
          );
        } else if (searchCategory === 'jobs') {
          generatedParameters.classicJobsSearch = await this.generateClassicJobsSearchStream(
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
          generatedParameters.salesNavigatorPeopleSearch = await this.generateSalesNavigatorPeopleSearchStream(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
            sendEvent,
          );
        } else if (searchCategory === 'companies') {
          generatedParameters.salesNavigatorCompaniesSearch = await this.generateSalesNavigatorCompaniesSearchStream(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
            sendEvent,
          );
        }
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        generatedParameters.recruiterPeopleSearch = await this.generateRecruiterPeopleSearchStream(
          parsedJobDescription,
          openaiClient,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
        );
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
    async generateSearchParameters(
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    userMessage?: string,
    classificationReasoning?: string,
    jobId?: string,
  ): Promise<GeneratedSearchParameters> {
    // For streaming, we need sendEvent but base class doesn't have it
    // So we'll throw an error if called without streaming
    throw new Error('Use generateSearchParametersFromLLMStream for streaming support');
  }

  /**
   * Generate LinkedIn Classic People Search parameters with streaming
   */
  private async generateClassicPeopleSearchStream(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<ClassicPeopleSearchGenerationResult> {
    const prompt = this.promptService.getClassicPeopleSearchPrompt();

    if (userMessage && classificationReasoning) {
      const strategyPrompt = SearchParametersPrompts.decidingWhichParametersToCreateForClassicPeopleSearch(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'classic'
      );

      const multiStrategyResult = await this.generateClassicPeopleSearchWithStrategiesStream(
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
      const fallbackParameters = await this.generateClassicPeopleSearchWithSinglePromptStream(
        openaiClient,
        prompt.system,
        userPrioritizedPrompt,
        parsedJobDescription,
        sendEvent,
      );
      return { primary: fallbackParameters };
    }

    const fallbackPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    const fallbackParameters = await this.generateClassicPeopleSearchWithSinglePromptStream(
      openaiClient,
      prompt.system,
      fallbackPrompt,
      parsedJobDescription,
      sendEvent,
    );
    return { primary: fallbackParameters };
  }

  private async generateClassicPeopleSearchWithSinglePromptStream(
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
    
    const stream = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages,
      stream: true,
      response_format: zodResponseFormat(
        classicPeopleSearchSchema,
        'classicPeopleSearch',
      ),
    });

    let fullContent = '';
    let streamedText = '';
    
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        streamedText += delta;
        fullContent += delta;
        // Send incremental updates to frontend
        sendEvent?.('chunk', { content: delta });
      }
    }

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

  private async generateClassicPeopleSearchWithStrategiesStream(
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
      
      const stream = await openaiClient.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: strategyPrompt },
        ],
        stream: true,
        response_format: zodResponseFormat(
          classicPeopleStrategyPlanSchema,
          'classicPeopleStrategyPlan',
        ),
      });

      let fullContent = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          sendEvent?.('chunk', { content: delta });
        }
      }

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
        
        const strategyOutcome = await this.generateClassicPeopleParametersForStrategyStream(
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

  private async generateClassicPeopleParametersForStrategyStream(
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

      const stream = await openaiClient.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: generationPrompt },
        ],
        stream: true,
        response_format: zodResponseFormat(
          classicPeopleParameterSchemaMap[parameterName],
          `classicPeople${parameterName}Parameter`,
        ),
      });

      let fullContent = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          sendEvent?.('chunk', { content: delta });
        }
      }

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
   * Generate LinkedIn Classic Companies Search parameters with streaming
   */
  private async generateClassicCompaniesSearchStream(
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

    const stream = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      stream: true,
      response_format: zodResponseFormat(
        classicCompaniesSearchSchema,
        'classicCompaniesSearch',
      ),
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        sendEvent?.('chunk', { content: delta });
      }
    }

    return fullContent ? JSON.parse(fullContent) : {};
  }

  /**
   * Generate LinkedIn Classic Jobs Search parameters with streaming
   */
  private async generateClassicJobsSearchStream(
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

    const stream = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      stream: true,
      response_format: zodResponseFormat(
        classicJobsSearchSchema,
        'classicJobsSearch',
      ),
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        sendEvent?.('chunk', { content: delta });
      }
    }

    return fullContent ? JSON.parse(fullContent) : {};
  }

  /**
   * Generate LinkedIn Sales Navigator People Search parameters with streaming
   */
  private async generateSalesNavigatorPeopleSearchStream(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getSalesNavigatorPeopleSearchPrompt();
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'sales_navigator'
      );
    } else {
      enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    }
    
    this.logger.log(`User prompt: ${JSON.stringify(enhancedUserPrompt, null, 2)}`);
    
    sendEvent?.('status', { message: 'Generating Sales Navigator search parameters...' });

    const stream = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      stream: true,
      response_format: zodResponseFormat(
        salesNavigatorPeopleSearchSchema,
        'salesNavigatorPeopleSearch',
      ),
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        sendEvent?.('chunk', { content: delta });
      }
    }

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated Sales Navigator People Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Generate LinkedIn Sales Navigator Companies Search parameters with streaming
   */
  private async generateSalesNavigatorCompaniesSearchStream(
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

    const stream = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      stream: true,
      response_format: zodResponseFormat(
        salesNavigatorCompaniesSearchSchema,
        'salesNavigatorCompaniesSearch',
      ),
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        sendEvent?.('chunk', { content: delta });
      }
    }

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated Sales Navigator Companies Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Generate LinkedIn Recruiter People Search parameters with streaming
   */
  private async generateRecruiterPeopleSearchStream(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getRecruiterPeopleSearchPrompt();
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'recruiter'
      );
    } else {
      enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    }

    sendEvent?.('status', { message: 'Generating Recruiter search parameters...' });

    const stream = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      stream: true,
      response_format: zodResponseFormat(
        recruiterPeopleSearchSchema,
        'recruiterPeopleSearch',
      ),
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        sendEvent?.('chunk', { content: delta });
      }
    }

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated Recruiter People Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }
}

