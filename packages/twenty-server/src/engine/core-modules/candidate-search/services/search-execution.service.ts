import { Injectable } from '@nestjs/common';
import { CandidateRelevanceScoring } from 'src/engine/core-modules/candidate-search/schemas/candidate-relevance-scoring.schema';
import { LinkedInSearchTransformerService, TransformedCandidateForTable } from '../../candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { ResumeReaderService } from '../../candidate-sourcing/services/resume-reader.service';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { LinkedInSearchService } from '../../linkedin-search/services/linkedin-search.service';
import {
  LinkedInSearchConfig,
  LinkedInSearchResponse,
  LinkedInSearchResult
} from '../../linkedin-search/types/linkedin-search-response.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import {
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  ParsedJobDescription,
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
import { JobDescriptionService } from './job-description.service';
// import { QuerySimplificationService } from './query-simplification.service';
import { QueryUnderstanding } from 'src/engine/core-modules/candidate-search/schemas/query-understanding.schema';
import { ResultValidationService } from './result-validation.service';

type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

type SearchExecutionPreview = {
  itemCount: number;
  searchResults: LinkedInSearchResponse | null;
  transformedCandidates?: TransformedCandidateForTable[];
  searchMetadata?: {
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
    timestamp: string;
    processingTime: number;
  };
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
    // querySimplificationService: QuerySimplificationService,
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
      // querySimplificationService,
    );
  }

  /**
   * Executes a multi-page search strategy, fetching and processing candidates across multiple pages
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
    const targetMax = Number(process.env.TARGET_CANDIDATE_COUNT_MAX ?? 80);
    const pageLimit = 25;

    try {
      if (!strategy.parameters) {
        this.logger.warn(`Strategy ${strategy.id} has no parameters, skipping search`);
        return null;
      }

      const strategyResolvedParams: GeneratedSearchParameters = {
        [parameterKey]: strategy.parameters,
      } as GeneratedSearchParameters;

      const state = {
        allItems: [] as LinkedInSearchResult[],
        allTransformedCandidates: [] as TransformedCandidateForTable[],
        currentCursor: undefined as string | undefined,
        currentPage: 1,
        firstPageConfig: { params: {} } as LinkedInSearchConfig,
        validationResults: [] as Array<{
          page: number;
          validation: ResultValidationResult;
          timestamp: string;
        }>,
        candidateScores: new Map<string, CandidateRelevanceScoring>(),
      };

      this.logger.log(
        `Executing multi-page search for strategy ${strategy.id} (${strategy.label || 'unnamed'})`,
      );

      // Main pagination loop
      while (state.currentPage <= maxPages) {
        if (this.shouldAbort(sendEvent)) {
          this.logger.log('Stream aborted, stopping multi-page search');
          break;
        }

        const pageResult = await this.fetchPage(
          strategyResolvedParams,
          searchType,
          searchCategory,
          apiToken,
          state.currentCursor,
          pageLimit,
          sendEvent,
        );

        if (!pageResult || pageResult.items.length === 0) {
          break;
        }

        // Store first page config
        if (state.currentPage === 1 && pageResult.config) {
          state.firstPageConfig = pageResult.config;
        }

        // Accumulate results
        state.allItems.push(...pageResult.items);
        state.allTransformedCandidates.push(...pageResult.transformed);
        state.currentCursor = pageResult.cursor ?? undefined;

        this.logger.log(
          `Strategy ${strategy.id} page ${state.currentPage}: ${pageResult.items.length} candidates (total: ${state.allItems.length})`,
        );


        sendEvent?.('pageResults', {
          page: state.currentPage,
          candidatesReceived: pageResult.items.length,
          totalCandidates: state.allItems.length,
          totalCountFromAPI: pageResult.paging?.total_count,
          strategyId: strategy.id,
          strategyLabel: strategy.label,
        });

        // Process page if validation/scoring is enabled
        if (queryUnderstanding && userMessage) {
          const shouldContinue = await this.processPageResults(
            pageResult.items,
            pageResult.transformed,
            state.currentPage,
            state.allItems.length,
            strategy,
            searchCategory,
            searchType,
            parsedJobDescription,
            queryUnderstanding,
            userMessage,
            apiToken,
            state.candidateScores,
            state.validationResults,
            maxPages,
            sendEvent,
          );

          if (!shouldContinue) {
            break;
          }
        } else if (!state.currentCursor || state.allItems.length >= targetMax) {
          break;
        }

        state.currentPage++;
      }

      // Final processing
      this.attachScoresToAllCandidates(state.allTransformedCandidates, state.allItems, state.candidateScores);
      const overallValidation = await this.performFinalValidation(
        state.allItems,
        queryUnderstanding,
        userMessage,
        apiToken,
        sendEvent,
      );

      this.sendFinalBatch(state.allTransformedCandidates, state.candidateScores, strategy, sendEvent);

      return this.buildResponse(
        state.allItems,
        state.allTransformedCandidates,
        state.firstPageConfig,
        state.currentCursor,
        state.currentPage,
        state.validationResults,
        overallValidation,
        searchType,
        searchCategory,
        strategy.id,
      );
    } catch (error) {
      return this.handleError(error, strategy);
    }
  }

  private shouldAbort(sendEvent?: (event: string, data: any) => boolean | void): boolean {
    const eventResult = sendEvent?.('status', { message: 'Checking stream status...' });
    return eventResult === false;
  }

  private async fetchPage(
    strategyResolvedParams: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    cursor: string | undefined,
    pageLimit: number,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<{
    items: LinkedInSearchResult[];
    transformed: TransformedCandidateForTable[];
    cursor?: string | null;
    config?: LinkedInSearchConfig;
    paging?: { total_count: number };
  } | null> {
    sendEvent?.('status', { message: `Fetching page...` });

    const accountId = await this.getLinkedInAccountId(apiToken);

    const searchResults = await this.executeLinkedInSearch(
      strategyResolvedParams,
      searchType,
      searchCategory,
      accountId,
      { cursor, limit: pageLimit },
    );

    if (!searchResults) {
      this.logger.log('No search results returned');
      return null;
    }
    this.logger.log(
      `Search results items length: ${searchResults.items?.length ?? 0}`,
    );

    let transformedCandidates: TransformedCandidateForTable[] = [];
    if (searchResults.items && searchCategory === 'people') {
      transformedCandidates = this.linkedinSearchResultTransformer.transformSearchResultsToTableFormat(
        searchResults.items,
        'linkedin_search_job',
        `${searchType} ${searchCategory} search results`,
      );
      
      transformedCandidates = this.linkedinSearchResultTransformer.addMetadataToCandidates(
        transformedCandidates,
        {
          searchType,
          searchCategory,
          timestamp: new Date().toISOString(),
          processingTime: 0,
        },
      );
    }

    return {
      items: searchResults.items || [],
      transformed: transformedCandidates,
      cursor: searchResults.cursor ?? undefined,
      config: searchResults.config,
      paging: searchResults.paging,
    };
  }

  private async processPageResults(
    pageItems: LinkedInSearchResult[],
    pageTransformed: TransformedCandidateForTable[],
    currentPage: number,
    totalItemsCount: number,
    strategy: PeopleSearchStrategyResult,
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    parsedJobDescription: ParsedJobDescription,
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    apiToken: string,
    candidateScores: Map<string, CandidateRelevanceScoring>,
    validationResults: Array<{ page: number; validation: ResultValidationResult; timestamp: string }>,
    maxPages: number,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<boolean> {
    if (this.shouldAbort(sendEvent)) {
      this.logger.log('Stream aborted, stopping validation');
      return false;
    }

    sendEvent?.('status', { message: `Validating page ${currentPage} results...` });
    // Validate page results
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

    this.sendValidationEvent(currentPage, validationResult, sendEvent);

    // Score candidates
    if (pageItems.length > 0) {
      sendEvent?.('status', { message: `Scoring ${pageItems.length} candidates...` });

      const pageScores = await this.candidateScoringService.scoreCandidatesBatch(
        pageItems,
        queryUnderstanding,
        searchCategory,
        searchType,
        userMessage,
        apiToken,
        parsedJobDescription,
        sendEvent,
        strategy.strategyText,
      );

      await this.logPageScoresAndValidation(pageScores, currentPage, pageItems, validationResult);

      // Merge scores
      pageScores.forEach((score, candidateId) => {
        candidateScores.set(candidateId, score);
      });

      // Attach scores and send batch
      const pageTransformedWithScores = this.attachScoresToCandidates(pageTransformed, pageScores);
      sendEvent?.('candidateBatch', {
        strategyId: strategy.id,
        strategyLabel: strategy.label,
        page: currentPage,
        transformedCandidates: pageTransformedWithScores,
        totalCandidatesSoFar: totalItemsCount,
      });
    }

    // Decide whether to continue
    const shouldContinue = this.resultValidationService.shouldContinuePagination(
      validationResult,
      totalItemsCount,
      maxPages,
      currentPage,
    );

    if (!shouldContinue) {
      this.logger.log(
        `Stopping pagination for strategy ${strategy.id} at page ${currentPage}: ${validationResult.reasoning || 'Validation determined no more pages needed'}`,
      );
      sendEvent?.('status', {
        message: `Stopping pagination after page ${currentPage}. ${validationResult.reasoning || 'Target candidate count reached or quality threshold met.'}`,
      });
    } else if (currentPage < maxPages) {
      this.logger.log(
        `Continuing pagination for strategy ${strategy.id}: page ${currentPage} validation passed, continuing to page ${currentPage + 1}`,
      );
    }

    return shouldContinue;
  }

  private sendValidationEvent(
    page: number | 'all',
    validationResult: ResultValidationResult,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): void {
    const falsePositivesText = validationResult.falsePositives?.length
      ? `\nFalse positives: ${validationResult.falsePositives.slice(0, 3).join(', ')}${validationResult.falsePositives.length > 3 ? '...' : ''}`
      : '';
    const reasoningText = validationResult.reasoning ? `\n${validationResult.reasoning}` : '';
    const pageLabel = page === 'all' ? 'Overall' : `Page ${page}`;

    sendEvent?.('validation', {
      page,
      validation: validationResult,
      message: `${pageLabel} validation: ${validationResult.qualityAssessment} quality, ${(validationResult.relevanceScore * 100).toFixed(0)}% relevance${falsePositivesText}${reasoningText}`,
    });
  }

  private attachScoresToCandidates(
    candidates: TransformedCandidateForTable[],
    scores: Map<string, CandidateRelevanceScoring>,
  ): TransformedCandidateForTable[] {
    return candidates.map((candidate) => {
      const candidateId = candidate.tempId || candidate.id || candidate.peopleId || '';
      const candidateName = candidate.name || '';
      const score = scores.get(candidateId) || scores.get(candidateName);

      if (!score) {
        return candidate;
      }

      return {
        ...candidate,
        relevanceScore: score.relevanceScore ?? undefined,
        relevanceLabel: score.relevanceLabel ?? undefined,
        matchReasons: score.matchReasons ?? undefined,
        mismatchReasons: score.mismatchReasons ?? undefined,
      };
    });
  }

  private attachScoresToAllCandidates(
    allTransformedCandidates: TransformedCandidateForTable[],
    allItems: LinkedInSearchResult[],
    candidateScores: Map<string, CandidateRelevanceScoring>,
  ): void {
    if (candidateScores.size === 0) {
      return;
    }

    // Attach scores to transformed candidates
    const candidatesWithScores = this.attachScoresToCandidates(allTransformedCandidates, candidateScores);
    allTransformedCandidates.length = 0;
    allTransformedCandidates.push(...candidatesWithScores);

    // Sort by relevance score
    allTransformedCandidates.sort((a, b) => {
      const scoreA = a.relevanceScore ?? 0;
      const scoreB = b.relevanceScore ?? 0;
      return scoreB - scoreA;
    });

    // Sort raw items by relevance
    allItems.sort((a, b) => {
      const getId = (item: LinkedInSearchResult): string => {
        if (item.id) return item.id;
        if (item.type === 'PEOPLE' && 'member_urn' in item) {
          return item.member_urn || '';
        }
        return '';
      };
      const idA = getId(a);
      const idB = getId(b);
      const scoreA = candidateScores.get(idA)?.relevanceScore ?? 0;
      const scoreB = candidateScores.get(idB)?.relevanceScore ?? 0;
      return scoreB - scoreA;
    });
  }

  private async performFinalValidation(
    allItems: LinkedInSearchResult[],
    queryUnderstanding: QueryUnderstanding | undefined,
    userMessage: string | undefined,
    apiToken: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<ResultValidationResult | undefined> {
    if (!queryUnderstanding || !userMessage || allItems.length === 0) {
      return undefined;
    }

    sendEvent?.('status', { message: `Performing final validation on all results...` });

    const overallValidation = await this.resultValidationService.validateResultsAgainstQuery(
      allItems,
      queryUnderstanding,
      userMessage,
      apiToken,
      sendEvent,
    );

    this.sendValidationEvent('all', overallValidation, sendEvent);

    return overallValidation;
  }

  private sendFinalBatch(
    allTransformedCandidates: TransformedCandidateForTable[],
    candidateScores: Map<string, CandidateRelevanceScoring>,
    strategy: PeopleSearchStrategyResult,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): void {
    if (allTransformedCandidates.length > 0 && candidateScores.size > 0 && sendEvent) {
      sendEvent('candidateBatch', {
        strategyId: strategy.id,
        strategyLabel: strategy.label,
        page: 'final',
        transformedCandidates: allTransformedCandidates,
        totalCandidatesSoFar: allTransformedCandidates.length,
        isFinalBatch: true,
      });
    }
  }

  private buildResponse(
    allItems: LinkedInSearchResult[],
    allTransformedCandidates: TransformedCandidateForTable[],
    firstPageConfig: LinkedInSearchConfig,
    currentCursor: string | undefined,
    currentPage: number,
    validationResults: Array<{ page: number; validation: ResultValidationResult; timestamp: string }>,
    overallValidation: ResultValidationResult | undefined,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    strategyId: string,
  ): SearchExecutionPreview {
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
      `Strategy ${strategyId} multi-page search completed: ${allItems.length} total candidates across ${currentPage - 1} pages`,
    );

    return {
      itemCount: allItems.length,
      searchResults: finalResponse,
      transformedCandidates: allTransformedCandidates.length > 0 ? allTransformedCandidates : undefined,
      searchMetadata: {
        searchType,
        searchCategory,
        timestamp: new Date().toISOString(),
        processingTime: 0,
      },
      validationResults: validationResults.length > 0 ? validationResults : undefined,
      overallValidation,
    };
  }

  private handleError(error: unknown, strategy: PeopleSearchStrategyResult): SearchExecutionPreview {
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



  async logPageScoresAndValidation(
    pageScores: Map<string, CandidateRelevanceScoring>,
    currentPage: number,
    pageItems: LinkedInSearchResult[],
    validationResult: ResultValidationResult,
  ) {
    // Calculate average relevance score for this page
    const pageRelevanceScores = Array.from(pageScores.values())
      .map(score => score.relevanceScore)
      .filter((score): score is number => score !== null && score !== undefined);
    const averagePageScore = pageRelevanceScores.length > 0
      ? pageRelevanceScores.reduce((sum, score) => sum + score, 0) / pageRelevanceScores.length
      : 0;
    
    if (pageRelevanceScores.length > 0) {
      this.logger.log(
        `Page ${currentPage} candidate scores - Average: ${(averagePageScore * 100).toFixed(2)}%, ` +
        `Count: ${pageRelevanceScores.length}, ` +
        `Min: ${(Math.min(...pageRelevanceScores) * 100).toFixed(2)}%, ` +
        `Max: ${(Math.max(...pageRelevanceScores) * 100).toFixed(2)}%`
      );
    } else {
      this.logger.log(
        `Page ${currentPage} candidate scores - No scores available (${pageItems.length} candidates)`
      );
    }
    
    // Compare average candidate score with validation result
    if (validationResult) {
      const validationScore = validationResult.relevanceScore;
      const scoreDifference = averagePageScore - validationScore;
      const scoreDifferencePercent = (scoreDifference * 100).toFixed(2);
      
      this.logger.log(
        `Page ${currentPage} score comparison - ` +
        `Average candidate score: ${(averagePageScore * 100).toFixed(2)}%, ` +
        `Validation score: ${(validationScore * 100).toFixed(2)}%, ` +
        `Difference: ${scoreDifference > 0 ? '+' : ''}${scoreDifferencePercent}% ` +
        `(${pageRelevanceScores.length} candidates scored)`
      );
    }
  }

  /**
   * Transform search results to table format
   */
  transformSearchResults(
    items: LinkedInSearchResult[],
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): TransformedCandidateForTable[] {
    if (!items || items.length === 0 || searchCategory !== 'people') {
      return [];
    }

    let transformed = this.linkedinSearchResultTransformer.transformSearchResultsToTableFormat(
      items,
      'linkedin_search_job',
      `${searchType} ${searchCategory} search results`,
    );
    
    transformed = this.linkedinSearchResultTransformer.addMetadataToCandidates(
      transformed,
      {
        searchType,
        searchCategory,
        timestamp: new Date().toISOString(),
        processingTime: 0,
      },
    );

    return transformed;
  }
}

