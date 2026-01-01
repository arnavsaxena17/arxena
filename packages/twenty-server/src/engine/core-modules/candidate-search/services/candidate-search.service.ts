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
export class CandidateSearchService extends CandidateSearchBaseService {
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
   * Generate LinkedIn search parameters based on parsed job description
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

      // Generate parameters based on search type and category
      if (searchType === 'classic') {
        if (searchCategory === 'people') {
          const classicPeopleResult = await this.generateClassicPeopleSearch(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
          );
          generatedParameters.classicPeopleSearch = classicPeopleResult.primary;
          if (classicPeopleResult.strategies && classicPeopleResult.strategies.length > 0) {
            generatedParameters.classicPeopleSearchStrategies = classicPeopleResult.strategies;
          }
        } else if (searchCategory === 'companies') {
          generatedParameters.classicCompaniesSearch = await this.generateClassicCompaniesSearch(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
          );
        } else if (searchCategory === 'jobs') {
          generatedParameters.classicJobsSearch = await this.generateClassicJobsSearch(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
          );
        }
      } else if (searchType === 'sales_navigator') {
        if (searchCategory === 'people') {
          generatedParameters.salesNavigatorPeopleSearch = await this.generateSalesNavigatorPeopleSearch(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
          );
        } else if (searchCategory === 'companies') {
          generatedParameters.salesNavigatorCompaniesSearch = await this.generateSalesNavigatorCompaniesSearch(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
          );
        }
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        generatedParameters.recruiterPeopleSearch = await this.generateRecruiterPeopleSearch(
          parsedJobDescription,
          openaiClient,
          userMessage,
          classificationReasoning,
          rawJDText,
        );
      }

      return generatedParameters;
    } catch (error) {
      this.logger.error(`Failed to generate search parameters for ${searchType} ${searchCategory}: ${error}`);
      throw error;
    }
  }

  /**
   * Generate LinkedIn Classic People Search parameters
   */
  private async generateClassicPeopleSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
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

      const multiStrategyResult = await this.generateClassicPeopleSearchWithStrategies(
        openaiClient,
        prompt.system,
        strategyPrompt,
        userMessage,
        classificationReasoning,
        rawJDText || '',
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
      const fallbackParameters = await this.generateClassicPeopleSearchWithSinglePrompt(
        openaiClient,
        prompt.system,
        userPrioritizedPrompt,
        parsedJobDescription,
      );
      return { primary: fallbackParameters };
    }

    const fallbackPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    const fallbackParameters = await this.generateClassicPeopleSearchWithSinglePrompt(
      openaiClient,
      prompt.system,
      fallbackPrompt,
      parsedJobDescription,
    );
    return { primary: fallbackParameters };
  }

  private async generateClassicPeopleSearchWithSinglePrompt(
    openaiClient: OpenAI,
    systemPrompt: string,
    userPrompt: string,
    parsedJobDescription: ParsedJobDescription,
  ): Promise<Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>> {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];
    console.log(`Messages for classic people search: ${JSON.stringify(messages, null, 2)} ${userPrompt} }`);
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages,
      response_format: zodResponseFormat(
        classicPeopleSearchSchema,
        'classicPeopleSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    const result = content ? JSON.parse(content) : {};
    this.logger.log(`AI Generated Classic People Search Parameters: ${JSON.stringify(result, null, 2)}`);

    // Fallback: if the model returned an empty object, synthesize minimal parameters from the JD
    if (!result || (typeof result === 'object' && Object.keys(result).length === 0)) {
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

  private async generateClassicPeopleSearchWithStrategies(
    openaiClient: OpenAI,
    systemPrompt: string,
    strategyPrompt: string,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
  ): Promise<ClassicPeopleSearchGenerationResult | null> {
    try {
      const strategyCompletion = await openaiClient.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: strategyPrompt },
        ],
        response_format: zodResponseFormat(
          classicPeopleStrategyPlanSchema,
          'classicPeopleStrategyPlan',
        ),
      });

      const planContent = strategyCompletion.choices[0].message.content;
      if (!planContent) {
        this.logger.warn('Strategy planning call returned empty content.');
        return null;
      }

      let strategyPlan: ClassicPeopleStrategyPlan | null = null;
      try {
        strategyPlan = JSON.parse(planContent) as ClassicPeopleStrategyPlan;
      } catch (error) {
        this.logger.error(`Failed to parse classic people strategy plan: ${error}`);
      }

      if (!strategyPlan || !strategyPlan.strategies || strategyPlan.strategies.length === 0) {
        this.logger.warn('Strategy plan did not include any strategies.');
        return null;
      }

      const strategyResults: ClassicPeopleSearchStrategyResult[] = [];

      for (const strategy of strategyPlan.strategies) {
        const strategyOutcome = await this.generateClassicPeopleParametersForStrategy(
          openaiClient,
          systemPrompt,
          strategy,
          userMessage,
          classificationReasoning,
          rawJDText,
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

  private async generateClassicPeopleParametersForStrategy(
    openaiClient: OpenAI,
    systemPrompt: string,
    strategy: ClassicPeopleStrategyDefinition,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
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

      const parameterCompletion = await openaiClient.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: generationPrompt },
        ],
        response_format: zodResponseFormat(
          classicPeopleParameterSchemaMap[parameterName],
          `classicPeople${parameterName}Parameter`,
        ),
      });

      const parameterContent = parameterCompletion.choices[0].message.content;
      if (!parameterContent) {
        this.logger.warn(`Parameter generation for ${parameterName} returned empty content.`);
        continue;
      }

      try {
        const parsedParameter = JSON.parse(parameterContent) as Record<string, unknown>;
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
   * Generate LinkedIn Classic Companies Search parameters
   */
  private async generateClassicCompaniesSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
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

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      response_format: zodResponseFormat(
        classicCompaniesSearchSchema,
        'classicCompaniesSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    return content ? JSON.parse(content) : {};
  }

  /**
   * Generate LinkedIn Classic Jobs Search parameters
   */
  private async generateClassicJobsSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
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

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      response_format: zodResponseFormat(
        classicJobsSearchSchema,
        'classicJobsSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    return content ? JSON.parse(content) : {};
  }

  /**
   * Generate LinkedIn Sales Navigator People Search parameters
   */
  private async generateSalesNavigatorPeopleSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
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
    
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      response_format: zodResponseFormat(
        salesNavigatorPeopleSearchSchema,
        'salesNavigatorPeopleSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    const result = content ? JSON.parse(content) : {};
    this.logger.log(`AI Generated Sales Navigator People Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Generate LinkedIn Sales Navigator Companies Search parameters
   */
  private async generateSalesNavigatorCompaniesSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
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

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      response_format: zodResponseFormat(
        salesNavigatorCompaniesSearchSchema,
        'salesNavigatorCompaniesSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    const result = content ? JSON.parse(content) : {};
    this.logger.log(`AI Generated Sales Navigator Companies Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Generate LinkedIn Recruiter People Search parameters
   */
  private async generateRecruiterPeopleSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
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

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      response_format: zodResponseFormat(
        recruiterPeopleSearchSchema,
        'recruiterPeopleSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    const result = content ? JSON.parse(content) : {};
    this.logger.log(`AI Generated Recruiter People Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }
}
