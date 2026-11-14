import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { toOpenAiJsonSchemaResponseFormat } from 'src/engine/core-modules/llm-chat-model/utils/to-openai-json-schema-format.util';
import { inspect } from 'util';
import {
  LinkedInClassicCompaniesSearchRequest,
  LinkedInClassicJobsSearchRequest,
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorCompaniesSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
} from 'src/domains/discovery/transport/linkedin-search/types/linkedin-search-request.type';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { classicCompaniesSearchSchema } from '../schemas/linkedin-classic-companies-search.schema';
import { classicJobsSearchSchema } from '../schemas/linkedin-classic-jobs-search.schema';
import { salesNavigatorCompaniesSearchSchema } from '../schemas/linkedin-sales-navigator-companies-search.schema';
import {
  ParsedJobDescription
} from 'src/domains/discovery/query/types/candidate-search-request.type';
import { TokenUsage } from 'src/engine/core-modules/llm-chat-model/utils/token-tracking.util';
import { StreamProcessingService } from 'src/engine/core-modules/llm-chat-model/services/stream-processing.service';


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

  async streamCompaniesSearchParameters(
    openaiClient: OpenAI,
    searchType: 'classic' | 'sales_navigator',
    userMessage?: string,
    parsedJobDescription?: ParsedJobDescription,
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
          toOpenAiJsonSchemaResponseFormat(schema, schemaName),
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
   * Stream generation of LinkedIn Classic Projects Search parameters
   */
  async streamJobsSearchParameters(
    openaiClient: OpenAI,
    userMessage?: string,
    parsedJobDescription?: ParsedJobDescription,
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
          toOpenAiJsonSchemaResponseFormat(
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

