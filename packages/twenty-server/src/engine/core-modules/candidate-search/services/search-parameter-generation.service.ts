import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { inspect } from 'util';
import {
  LinkedInClassicCompaniesSearchRequest,
  LinkedInClassicJobsSearchRequest,
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorCompaniesSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { classicCompaniesSearchSchema } from '../schemas/linkedin-classic-companies-search.schema';
import { classicJobsSearchSchema } from '../schemas/linkedin-classic-jobs-search.schema';
import { salesNavigatorCompaniesSearchSchema } from '../schemas/linkedin-sales-navigator-companies-search.schema';
import {
  ParsedJobDescription
} from '../types/candidate-search-request.type';
import { TokenUsage } from '../utils/token-tracking.util';
import { StreamProcessingService } from './stream-processing.service';


type PeopleSearchParameters =
  | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
  | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
  | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>;

type PeopleSearchGenerationResult<T> = {
  strategies: T[];
};

@Injectable()
export class SearchParameterGenerationService {
  private readonly logger = new Logger(SearchParameterGenerationService.name);

  constructor(
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly streamProcessingService: StreamProcessingService,
  ) {}

  /**
   * Generate unresolved search parameters directly from boolean query
   * Generates array of search parameters for the specified search type
   * Includes retry logic with exponential backoff
   */
  // async generateUnresolvedParamsFromBooleanQuery(
  //   booleanQueryResponse: z.infer<typeof booleanQueryResponseSchema>,
  //   rawInput: string,
  //   searchType: 'classic' | 'sales_navigator' | 'recruiter',
  //   openaiClient: OpenAI,
  //   onTokenUsage?: (usage: TokenUsage) => void,
  //   sendEvent?: (event: string, data: any) => boolean | void,
  //   maxRetries: number = 2,
  // ): Promise<{ results: PeopleSearchParameters[]; reasoning: string | null }> {
  //   const systemPrompt = parameterGenerationPrompt(searchType as 'classic' | 'sales_navigator' | 'recruiter') as string;
  //   // Support both full and trimmed booleanQueryResponse objects.
  //   // Some callers (e.g. test-candidate-search-flow) may remove heavy fields like boolean_components
  //   // before sending to this method.
  //   const finalBooleanString =
  //     booleanQueryResponse?.boolean_components?.final_boolean_string ??
  //     // Fallback in case future shapes expose the final boolean string at the top level
  //     (booleanQueryResponse as any)?.final_boolean_string ??
  //     null;

  //   const userPromptSections: string[] = [];
  //   userPromptSections.push(`Raw Input: ${rawInput || 'N/A'}`);
  //   // userPromptSections.push(
  //   //   `Final Boolean String: ${finalBooleanString || 'N/A'}`,
  //   // );

  //   // Provide compact summary of boolean query response to the model, when available.
  //   const components = (booleanQueryResponse as any)?.boolean_components ?? {};
  //   if (components) {
  //     userPromptSections.push(
  //       `Boolean Query Summary:\n` +
  //       `- Job Title Block: ${components.job_title_block ?? 'N/A'}\n` +
  //       `- Industry Block: ${components.industry_block ?? 'N/A'}\n` +
  //       `- Skills Block: ${components.skills_block ?? 'N/A'}\n` +
  //       `- Mandatory Block: ${components.mandatory_block ?? 'N/A'}\n` +
  //       `- Location Block: ${components.location_block ?? 'N/A'}`,
  //     );
  //   }

  //   const userPrompt = userPromptSections.join('\n\n');

  //   const messages = [
  //     { role: 'system' as const, content: systemPrompt },
  //     { role: 'user' as const, content: userPrompt },
  //   ];
  //   this.logger.log(`Parameter generation messages: ${inspect(messages, { depth: null, colors: false, compact: false })}`);

  //   let schema: any;
  //   let schemaName: string;
    
  //   switch (searchType) {
  //     case 'classic':
  //       schema = classicPeopleSearchStrategiesSchema;
  //       schemaName = 'classicPeopleSearchStrategies';
  //       break;
  //     case 'sales_navigator':
  //       schema = salesNavigatorPeopleSearchStrategiesSchema;
  //       schemaName = 'salesNavigatorPeopleSearchStrategies';
  //       break;
  //     case 'recruiter':
  //       schema = recruiterPeopleSearchStrategiesSchema;
  //       schemaName = 'recruiterPeopleSearchStrategies';
  //       break;
  //   }

  //   let lastError: Error | null = null;

  //   for (let attempt = 0; attempt <= maxRetries; attempt++) {
  //     if (attempt > 0) {
  //       const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
  //       this.logger.log(`Retrying parameter generation from boolean query (attempt ${attempt + 1}/${maxRetries + 1}) after ${delayMs}ms delay`);
  //       sendEvent?.('status', { 
  //         message: `Retrying parameter generation (attempt ${attempt + 1}/${maxRetries + 1})...` 
  //       });
  //       await new Promise(resolve => setTimeout(resolve, delayMs));
  //     }

  //     const eventResult = sendEvent?.('status', { 
  //       message: `Generating ${searchType} search parameters from boolean query${attempt > 0 ? ` (retry ${attempt + 1})` : ''}...` 
  //     });
  //     if (eventResult === false) {
  //       this.logger.log('Stream aborted during parameter generation from boolean query');
  //       throw new Error('Stream aborted');
  //     }

  //     try {
  //       const streamResult = await this.streamProcessingService.executeStreamingLlmCall(
  //         () =>
  //           this.streamProcessingService.createStreamingCompletion(
  //             openaiClient,
  //             messages,
  //             zodResponseFormat(schema, schemaName),
  //           ),
  //         { sendEvent, maxRetries: 2 },
  //       );
  //       const fullContent = typeof streamResult === 'string' ? streamResult : streamResult.content;

  //       // Accumulate token usage if available
  //       if (typeof streamResult !== 'string' && streamResult.usage && onTokenUsage) {
  //         onTokenUsage(streamResult.usage);
  //       }

  //       if (!fullContent) {
  //         const error = new Error('Parameter generation from boolean query returned empty content');
  //         lastError = error;
  //         this.logger.warn(`Parameter generation from boolean query returned empty content (attempt ${attempt + 1}/${maxRetries + 1})`);
          
  //         if (attempt < maxRetries) {
  //           continue; // Retry
  //         }
  //         throw error;
  //       }

  //       try {
  //         const parsed = JSON.parse(fullContent);
  //         const validated = schema.parse(parsed);
  //         // Post-process each result to remove null/empty/zero keys and redundant filters
  //         validated.results.forEach((params: PeopleSearchParameters) => {
  //           this.removeUnwantedKeys(params);
  //           this.removeNullKeys(params);
  //           this.removeRedundantFilters(params, searchType);
  //         });
  //         this.logger.log(`Number of ${searchType} search parameters generated: ${validated.results.length}`);

  //         // this.logger.log(`Parameter generation for ${searchType} from boolean query after post-processing:: ${inspect(validated, { depth: null, colors: false, compact: false })} for finalBooleanString::  ${finalBooleanString} (attempt ${attempt + 1})`);
  //         return validated;
  //       } catch (parseError) {
  //         lastError = new Error(`Failed to parse parameters from boolean query: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  //         this.logger.error(`Failed to parse parameters from boolean query (attempt ${attempt + 1}/${maxRetries + 1}): ${parseError}`);
          
  //         if (attempt < maxRetries) {
  //           continue; // Retry
  //         }
  //         throw lastError;
  //       }
  //     } catch (error) {
  //       lastError = error instanceof Error ? error : new Error(String(error));
  //       this.logger.error(`Parameter generation from boolean query failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error}`);
        
  //       // Don't retry on stream abort
  //       if (error instanceof Error && error.message === 'Stream aborted') {
  //         throw error;
  //       }
        
  //       if (attempt < maxRetries) {
  //         continue; // Retry
  //       }
  //       throw lastError;
  //     }
  //   }

  //   // Should never reach here, but TypeScript needs it
  //   throw lastError || new Error('Parameter generation from boolean query failed after all retries');
  // }

  // private async processStrategyParameterResults(
  //   parameterResults: PromiseSettledResult<{ index: number; strategy: { label?: string; strategyText: string }; result: { parameters: any } | null }>[],
  //   queryUnderstandingText: string,
  //   userMessage: string,
  //   searchType: 'classic' | 'sales_navigator' | 'recruiter',
  //   openaiClient: OpenAI,
  //   sendEvent: ((event: string, data: any) => boolean | void) | undefined,
  //   apiToken: string,
  //   model: string,
  // ): Promise<Array<ClassicPeopleSearchStrategyResult | SalesNavigatorPeopleSearchStrategyResult | RecruiterPeopleSearchStrategyResult>> {
  //   const strategyResults: Array<ClassicPeopleSearchStrategyResult | SalesNavigatorPeopleSearchStrategyResult | RecruiterPeopleSearchStrategyResult> = [];

  //   for (let i = 0; i < parameterResults.length; i++) {
  //     const settledResult = parameterResults[i];

  //     if (settledResult.status === 'rejected') {
  //       this.logger.warn(`Strategy ${i + 1} parameter generation failed: ${settledResult.reason}`);
  //       continue;
  //     }

  //     const { index, strategy, result: parameterResult } = settledResult.value;
  //     if (!parameterResult || !parameterResult.parameters) {
  //       this.logger.warn(`Strategy ${index + 1} did not produce usable parameters`);
  //       continue;
  //     }

  //     const processedStrategies = await this.buildStrategyResultsFromParameters(
  //       index,
  //       strategy,
  //       queryUnderstanding,
  //       parameterResult.parameters,
  //       queryUnderstandingText,
  //       userMessage,
  //       searchType,
  //       openaiClient,
  //       sendEvent,
  //       model,
  //     );

  //     strategyResults.push(...processedStrategies);
  //   }

  //   return strategyResults;
  // }

  /**
   * Build strategy results from parameters
  //  */
  // private async buildStrategyResultsFromParameters(
  //   index: number,
  //   strategy: { label?: string; strategyText: string },
  //   parameters: PeopleSearchParameters,

  //   queryUnderstandingText: string,
  //   userMessage: string,
  //   searchType: 'classic' | 'sales_navigator' | 'recruiter',
  //   openaiClient: OpenAI,
  //   sendEvent: ((event: string, data: any) => boolean | void) | undefined,
  //   model: string,
  // ): Promise<Array<ClassicPeopleSearchStrategyResult | SalesNavigatorPeopleSearchStrategyResult | RecruiterPeopleSearchStrategyResult>> {

  //   const strategyMetadata = this.createStrategyMetadata(
  //     index,
  //     strategy,
  //     userMessage,
  //     queryUnderstanding,
  //   );

  //   if (searchType === 'classic') {
  //     const keywordTermCount = this.countKeywordTerms(parameters.keywords);

  //     if (keywordTermCount > 6) {
  //       this.logger.warn(
  //         `Strategy has ${keywordTermCount} keyword terms (exceeds 6-term limit for Classic). Skipping strategy. Keywords: "${parameters.keywords}". The sophisticated boolean query generation should have optimized this to <= 6 terms.`,
  //       );
  //       sendEvent?.('status', {
  //         message: `Skipping strategy with ${keywordTermCount} terms (exceeds Classic 6-term limit)`,
  //       });
  //       return [];
  //     }
  //   }

  //   const strategyResult = this.searchStrategyService.buildStrategyResult(
  //     parameters,
  //     searchType,
  //     index,
  //     parameters,
  //     userMessage,
  //     queryUnderstanding,
  //     finalBooleanString,
  //   );
  //   return [strategyResult];
  // }

  /**
   * Create strategy metadata from strategy and query understanding
  //  */
  // private createStrategyMetadata(
  //   index: number,
  //   strategy: { label?: string; strategyText: string },
  //   userMessage: string,
  // ): {
  //   id: string;
  //   label: string;
  //   description: string;
  //   strategyText: string;
  //   originalUserQuery: string;
  //   clarificationQuestions: any;
  //   clarificationAnswers: any;
  // } {
  //   return {
  //     id: `strategy-${index + 1}`,
  //     label: strategy.label || `Strategy ${index + 1}`,
  //     description: strategy.strategyText,
  //     strategyText: strategy.strategyText, // Preserve original strategy text as guideline
  //     originalUserQuery: userMessage, // Preserve original user query for traceability
  //     clarificationQuestions: null,
  //     clarificationAnswers: null,
  //   };
  // }

  /**
   * Build strategy results from parameter results
   * Processes, validates, and wraps parameters into strategy results
   */
  // private buildStrategyResultsFromParameters(
  //   parameterResults: PeopleSearchParameters[],
  //   searchType: 'classic' | 'sales_navigator' | 'recruiter',
  //   strategySummary: string,
  //   userMessage: string,
  //   reasoning: string | null,
  //   sendEvent: ((event: string, data: any) => boolean | void) | undefined,
  // ): Array<
  //   ClassicPeopleSearchStrategyResult |
  //   SalesNavigatorPeopleSearchStrategyResult |
  //   RecruiterPeopleSearchStrategyResult
  // > {
  //   const strategyResults: Array<
  //     ClassicPeopleSearchStrategyResult |
  //     SalesNavigatorPeopleSearchStrategyResult |
  //     RecruiterPeopleSearchStrategyResult
  //   > = [];

  //   for (let i = 0; i < parameterResults.length; i++) {
  //     const params = parameterResults[i];

  //     const processedParams = this.validateAndProcessParameters(
  //       params,
  //       i + 1,
  //       searchType,
  //       sendEvent,
  //     );

  //     if (!processedParams) {
  //       continue;
  //     }

  //     const strategyMetadata = this.createStrategyMetadata(
  //       i + 1,
  //       strategySummary,
  //       userMessage,
  //       reasoning,
  //     );

  //     const strategyResult = this.buildStrategyResult(
  //       processedParams,
  //       strategyMetadata,
  //       searchType,
  //     );

  //     strategyResults.push(strategyResult);
  //   }

  //   this.logger.log(`Generated ${strategyResults.length} strategy results`);
  //   return strategyResults;
  // }

  /**
   * Validate and process parameters (keywords validation + simplification)
   * Returns processed parameters or null if invalid
  //  */
  // private validateAndProcessParameters(
  //   params: PeopleSearchParameters,
  //   index: number,
  //   searchType: 'classic' | 'sales_navigator' | 'recruiter',
  //   sendEvent: ((event: string, data: any) => boolean | void) | undefined,
  // ): PeopleSearchParameters | null {
  //   // Validate keywords exist
  //   if (!params.keywords) {
  //     this.logger.warn(`Parameter set ${index} missing keywords, skipping`);
  //     return null;
  //   }

  //   // Validate and simplify keyword term count for Classic search
  //   if (searchType === 'classic') {
  //     const keywordTermCount = this.countKeywordTerms(params.keywords);
  //     if (keywordTermCount > 6) {
  //       const simplifiedParams = this.simplifyParametersIfNeeded(
  //         params,
  //         index,
  //         keywordTermCount,
  //         sendEvent,
  //       );
  //       return simplifiedParams;
  //     }
  //   }

  //   return params;
  // }

  /**
   * Simplify parameters if they exceed the term limit
   * Returns simplified parameters or null if simplification failed
  //  */
  // private simplifyParametersIfNeeded(
  //   params: PeopleSearchParameters,
  //   index: number,
  //   keywordTermCount: number,
  //   sendEvent: ((event: string, data: any) => boolean | void) | undefined,
  // ): PeopleSearchParameters | null {
  //   if (!params.keywords) {
  //     return null; // Should not happen as we validate before calling this
  //   }

  //   this.logger.warn(
  //     `Parameter set ${index} has ${keywordTermCount} keyword terms (exceeds 6-term limit for Classic). Attempting to simplify. Original keywords: "${params.keywords}"`,
  //   );
  //   sendEvent?.('status', {
  //     message: `Simplifying parameter set ${index} with ${keywordTermCount} terms to meet Classic 6-term limit`,
  //   });
    
  //   // Attempt to simplify the query
  //   const simplifiedKeywords = this.simplifyKeywordQuery(params.keywords, 6);
  //   const simplifiedTermCount = this.countKeywordTerms(simplifiedKeywords);
    
  //   if (simplifiedTermCount <= 6) {
  //     const simplifiedParams = { ...params, keywords: simplifiedKeywords };
  //     this.logger.log(
  //       `Parameter set ${index} simplified from ${keywordTermCount} to ${simplifiedTermCount} terms. Simplified keywords: "${simplifiedKeywords}"`,
  //     );
  //     return simplifiedParams;
  //   } else {
  //     this.logger.warn(
  //       `Parameter set ${index} could not be simplified below 6 terms (still ${simplifiedTermCount} terms). Skipping. Keywords: "${simplifiedKeywords}"`,
  //     );
  //     sendEvent?.('status', {
  //       message: `Skipping parameter set ${index} - could not simplify below 6-term limit`,
  //     });
  //     return null;
  //   }
  // }

  /**
   * Create strategy metadata for frontend compatibility
   */
  // private createStrategyMetadata(
  //   index: number,
  //   strategySummary: string,
  //   userMessage: string,
  //   reasoning: string | null,
  // ): {
  //   id: string;
  //   label: string;
  //   description: string;
  //   strategyText: string;
  //   originalUserQuery: string;
  //   clarificationQuestions: any;
  //   clarificationAnswers: any;
  // } {
  //   return {
  //     id: `strategy-${index}`,
  //     label: `Strategy ${index}`,
  //     description: reasoning || 'Generated from user query',
  //     strategyText: `Generated from user query: ${strategySummary.slice(0, 200)}${strategySummary.length > 200 ? '...' : ''}`,
  //     originalUserQuery: userMessage,
  //     clarificationQuestions: null,
  //     clarificationAnswers: null,
  //   };
  // }

  /**
   * Build strategy result from parameters and metadata based on search type
   */
  // private buildStrategyResult(
  //   params: PeopleSearchParameters,
  //   strategyMetadata: {
  //     id: string;
  //     label: string;
  //     description: string;
  //     strategyText: string;
  //     originalUserQuery: string;
  //     clarificationQuestions: any;
  //     clarificationAnswers: any;
  //   },
  //   searchType: 'classic' | 'sales_navigator' | 'recruiter',
  // ): ClassicPeopleSearchStrategyResult | SalesNavigatorPeopleSearchStrategyResult | RecruiterPeopleSearchStrategyResult {
  //   if (searchType === 'classic') {
  //     return {
  //       ...strategyMetadata,
  //       parameters: params as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
  //     } as ClassicPeopleSearchStrategyResult;
  //   } else if (searchType === 'sales_navigator') {
  //     return {
  //       ...strategyMetadata,
  //       parameters: params as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>,
  //     } as SalesNavigatorPeopleSearchStrategyResult;
  //   } else {
  //     return {
  //       ...strategyMetadata,
  //       parameters: params as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
  //     } as RecruiterPeopleSearchStrategyResult;
  //   }
  // }

  // async generateParamsFromStrategy(
  //   openaiClient: OpenAI,
  //   strategyText: string,
  //   queryUnderstandingText: string,
  //   userMessage: string,
  //   rawJDText: string,
  //   searchType: 'classic' | 'sales_navigator' | 'recruiter',
  //   sendEvent?: (event: string, data: any) => boolean | void,
  //   includeJd: boolean = true,
  //   onTokenUsage?: (usage: TokenUsage) => void,
  // ): Promise<{
  //   parameters: 
  //     | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
  //     | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
  //     | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  //     | null; 
  // } | null> {
  //   const eventResult = sendEvent?.('status', { message: 'Generating parameters from strategy...' });
  //   if (eventResult === false) {
  //     this.logger.log('Stream aborted during parameter generation from strategy text');
  //     return null;
  //   }

  //   const parameterGenerationSystemPrompt = this.searchParametersPrompts.getParameterGenerationFromStrategySystemPrompt(searchType);
  //   const parameterGenerationUserPrompt = this.searchParametersPrompts.buildParameterGenerationUserPromptFromStrategyText(
  //     strategyText,
  //     queryUnderstandingText,
  //     userMessage,
  //     includeJd ? rawJDText : '',
  //   );

  //   let schema: any;
  //   let schemaName: string;
    
  //   switch (searchType) {
  //     case 'classic':
  //       schema = classicPeopleSearchSchema;
  //       schemaName = 'classicPeopleSearch';
  //       break;
  //     case 'sales_navigator':
  //       schema = salesNavigatorPeopleSearchSchema;
  //       schemaName = 'salesNavigatorPeopleSearch';
  //       break;
  //     case 'recruiter':
  //       schema = recruiterPeopleSearchSchema;
  //       schemaName = 'recruiterPeopleSearch';
  //       break;
  //   }

  //   const parameterGeneration =   [
  //     { role: 'system' as const, content: parameterGenerationSystemPrompt },
  //     { role: 'user' as const, content: parameterGenerationUserPrompt },
  //   ];
  //   this.logger.log(`Parameter generation prompting:: ${JSON.stringify(parameterGeneration, null, 2)}`);

  //   const stream = await this.streamProcessingService.createStreamingCompletion(
  //     openaiClient,
  //     parameterGeneration,
  //     zodResponseFormat(schema, schemaName),
  //   );

  //   const streamResult = await this.streamProcessingService.processStreamChunks(stream, sendEvent);
  //   const fullContent = typeof streamResult === 'string' ? streamResult : streamResult.content;

  //   // Accumulate token usage if available
  //   if (typeof streamResult !== 'string' && streamResult.usage && onTokenUsage) {
  //     onTokenUsage(streamResult.usage);
  //   }

  //   if (!fullContent) {
  //     this.logger.warn('Parameter generation from strategy text returned empty content.');
  //     return null;
  //   }

  //   try {
  //     const parsed = JSON.parse(fullContent);
  //     const validated = schema.parse(parsed);
  //     this.logger.log(`Parameter generation from strategy text:: ${JSON.stringify(validated, null, 2)}`);
  //     // Post-process to remove redundant filters
  //     this.removeRedundantFilters(validated, searchType);

  //     if (!validated.keywords) {
  //       this.logger.warn('Generated parameters missing keywords, which are required.');
  //       return null;
  //     }

  //     return {
  //       parameters: validated,
  //     };
  //   } catch (error) {
  //     this.logger.error(`Failed to parse parameters from strategy text: ${error}`);
  //     return null;
  //   }
  // }

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
    onTokenUsage?: (usage: TokenUsage) => void,
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
    let systemPrompt: string;
    
    if (userMessage) {
      systemPrompt = this.searchParametersPrompts.getUserPrioritizedSystemPrompt(
        'companies',
        searchType
      );
      enhancedUserPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        includeJd ? (rawJDText || '') : '',
        'companies',
        searchType
      );
    } else {
      systemPrompt = prompt.system;
      // Template variables are already replaced in getCompaniesSearchPrompt
      enhancedUserPrompt = prompt.user;
    }

    sendEvent?.('status', { message: 'Generating company search parameters...' });

    const streamResult = await this.streamProcessingService.executeStreamingLlmCall(
      () =>
        this.streamProcessingService.createStreamingCompletion(
          openaiClient,
          [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: enhancedUserPrompt },
          ],
          zodResponseFormat(schema, schemaName),
        ),
      { sendEvent, maxRetries: 2 },
    );
    const fullContent = typeof streamResult === 'string' ? streamResult : streamResult.content;

    // Accumulate token usage if available
    if (typeof streamResult !== 'string' && streamResult.usage && onTokenUsage) {
      onTokenUsage(streamResult.usage);
    }

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated ${searchType} Companies Search Parameters: ${inspect(result, { depth: null, colors: false, compact: false })}`);
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
    let systemPrompt: string;
    
    if (userMessage) {
      systemPrompt = this.searchParametersPrompts.getUserPrioritizedSystemPrompt(
        'jobs',
        'classic'
      );
      enhancedUserPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        includeJd ? (rawJDText || '') : '',
        'jobs',
        'classic'
      );
    } else {
      systemPrompt = prompt.system;
      // Template variables are already replaced in getJobsSearchPrompt
      enhancedUserPrompt = prompt.user;
    }

    sendEvent?.('status', { message: 'Generating job search parameters...' });

    const streamResult = await this.streamProcessingService.executeStreamingLlmCall(
      () =>
        this.streamProcessingService.createStreamingCompletion(
          openaiClient,
          [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: enhancedUserPrompt },
          ],
          zodResponseFormat(
            classicJobsSearchSchema,
            'classicJobsSearch',
          ),
        ),
      { sendEvent, maxRetries: 2 },
    );
    const fullContent = typeof streamResult === 'string' ? streamResult : streamResult.content;

    return fullContent ? JSON.parse(fullContent) : {};
  }


  /**
   * Count the number of keyword terms in a boolean keyword string
   * Terms are counted as: quoted phrases (each is 1 term) + unquoted words separated by boolean operators
   */
  countKeywordTerms(keywords: string | null | undefined): number {
    if (!keywords || typeof keywords !== 'string') {
      return 0;
    }

    // Count quoted strings (each quoted phrase is one term)
    const quotedMatches = keywords.match(/"([^"]+)"/g) || [];
    const quotedCount = quotedMatches.length;

    // Remove quoted strings and count remaining unquoted terms
    const unquotedText = keywords.replace(/"([^"]+)"/g, '');
    
    // Remove any remaining boolean operators and parentheses (they're not terms)
    // This handles cases where only quoted phrases are present with operators between them
    const cleanedUnquotedText = unquotedText
      .replace(/\s+(?:AND|OR|NOT)\s+/gi, ' ') // Replace operators with single space
      .replace(/[()]/g, '') // Remove parentheses
      .trim();
    
    // Split by whitespace and count non-empty parts
    const unquotedParts = cleanedUnquotedText
      .split(/\s+/)
      .filter(p => p.length > 0 && !p.match(/^(AND|OR|NOT)$/i)); // Filter out empty and standalone operators

    return quotedCount + unquotedParts.length;
  }

  /**
   * Simplify a keyword query to meet the term limit by intelligently reducing terms
   * Prioritizes keeping the most important terms while preserving boolean structure
   */
  simplifyKeywordQuery(keywords: string, maxTerms: number): string {
    if (!keywords || typeof keywords !== 'string') {
      return keywords;
    }

    const currentTermCount = this.countKeywordTerms(keywords);
    if (currentTermCount <= maxTerms) {
      return keywords;
    }

    // Strategy 1: Try to preserve structure by reducing OR groups
    // Extract all terms with their original quoting
    const terms: Array<{ text: string; isQuoted: boolean; original: string }> = [];
    
    // Extract quoted phrases
    const quotedMatches = (keywords.match(/"([^"]+)"/g) ?? []) as string[];
    quotedMatches.forEach(match => {
      const text = match.replace(/"/g, '');
      terms.push({ text, isQuoted: true, original: match });
    });
    
    // Extract unquoted terms
    let unquotedText = keywords.replace(/"([^"]+)"/g, '');
    const unquotedTerms = unquotedText
      .replace(/\s+(?:AND|OR|NOT)\s+/gi, ' ')
      .replace(/[()]/g, '')
      .trim()
      .split(/\s+/)
      .filter(p => p.length > 0 && !p.match(/^(AND|OR|NOT)$/i));
    
    unquotedTerms.forEach(term => {
      if (!terms.some(t => t.text === term)) {
        terms.push({ text: term || '', isQuoted: false, original: term || '' });
      }
    });

    if (terms.length <= maxTerms) {
      return keywords; // Shouldn't happen, but safety check
    }

    // Priority: Keep quoted phrases first (more specific), then shorter unquoted terms
    const prioritizedTerms = terms.sort((a, b) => {
      if (a.isQuoted && !b.isQuoted) return -1;
      if (!a.isQuoted && b.isQuoted) return 1;
      return a.text.length - b.text.length;
    });

    // Take the top maxTerms
    const selectedTerms = prioritizedTerms.slice(0, maxTerms);
    
    // Reconstruct query preserving structure where possible
    // If original had AND/NOT structure, try to preserve it
    const hasAnd = /\s+AND\s+/i.test(keywords);
    const hasNot = /\s+NOT\s+/i.test(keywords);
    
    if (hasAnd || hasNot) {
      // Try to split into role terms and industry/domain terms
      // This is a heuristic - role terms are usually quoted or HR-related
      const roleTerms = selectedTerms.filter(t => 
        t.isQuoted || 
        /^(hr|chro|head|director|manager|vp|gm)$/i.test(t.text)
      );
      const otherTerms = selectedTerms.filter(t => !roleTerms.includes(t));
      
      if (roleTerms.length > 0 && otherTerms.length > 0) {
        const roleQuery = roleTerms
          .map(t => t.isQuoted ? `"${t.text}"` : t.text)
          .join(' OR ');
        const otherQuery = otherTerms
          .map(t => t.isQuoted ? `"${t.text}"` : t.text)
          .join(' OR ');
        
        if (hasNot && otherTerms.length > 0) {
          // If original had NOT, try to preserve it with a simplified structure
          return `(${roleQuery}) AND (${otherQuery})`;
        } else {
          return `(${roleQuery}) AND (${otherQuery})`;
        }
      }
    }
    
    // Fallback: Simple OR chain
    const simplifiedQuery = selectedTerms
      .map(t => t.isQuoted ? `"${t.text}"` : t.text)
      .join(' OR ');

    return simplifiedQuery;
  }

  /**
   * Remove unwanted keys from parameters object
   * Removes specific keys that should not be included in search parameters
   */
  removeUnwantedKeys(obj: any): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach(item => this.removeUnwantedKeys(item));
      return;
    }

    if (typeof obj === 'object') {
      const unwantedKeys = [
        'following_your_company',
        'viewed_your_profile_recently',
        'past_colleague',
        'shared_experiences',
        'changed_jobs',
        'posted_on_linkedin',
        'mentionned_in_news',
        'viewed_profile_recently',
        'messaged_recently',
        'include_saved_leads',
        'include_saved_accounts',
        'persona',
        'account_lists',
        'lead_lists',
        'past_applicants',
        'hide_previously_viewed',
        'has_military_background'
      ];

      unwantedKeys.forEach(key => {
        if (key in obj) {
          delete obj[key];
        }
      });

      // Recursively process nested objects
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
          this.removeUnwantedKeys(value);
        }
      });
    }
  }

  /**
   * Remove null, empty string, and zero keys from parameters object
   * Recursively removes null values, empty strings, and zero values from nested objects and arrays
   */
  removeNullKeys(obj: any): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach(item => this.removeNullKeys(item));
      return;
    }

    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      keys.forEach(key => {
        const value = obj[key];
        // Remove null, empty strings, and zero values
        if (value === null || value === '' || value === 0) {
          delete obj[key];
        } else if (typeof value === 'object') {
          this.removeNullKeys(value);
          // After processing nested object, check if it's now empty
          if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
            delete obj[key];
          }
        }
      });
    }
  }

  /**
   * Post-process parameters to remove redundant filters
   * Removes industry filter when company filter is present (company is more precise)
   */
  removeRedundantFilters(
    parameters: PeopleSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): void {
    // Remove industry filter if company filter is present (company is more precise)
    if (searchType === 'classic') {
      const classicParams = parameters;
      const hasCompany = classicParams.company && Array.isArray(classicParams.company) && classicParams.company.length > 0;
      const hasPastCompany = classicParams.past_company && Array.isArray(classicParams.past_company) && classicParams.past_company.length > 0;
      
      if ((hasCompany || hasPastCompany) && classicParams.industry) {
        this.logger.log(`Removing redundant industry filter because company filter is present (company: ${hasCompany ? (classicParams.company as string[]).join(', ') : 'none'}, past_company: ${hasPastCompany ? (classicParams.past_company as string[]).join(', ') : 'none'})`);
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

}

