import { Injectable } from '@nestjs/common';
import { LinkedInSearchTransformerService } from '../../candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { ResumeReaderService } from '../../candidate-sourcing/services/resume-reader.service';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { LinkedInSearchService } from '../../linkedin-search/services/linkedin-search.service';
import { LinkedInSearchResponse } from '../../linkedin-search/types/linkedin-search-response.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import {
    CandidateSearchResponse,
    ClassicPeopleSearchStrategyResult,
    GeneratedSearchParameters,
    ParsedJobDescription,
    QueryUnderstanding,
    RecruiterPeopleSearchStrategyResult,
    ResultValidationResult,
    SalesNavigatorPeopleSearchStrategyResult,
} from '../types/candidate-search-request.type';
import {
    FileUtils,
    LinkedinParameterResolver,
    ParameterSanitizer
} from '../utils';
import { CandidateScoringService } from './candidate-scoring.service';
import { CandidateSearchBaseService } from './candidate-search-base.service';
import { JobDescriptionService } from './job-description.service';
import { QuerySimplificationService } from './query-simplification.service';
import { ResultValidationService } from './result-validation.service';

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

@Injectable()
export class SearchExecutionService extends CandidateSearchBaseService {

  constructor(
    linkedInSearchService: LinkedInSearchService,
    workspaceQueryService: WorkspaceQueryService,
    linkedinParameterResolver: LinkedinParameterResolver,
    parameterSanitizer: ParameterSanitizer,
    fileUtils: FileUtils,
    linkedinSearchResultTransformer: LinkedInSearchTransformerService,
    staticGraphQLService: StaticGraphQLService,
    resumeReaderService: ResumeReaderService,
    jobDescriptionService: JobDescriptionService,
    querySimplificationService: QuerySimplificationService,
    private readonly resultValidationService: ResultValidationService,
    private readonly candidateScoringService: CandidateScoringService,
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
   * Execute a single page search (public wrapper for testing)
   */
  async executeSinglePageSearch(
    parsedJobDescription: ParsedJobDescription,
    searchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    options?: { cursor?: string; limit?: number },
    queryUnderstanding?: QueryUnderstanding,
    userMessage?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<CandidateSearchResponse> {
    return await this.searchCandidatesWithParameters(
      parsedJobDescription,
      searchParameters,
      searchType,
      searchCategory,
      apiToken,
      options,
      queryUnderstanding,
      userMessage,
      sendEvent,
    );
  }

  /**
   * Execute multi-page search with validation-based pagination
   */
  async executeMultiPageStrategySearch(
    parsedJobDescription: ParsedJobDescription,
    strategy: PeopleSearchStrategyResult,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    parameterKey: string,
    apiToken: string,
    queryUnderstanding: QueryUnderstanding | undefined,
    userMessage: string | undefined,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<SearchExecutionPreview | null> {
    const maxPages = Number(process.env.MAX_PAGES_PER_STRATEGY ?? 5);
    const targetMin = Number(process.env.TARGET_CANDIDATE_COUNT_MIN ?? 40);
    const targetMax = Number(process.env.TARGET_CANDIDATE_COUNT_MAX ?? 80);
    const pageLimit = 25; // LinkedIn default page size

    try {
      if (!strategy.parameters) {
        this.logger.warn(
          `Strategy ${strategy.id} has no parameters, skipping search`,
        );
        return null;
      }

      const strategyResolvedParams: GeneratedSearchParameters = {
        [parameterKey]: strategy.parameters,
      } as GeneratedSearchParameters;

      let allItems: any[] = [];
      let allTransformedCandidates: any[] = [];
      let currentCursor: string | undefined;
      let currentPage = 1;
      let hasMore = true;
      let firstPageConfig: any = {};
      const validationResults: Array<{
        page: number;
        validation: ResultValidationResult;
        timestamp: string;
      }> = [];
      const candidateScores = new Map<string, {
        relevanceScore: number;
        relevanceLabel: 'highly_relevant' | 'somewhat_relevant' | 'less_relevant';
        matchReasons: string[];
        mismatchReasons?: string[];
        roleMatch: boolean;
        companyMatch: boolean;
        locationMatch: boolean;
        reasoning: string;
      }>();

      this.logger.log(
        `Executing multi-page search for strategy ${strategy.id} (${strategy.label || 'unnamed'})`,
      );

      while (hasMore && currentPage <= maxPages) {
        const eventResult = sendEvent?.('status', { 
          message: `Fetching page ${currentPage} for strategy: ${strategy.label}...` 
        });
        if (eventResult === false) {
          this.logger.log('Stream aborted, stopping multi-page search');
          hasMore = false;
          break;
        }

        const response = await this.searchCandidatesWithParameters(
          parsedJobDescription,
          strategyResolvedParams,
          searchType,
          searchCategory,
          apiToken,
          { 
            cursor: currentCursor,
            limit: pageLimit,
          },
          queryUnderstanding,
          userMessage,
          sendEvent,
        );

        const pageItems = response.searchResults?.items || [];
        const pageTransformed = response.transformedCandidates || [];
        
        // Store config from first page
        if (currentPage === 1 && response.searchResults?.config) {
          firstPageConfig = response.searchResults.config;
        }
        
        if (pageItems.length === 0) {
          hasMore = false;
          break;
        }

        // Send event with page results count to frontend
        sendEvent?.('pageResults', {
          page: currentPage,
          candidatesReceived: pageItems.length,
          totalCandidates: allItems.length + pageItems.length,
          strategyId: strategy.id,
          strategyLabel: strategy.label,
        });

        allItems = [...allItems, ...pageItems];
        allTransformedCandidates = [...allTransformedCandidates, ...pageTransformed];
        currentCursor = response.searchResults?.cursor || undefined;

        this.logger.log(
          `Strategy ${strategy.id} page ${currentPage}: ${pageItems.length} candidates (total: ${allItems.length})`,
        );

        // Validate results for each page if query understanding is available
        if (queryUnderstanding && userMessage) {
          const eventResult = sendEvent?.('status', { 
            message: `Validating page ${currentPage} results for strategy: ${strategy.label}...` 
          });
          if (eventResult === false) {
            this.logger.log('Stream aborted, stopping validation');
            hasMore = false;
            break;
          }

          // Validate this page's results
          const validationResult = await this.resultValidationService.validateResultsAgainstQuery(
            pageItems,
            queryUnderstanding,
            userMessage,
            apiToken,
            sendEvent,
          );

          validationResults.push({
            page: currentPage,
            validation: validationResult,
            timestamp: new Date().toISOString(),
          });

          // Send validation result to frontend
          const falsePositivesText = validationResult.falsePositives && validationResult.falsePositives.length > 0
            ? `\nFalse positives: ${validationResult.falsePositives.slice(0, 3).join(', ')}${validationResult.falsePositives.length > 3 ? '...' : ''}`
            : '';
          const reasoningText = validationResult.reasoning ? `\n${validationResult.reasoning}` : '';
          sendEvent?.('validation', {
            page: currentPage,
            validation: validationResult,
            message: `Page ${currentPage} validation: ${validationResult.qualityAssessment} quality, ${(validationResult.relevanceScore * 100).toFixed(0)}% relevance${falsePositivesText}${reasoningText}`,
          });

          // Score candidates from this page
          if (pageItems.length > 0) {
            sendEvent?.('status', { 
              message: `Scoring ${pageItems.length} candidates from page ${currentPage}...` 
            });
            
            const pageScores = await this.candidateScoringService.scoreCandidatesBatch(
              pageItems,
              queryUnderstanding,
              userMessage,
              apiToken,
              parsedJobDescription,
              sendEvent,
            );
            
            // Merge scores into main map (use id, urn, or name as key)
            pageScores.forEach((score, candidateId) => {
              candidateScores.set(candidateId, score);
            });
          }

          // Decide whether to continue pagination
          // Check on every page to make dynamic decisions based on current results
          hasMore = this.resultValidationService.shouldContinuePagination(
            validationResult,
            allItems.length,
            targetMin,
            targetMax,
            maxPages,
            currentPage,
          );

          if (!hasMore) {
            this.logger.log(
              `Stopping pagination for strategy ${strategy.id} at page ${currentPage}: ${validationResult.reasoning || 'Validation determined no more pages needed'}`,
            );
            // Send status update about stopping pagination
            sendEvent?.('status', {
              message: `Stopping pagination after page ${currentPage}. ${validationResult.reasoning || 'Target candidate count reached or quality threshold met.'}`,
            });
          } else if (currentPage < maxPages) {
            // Log that we're continuing to next page
            this.logger.log(
              `Continuing pagination for strategy ${strategy.id}: page ${currentPage} validation passed, continuing to page ${currentPage + 1}`,
            );
          }
        } else if (!currentCursor) {
          // No more pages available
          hasMore = false;
        } else if (allItems.length >= targetMax) {
          // Reached target maximum
          hasMore = false;
        }

        currentPage++;
      }

      // Score all candidates if we have query understanding but haven't scored them yet
      if (queryUnderstanding && userMessage && candidateScores.size === 0 && allItems.length > 0) {
        sendEvent?.('status', { 
          message: `Scoring all ${allItems.length} candidates...` 
        });
        const allScores = await this.candidateScoringService.scoreCandidatesBatch(
          allItems,
          queryUnderstanding,
          userMessage,
          apiToken,
          parsedJobDescription,
          sendEvent,
        );
        allScores.forEach((score, candidateId) => {
          candidateScores.set(candidateId, score);
        });
      }

      // Attach relevance scores to transformed candidates
      if (candidateScores.size > 0) {
        allTransformedCandidates = allTransformedCandidates.map((candidate) => {
          // Try multiple ID fields to match with scores
          const candidateId = candidate.tempId || candidate.id || candidate.peopleId || '';
          const candidateName = candidate.name || '';
          
          // Try to find score by ID first, then by name
          const score = candidateScores.get(candidateId) || 
                       candidateScores.get(candidateName) ||
                       (candidateId ? candidateScores.get(candidateId) : null);
          
          if (score) {
            return {
              ...candidate,
              relevanceScore: score.relevanceScore,
              relevanceLabel: score.relevanceLabel,
              matchReasons: score.matchReasons,
              mismatchReasons: score.mismatchReasons,
            };
          }
          return candidate;
        });

        // Sort candidates by relevance score (highest first)
        allTransformedCandidates.sort((a, b) => {
          const scoreA = a.relevanceScore ?? 0;
          const scoreB = b.relevanceScore ?? 0;
          return scoreB - scoreA;
        });

        // Also sort raw items by relevance (for consistency)
        allItems.sort((a, b) => {
          const idA = a.id || a.urn || '';
          const idB = b.id || b.urn || '';
          const scoreA = candidateScores.get(idA)?.relevanceScore ?? 0;
          const scoreB = candidateScores.get(idB)?.relevanceScore ?? 0;
          return scoreB - scoreA;
        });
      }

      // Perform final validation on all results
      let overallValidation: ResultValidationResult | undefined;
      if (queryUnderstanding && userMessage && allItems.length > 0) {
        sendEvent?.('status', { 
          message: `Performing final validation on all results...` 
        });
        overallValidation = await this.resultValidationService.validateResultsAgainstQuery(
          allItems,
          queryUnderstanding,
          userMessage,
          apiToken,
          sendEvent,
        );
        
        const falsePositivesText = overallValidation.falsePositives && overallValidation.falsePositives.length > 0
          ? `\nFalse positives: ${overallValidation.falsePositives.slice(0, 3).join(', ')}${overallValidation.falsePositives.length > 3 ? '...' : ''}`
          : '';
        const reasoningText = overallValidation.reasoning ? `\n${overallValidation.reasoning}` : '';
        sendEvent?.('validation', {
          page: 'all',
          validation: overallValidation,
          message: `Overall validation: ${overallValidation.qualityAssessment} quality, ${(overallValidation.relevanceScore * 100).toFixed(0)}% relevance${falsePositivesText}${reasoningText}`,
        });
      }

      // Construct final response
      const finalResponse: LinkedInSearchResponse = {
        object: 'LinkedinSearch',
        items: allItems,
        config: firstPageConfig,
        paging: {
          start: 0,
          page_count: currentPage - 1,
          total_count: allItems.length,
        },
        cursor: currentCursor || null,
      };

      this.logger.log(
        `Strategy ${strategy.id} multi-page search completed: ${allItems.length} total candidates across ${currentPage - 1} pages`,
      );

      return {
        itemCount: allItems.length,
        searchResults: finalResponse,
        transformedCandidates: allTransformedCandidates.length > 0 ? allTransformedCandidates : undefined,
        searchMetadata: {
          searchType,
          searchCategory,
          timestamp: new Date().toISOString(),
          processingTime: 0, // Will be calculated by caller
        },
        validationResults: validationResults.length > 0 ? validationResults : undefined,
        overallValidation: overallValidation,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined;
      
      this.logger.error(
        `Failed to execute multi-page search for strategy ${strategy.id} (${strategy.label || 'unnamed'}):`,
        error,
      );
      
      let errorDetails: string | undefined;
      if (errorMessage.includes('Content too large')) {
        errorDetails = 'The search parameters are too complex. Try simplifying the search criteria.';
      } else if (errorMessage.includes('LinkedIn search failed')) {
        errorDetails = errorMessage.replace('LinkedIn search failed: ', '');
      }
      
      return {
        itemCount: 0,
        searchResults: null,
        transformedCandidates: undefined,
        searchMetadata: undefined,
        error: {
          message: errorMessage,
          code: errorCode,
          details: errorDetails || errorMessage,
        },
      };
    }
  }
}

