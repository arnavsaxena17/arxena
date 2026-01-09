import { Injectable } from '@nestjs/common';
import { LinkedInSearchTransformerService } from '../../candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { ResumeReaderService } from '../../candidate-sourcing/services/resume-reader.service';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { LinkedInSearchService } from '../../linkedin-search/services/linkedin-search.service';
import {
  LinkedInClassicCompaniesSearchRequest,
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorCompaniesSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest
} from '../../linkedin-search/types/linkedin-search-request.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import {
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  ParsedJobDescription,
  QueryUnderstanding,
  RecruiterPeopleSearchStrategyResult,
  ResultValidationResult,
  SalesNavigatorPeopleSearchStrategyResult
} from '../types/candidate-search-request.type';
import {
  FileUtils,
  LinkedinParameterResolver,
  ParameterSanitizer
} from '../utils';
import { CandidateScoringService } from './candidate-scoring.service';
import { CandidateSearchBaseService } from './candidate-search-base.service';
import { DiscoveryService } from './discovery.service';
import { JobDescriptionService } from './job-description.service';
import { QuerySimplificationService } from './query-simplification.service';
import { QueryUnderstandingService } from './query-understanding.service';
import { ResultValidationService } from './result-validation.service';
import { SearchExecutionService } from './search-execution.service';
import { SearchParameterGenerationService } from './search-parameter-generation.service';
import { SearchStrategyService } from './search-strategy.service';
import { StreamProcessingService } from './stream-processing.service';

type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

type SearchExecutionPreview = {
  itemCount: number;
  searchResults: any;
  transformedCandidates?: any;
  searchMetadata?: any;
  validationResults?: Array<{
    page: number;
    validation: ResultValidationResult;
    timestamp: string;
  }>;
  overallValidation?: ResultValidationResult;
  error?: {
    message: string;
    code?: string;
    details?: string;
  };
};

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
    querySimplificationService: QuerySimplificationService,
    private readonly discoveryService: DiscoveryService,
    private readonly streamProcessingService: StreamProcessingService,
    private readonly queryUnderstandingService: QueryUnderstandingService,
    private readonly searchStrategyService: SearchStrategyService,
    private readonly searchParameterGenerationService: SearchParameterGenerationService,
    private readonly candidateScoringService: CandidateScoringService,
    private readonly resultValidationService: ResultValidationService,
    private readonly searchExecutionService: SearchExecutionService,
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
      querySimplificationService,
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
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding,
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
        this.logger.log(`Classification reasoning in stream Search Parameters And Strategies: ${classificationReasoning}`);

      const rawJDText = includeJd && jobId
        ? await this.jobDescriptionService.getJDContentFromJobAttachments(jobId, apiToken)
        : '';
      
      if (rawJDText && includeJd) {
        this.logger.log(`Fetched raw JD text, length: ${rawJDText.length} characters`);
      } else if (!includeJd) {
        this.logger.log(`JD content excluded from prompts (includeJd=false)`);
      }

      const eventSent = sendEvent?.('status', { message: `Generating ${searchType} ${searchCategory} search parameters...` });
      if (eventSent === false) {
        this.logger.log('Stream aborted, stopping parameter generation');
        return generatedParameters;
      }

      // Handle people search (same logic for all search types)
      if (searchCategory === 'people') {
        const peopleResult = await this.searchParameterGenerationService.streamPeopleSearchStrategiesParameters(
          parsedJobDescription,
          openaiClient,
          searchType,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
          includeJd,
          queryUnderstanding, // Pass queryUnderstanding to avoid re-computation
          apiToken,
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
        const companiesResult = await this.searchParameterGenerationService.streamCompaniesSearchParameters(
          parsedJobDescription,
          openaiClient,
          searchType,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
          includeJd,
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
        generatedParameters.classicJobsSearch = await this.searchParameterGenerationService.streamJobsSearchParameters(
          parsedJobDescription,
          openaiClient,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
          includeJd,
        );
        return generatedParameters;
      }

      return generatedParameters;
    } catch (error) {
      this.logger.error(`Failed to generate search parameters for ${searchType} ${searchCategory}: ${error}`);
      throw error;
    }
  }
}

