/**
 * Test Controller for Candidate Search
 * 
 * This controller provides HTTP endpoints for testing candidate search functions.
 * It's designed for testing and scripting.
 */

import { Body, Controller, HttpException, HttpStatus, Logger, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { TransformedCandidateForTable } from '../../candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { CandidateRelevanceScoring } from '../schemas/candidate-relevance-scoring.schema';
import { CandidateScoringService } from '../services/candidate-scoring.service';
import { CandidateSearchStreamingService } from '../services/candidate-search-streaming.service';
import { QueryUnderstandingService } from '../services/query-understanding.service';
import { ResultValidationService } from '../services/result-validation.service';
import { SearchExecutionService } from '../services/search-execution.service';
import {
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  ParsedJobDescription,
  QueryUnderstanding,
  RecruiterPeopleSearchStrategyResult,
  SalesNavigatorPeopleSearchStrategyResult,
  ResultValidationResult as ValidationResult,
} from '../types/candidate-search-request.type';
import { LinkedInSearchResult } from '../types/linkedin-search-result.type';

type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

export interface QueryUnderstandingResult {
  queryUnderstanding: QueryUnderstanding;
  clarifyingQuestions?: string[];
}

export interface SearchStrategiesResult {
  strategies: PeopleSearchStrategyResult[];
}

export interface SearchParametersResult {
  searchParameters: GeneratedSearchParameters;
  searchStrategies?: PeopleSearchStrategyResult[];
  searchUrls?: string[];
}

export interface SearchResultsResult {
  searchResultsPages: Array<{
    page: number;
    candidates: (LinkedInSearchResult | TransformedCandidateForTable)[];
  }>;
  allResults: (LinkedInSearchResult | TransformedCandidateForTable)[];
}

export interface ResultValidationResponse {
  validation: ValidationResult;
}

@Controller('candidate-search/test')
export class CandidateSearchTestController {
  private readonly logger = new Logger(CandidateSearchTestController.name);

  constructor(
    private readonly candidateSearchStreamingService: CandidateSearchStreamingService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly queryUnderstandingService: QueryUnderstandingService,
    private readonly candidateScoringService: CandidateScoringService,
    private readonly resultValidationService: ResultValidationService,
    private readonly searchExecutionService: SearchExecutionService,
  ) {}

  /**
   * Check if request is aborted
   */
  private isRequestAborted(req: Request): boolean {
    // Check explicit abort flags
    if (req.aborted || req.destroyed) {
      return true;
    }
    
    // Only check socket if it exists (socket may not be available immediately in some cases)
    if (req.socket) {
      return req.socket.destroyed === true;
    }
    
    // If socket doesn't exist, don't assume aborted - it might just not be available yet
    return false;
  }

  /**
   * Setup request abort listener
   */
  private setupAbortListener(req: Request, operationName: string): () => void {
    let isAborted = false;
    
    const abortHandler = () => {
      isAborted = true;
      this.logger.log(`Request aborted during ${operationName}`);
    };

    req.on('close', abortHandler);
    req.on('aborted', abortHandler);
    
    // Return cleanup function
    return () => {
      req.removeListener('close', abortHandler);
      req.removeListener('aborted', abortHandler);
    };
  }

  /**
   * Test endpoint for query understanding (non-streaming)
   */
  @Post('understand-query')
  async testUnderstandQuery(
    @Body() body: {
      prompt: string;
      rawJDText?: string;
      isClarificationResponse?: boolean;
    },
    @Req() req: Request,
  ): Promise<QueryUnderstandingResult> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Understanding query: "${body.prompt.substring(0, 50)}..."`);

      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } =
        await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const queryUnderstanding = await this.queryUnderstandingService.understandQuery(
        openaiClient,
        body.prompt,
        body.rawJDText || '',
        undefined, // sendEvent
        body.isClarificationResponse || false,
      );

      const result: QueryUnderstandingResult = {
        queryUnderstanding,
      };

      if (queryUnderstanding.needsClarification) {
        result.clarifyingQuestions = queryUnderstanding.clarificationQuestions || [];
        this.logger.log(`Clarification needed: ${result.clarifyingQuestions.length} questions`);
      }

      return result;
    } catch (error) {
      this.logger.error('Error understanding query:', error);
      throw new HttpException(
        error.message || 'Failed to understand query',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint for generating search strategies
   */
  @Post('generate-search-strategies')
  async testGenerateSearchStrategies(
    @Body() body: {
      prompt: string;
      parsedJobDescription: ParsedJobDescription;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
      queryUnderstanding?: QueryUnderstanding;
    },
    @Req() req: Request,
  ): Promise<SearchStrategiesResult> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Generating search strategies for: "${body.prompt.substring(0, 50)}..."`);

      if (body.searchCategory !== 'people') {
        throw new HttpException('Search strategies are only available for people searches', HttpStatus.BAD_REQUEST);
      }

      const generatedParams =
        await this.candidateSearchStreamingService.generateUnresolvedSearchParams(
          body.parsedJobDescription,
          body.searchType,
          body.searchCategory,
          apiToken,
          body.prompt,
          undefined, // jobId
          undefined, // sendEvent
          false, // includeJd
          body.queryUnderstanding,
        );

      const searchParamKey = `${body.searchType.replace(/_([a-z])/g, (_, l) =>
        l.toUpperCase(),
      )}${body.searchCategory.charAt(0).toUpperCase() + body.searchCategory.slice(1)}Search`;

      const strategiesKey = `${searchParamKey}Strategies`;
      const strategies = generatedParams[strategiesKey] || [];

      return { strategies };
    } catch (error) {
      this.logger.error('Error generating search strategies:', error);
      throw new HttpException(
        error.message || 'Failed to generate search strategies',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint for generating search parameters
   */
  @Post('generate-search-parameters')
  async testGenerateSearchParameters(
    @Body() body: {
      prompt: string;
      parsedJobDescription: ParsedJobDescription;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
      queryUnderstanding?: QueryUnderstanding;
    },
    @Req() req: Request,
  ): Promise<SearchParametersResult> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Generating search parameters for: "${body.prompt.substring(0, 50)}..."`);

      const unresolvedSearchParams: GeneratedSearchParameters =
        await this.candidateSearchStreamingService.generateUnresolvedSearchParams(
          body.parsedJobDescription,
          body.searchType,
          body.searchCategory,
          apiToken,
          body.prompt,
          undefined, // jobId
          undefined, // sendEvent
          false, // includeJd
          body.queryUnderstanding,
        );

      const searchParamKey = `${body.searchType.replace(/_([a-z])/g, (_, l) =>
        l.toUpperCase(),
      )}${body.searchCategory.charAt(0).toUpperCase() + body.searchCategory.slice(1)}Search`;

      const primaryParams = unresolvedSearchParams[searchParamKey] || unresolvedSearchParams;
      const strategiesKey = `${searchParamKey}Strategies`;
      const strategies = body.searchCategory === 'people' ? unresolvedSearchParams[strategiesKey] || [] : undefined;

      // Generate URLs
      const { generateLinkedInSearchUrl } = await import('../utils/search-parameter.utils');
      const urls: string[] = [];
      
      if (primaryParams) {
        const primaryUrl = generateLinkedInSearchUrl(primaryParams, body.searchType, body.searchCategory);
        if (primaryUrl) {
          urls.push(primaryUrl);
        }
      }

      if (strategies) {
        strategies.forEach((strategy) => {
          if (strategy.parameters) {
            const strategyUrl = generateLinkedInSearchUrl(
              strategy.parameters,
              body.searchType,
              body.searchCategory,
            );
            if (strategyUrl) {
              urls.push(strategyUrl);
            }
          }
        });
      }
      this.logger.log(`Generated search parameters: ${JSON.stringify(primaryParams, null, 2)}`);
      this.logger.log(`Generated search strategies: ${JSON.stringify(strategies, null, 2)}`);
      this.logger.log(`Generated search URLs: ${JSON.stringify(urls, null, 2)}`);

      return {
        searchParameters: primaryParams,
        searchStrategies: strategies,
        searchUrls: urls,
      };
    } catch (error) {
      this.logger.error('Error generating search parameters:', error);
      throw new HttpException(
        error.message || 'Failed to generate search parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  /**
   * Test endpoint for executing search
   */
  @Post('execute-search')
  async testExecuteSearch(
    @Body() body: {
      prompt: string;
      parsedJobDescription: ParsedJobDescription;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
      searchParameters: GeneratedSearchParameters[keyof GeneratedSearchParameters];
      queryUnderstanding?: QueryUnderstanding;
      maxPages?: number;
    },
    @Req() req: Request,
  ): Promise<SearchResultsResult> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Executing search (max ${body.maxPages || 7} pages)...`);

      const searchParamKey = `${body.searchType.replace(/_([a-z])/g, (_, l) =>
        l.toUpperCase(),
      )}${body.searchCategory.charAt(0).toUpperCase() + body.searchCategory.slice(1)}Search`;

      // Create a strategy result for execution
      const primaryStrategy: PeopleSearchStrategyResult = {
        id: 'primary',
        label: 'Primary Search',
        goal: 'Targeted search based on requirements',
        aggressiveness: 'focused' as const,
        description: 'Primary search strategy',
        whenToUse: 'Primary search',
        estimatedCandidateCount: { minimum: 40, maximum: 80 },
        filterFocus: 'Generated parameters',
        parameterRationales: {},
        parameters: body.searchParameters as any,
      } as PeopleSearchStrategyResult;

      const searchPreview =
        await this.searchExecutionService.executeMultiPageStrategySearch(
          body.parsedJobDescription,
          primaryStrategy,
          body.searchType,
          body.searchCategory,
          searchParamKey,
          apiToken,
          body.queryUnderstanding,
          body.prompt,
          undefined, // sendEvent
        );

      const allCandidates: (LinkedInSearchResult | TransformedCandidateForTable)[] = [];
      const resultsByPage: Array<{ page: number; candidates: (LinkedInSearchResult | TransformedCandidateForTable)[] }> = [];

      if (searchPreview && searchPreview.transformedCandidates) {
        const candidates = searchPreview.transformedCandidates;
        allCandidates.push(...candidates);

        const pageSize = 25;
        const maxPages = body.maxPages || 7;
        for (let page = 0; page < Math.min(maxPages, Math.ceil(candidates.length / pageSize)); page++) {
          const start = page * pageSize;
          const end = start + pageSize;
          const pageCandidates = candidates.slice(start, end);
          if (pageCandidates.length > 0) {
            resultsByPage.push({
              page: page + 1,
              candidates: pageCandidates,
            });
          }
        }
      }

      this.logger.log(`Found ${allCandidates.length} total candidates`);

      return {
        searchResultsPages: resultsByPage,
        allResults: allCandidates,
      };
    } catch (error) {
      this.logger.error('Error executing search:', error);
      throw new HttpException(
        error.message || 'Failed to execute search',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Internal method for executing search (for backward compatibility)
   */
  async executeSearch(
    prompt: string,
    apiToken: string,
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    searchParameters: GeneratedSearchParameters,
    queryUnderstanding?: QueryUnderstanding,
    maxPages = 7,
  ): Promise<SearchResultsResult> {
    this.logger.log(`Executing search (max ${maxPages} pages)...`);

    const searchParamKey = `${searchType.replace(/_([a-z])/g, (_, l) =>
      l.toUpperCase(),
    )}${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}Search`;

    // Create a strategy result for execution
    const primaryStrategy: PeopleSearchStrategyResult = {
      id: 'primary',
      label: 'Primary Search',
      goal: 'Targeted search based on requirements',
      aggressiveness: 'focused' as const,
      description: 'Primary search strategy',
      whenToUse: 'Primary search',
      estimatedCandidateCount: { minimum: 40, maximum: 80 },
      filterFocus: 'Generated parameters',
      parameterRationales: {},
      parameters: searchParameters as any,
    } as PeopleSearchStrategyResult;

    const searchPreview =
      await this.searchExecutionService.executeMultiPageStrategySearch(
        parsedJD,
        primaryStrategy,
        searchType,
        searchCategory,
        searchParamKey,
        apiToken,
        queryUnderstanding,
        prompt,
        undefined, // sendEvent
      );

    const allCandidates: (LinkedInSearchResult | TransformedCandidateForTable)[] = [];
    const resultsByPage: Array<{ page: number; candidates: (LinkedInSearchResult | TransformedCandidateForTable)[] }> = [];

    if (searchPreview && searchPreview.transformedCandidates) {
      const candidates = searchPreview.transformedCandidates;
      allCandidates.push(...candidates);

      const pageSize = 25;
      for (let page = 0; page < Math.min(maxPages, Math.ceil(candidates.length / pageSize)); page++) {
        const start = page * pageSize;
        const end = start + pageSize;
        const pageCandidates = candidates.slice(start, end);
        if (pageCandidates.length > 0) {
          resultsByPage.push({
            page: page + 1,
            candidates: pageCandidates,
          });
        }
      }
    }

    this.logger.log(`Found ${allCandidates.length} total candidates`);

    return {
      searchResultsPages: resultsByPage,
      allResults: allCandidates,
    };
  }

  /**
   * Test endpoint for executing a single page search
   */
  @Post('execute-search-page')
  async testExecuteSearchPage(
    @Body() body: {
      prompt: string;
      parsedJobDescription: ParsedJobDescription;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
      searchParameters: GeneratedSearchParameters[keyof GeneratedSearchParameters];
      queryUnderstanding?: QueryUnderstanding;
      page: number;
      cursor?: string;
    },
    @Req() req: Request,
  ): Promise<{
    page: number;
    candidates: (LinkedInSearchResult | TransformedCandidateForTable)[];
    nextCursor?: string;
    hasMore: boolean;
  }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Executing search page ${body.page}...`);

      const searchParamKey = `${body.searchType.replace(/_([a-z])/g, (_, l) =>
        l.toUpperCase(),
      )}${body.searchCategory.charAt(0).toUpperCase() + body.searchCategory.slice(1)}Search`;

      // Create a strategy result for execution
      const primaryStrategy: PeopleSearchStrategyResult = {
        id: 'primary',
        label: 'Primary Search',
        goal: 'Targeted search based on requirements',
        aggressiveness: 'focused' as const,
        description: 'Primary search strategy',
        whenToUse: 'Primary search',
        estimatedCandidateCount: { minimum: 40, maximum: 80 },
        filterFocus: 'Generated parameters',
        parameterRationales: {},
        parameters: body.searchParameters as any,
      } as PeopleSearchStrategyResult;

      const strategyResolvedParams: GeneratedSearchParameters = {
        [searchParamKey]: body.searchParameters,
      } as GeneratedSearchParameters;

      // Execute single page search
      const response = await this.searchExecutionService.searchCandidatesWithParameters(
        body.parsedJobDescription,
        strategyResolvedParams,
        body.searchType,
        body.searchCategory,
        apiToken,
        {
          cursor: body.cursor,
          limit: 25, // LinkedIn default page size
        },
        body.queryUnderstanding,
        body.prompt,
        undefined, // sendEvent
      );

      const pageItems = response.searchResults?.items || [];
      const pageTransformed = response.transformedCandidates || [];
      const nextCursor = response.searchResults?.cursor || undefined;
      const hasMore = !!nextCursor && pageItems.length > 0;

      this.logger.log(`Page ${body.page}: Found ${pageItems.length} candidates`);

      // Combine candidates ensuring proper union type
      const candidates: (LinkedInSearchResult | TransformedCandidateForTable)[] = 
        pageTransformed.length > 0 
          ? pageTransformed 
          : (pageItems as (LinkedInSearchResult | TransformedCandidateForTable)[]);

      return {
        page: body.page,
        candidates,
        nextCursor,
        hasMore,
      };
    } catch (error) {
      this.logger.error('Error executing search page:', error);
      throw new HttpException(
        error.message || 'Failed to execute search page',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint for validating page results
   */
  @Post('validate-page-results')
  async testValidatePageResults(
    @Body() body: {
      prompt: string;
      queryUnderstanding: QueryUnderstanding;
      candidates: (LinkedInSearchResult | TransformedCandidateForTable)[];
      page: number;
    },
    @Req() req: Request,
  ): Promise<ResultValidationResponse & { page: number }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Validating page ${body.page} results (${body.candidates.length} candidates)...`);

      const validationResult = await this.resultValidationService.validateResultsAgainstQuery(
        body.candidates,
        body.queryUnderstanding,
        body.prompt,
        apiToken,
        undefined, // sendEvent
      );

      this.logger.log(
        `Page ${body.page} validation complete: ${validationResult.qualityAssessment} quality, ${(validationResult.relevanceScore * 100).toFixed(0)}% relevance`,
      );

      return { validation: validationResult, page: body.page };
    } catch (error) {
      this.logger.error('Error validating page results:', error);
      throw new HttpException(
        error.message || 'Failed to validate page results',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint for scoring candidates
   */
  @Post('score-candidates')
  async testScoreCandidates(
    @Body() body: {
      prompt: string;
      queryUnderstanding: QueryUnderstanding;
      candidates: (LinkedInSearchResult | TransformedCandidateForTable)[];
      parsedJobDescription?: ParsedJobDescription;
    },
    @Req() req: Request,
  ): Promise<{
    scores: Array<{
      candidateId: string;
      candidateName: string;
        score: CandidateRelevanceScoring  ;
    }>;
  }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      const scores = await this.candidateScoringService.scoreCandidatesBatch(
        body.candidates,
        body.queryUnderstanding,
        body.prompt,
        apiToken,
        body.parsedJobDescription,
        undefined, // sendEvent
      );

      // Convert map to array format
      const scoresArray = body.candidates.map((candidate, index) => {
        // Handle both LinkedInSearchResult and TransformedCandidateForTable types
        const isLinkedInResult = 'type' in candidate;
        const candidateUrn = isLinkedInResult 
          ? (candidate as LinkedInSearchResult).member_urn 
          : undefined;
        const candidateFirstName = isLinkedInResult 
          ? (candidate as LinkedInSearchResult).first_name 
          : undefined;
        
        const candidateId = candidate.id || candidateUrn || `${candidate.name || 'unknown'}-${index}`;
        const candidateName = candidate.name || candidateFirstName || 'Unknown';
        const score = scores.get(candidateId) || 
                     (candidateUrn ? scores.get(candidateUrn) : undefined) ||
                     scores.get(candidateName) ||
                     {
                       relevanceScore: 0.5,
                       relevanceLabel: 'somewhat_relevant' as const,
                       matchReasons: [],
                       roleMatch: false,
                       companyMatch: false,
                       locationMatch: false,
                       educationMatch: null,
                       reasoning: 'Scoring not available',
                     };
        
        return {
          candidateId,
          candidateName,
          score,
        };
      });

      this.logger.log(`Scored ${scoresArray.length} candidates`);
      this.logger.log(`Scored candidates: ${JSON.stringify(scoresArray, null, 2)}`);  
      return { scores: scoresArray as unknown as Array<{
        candidateId: string;
        candidateName: string;
        score: CandidateRelevanceScoring;
      }> };
    } catch (error) {
      this.logger.error('Error scoring candidates:', error);
      throw new HttpException(
        error.message || 'Failed to score candidates',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint for validating search results
   */
  @Post('validate-results')
  async testValidateResults(
    @Body() body: {
      prompt: string;
      queryUnderstanding: QueryUnderstanding;
      candidates: (LinkedInSearchResult | TransformedCandidateForTable)[];
    },
    @Req() req: Request,
  ): Promise<ResultValidationResponse> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Validating ${body.candidates.length} search results...`);

      const validationResult = await this.resultValidationService.validateResultsAgainstQuery(
        body.candidates,
        body.queryUnderstanding,
        body.prompt,
        apiToken,
        undefined, // sendEvent
      );

      this.logger.log(
        `Validation complete: ${validationResult.qualityAssessment} quality, ${(validationResult.relevanceScore * 100).toFixed(0)}% relevance`,
      );

      return { validation: validationResult };
    } catch (error) {
      this.logger.error('Error validating results:', error);
      throw new HttpException(
        error.message || 'Failed to validate results',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Internal method for validating results (for backward compatibility)
   */
  async validateResults(
    prompt: string,
    apiToken: string,
    queryUnderstanding: QueryUnderstanding,
    candidates: (LinkedInSearchResult | TransformedCandidateForTable)[],
  ): Promise<ResultValidationResponse> {
    this.logger.log(`Validating ${candidates.length} search results...`);

    const validationResult = await this.resultValidationService.validateResultsAgainstQuery(
      candidates,
      queryUnderstanding,
      prompt,
      apiToken,
      undefined, // sendEvent
    );

    this.logger.log(
      `Validation complete: ${validationResult.qualityAssessment} quality, ${(validationResult.relevanceScore * 100).toFixed(0)}% relevance`,
    );

    return { validation: validationResult };
  }
}

