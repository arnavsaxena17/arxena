/**
 * Test Controller for Candidate Search
 * 
 * This controller provides HTTP endpoints for testing candidate search functions.
 * It's designed for testing and scripting.
 */

import { Body, Controller, HttpException, HttpStatus, Logger, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { CandidateSearchHandlerService } from 'src/engine/core-modules/candidate-search/services/candidate-search-handler.service';
import { TransformedCandidateForTable } from '../../candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { LinkedInSearchResult as LinkedInSearchResultFromLinkedIn } from '../../linkedin-search/types/linkedin-search-response.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { CandidateRelevanceScoring } from '../schemas/candidate-relevance-scoring.schema';
import { CandidateScoringService } from '../services/candidate-scoring.service';
import { QueryUnderstandingService } from '../services/query-understanding.service';
import { ResultValidationService } from '../services/result-validation.service';
import { SearchExecutionService } from '../services/search-execution.service';
import { SearchParameterGenerationService } from '../services/search-parameter-generation.service';
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
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly queryUnderstandingService: QueryUnderstandingService,
    private readonly candidateScoringService: CandidateScoringService,
    private readonly resultValidationService: ResultValidationService,

    private readonly candidateSearchHandlerService: CandidateSearchHandlerService,
    private readonly searchExecutionService: SearchExecutionService,
    private readonly searchParameterGenerationService: SearchParameterGenerationService,
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
        apiToken, // Pass apiToken to enable discovery and ensure ambiguity detection runs
      );

      // Log discovery results
      if (queryUnderstanding.patternIdentification) {
        this.logger.log(`Discovery: Pattern identification completed`);
        const patterns = queryUnderstanding.patternIdentification.identifiedPatterns;
        if (patterns.specializedRole?.detected) {
          this.logger.log(`  - Specialized role pattern detected (confidence: ${patterns.specializedRole.confidence})`);
        }
        if (patterns.companyDescription?.detected) {
          this.logger.log(`  - Company description pattern detected (confidence: ${patterns.companyDescription.confidence})`);
        }
        if (patterns.instituteRequirement?.detected) {
          this.logger.log(`  - Institute requirement pattern detected (confidence: ${patterns.instituteRequirement.confidence})`);
        }
      }
      
      // Log discovered enhancements
      if (queryUnderstanding.roleVariations && queryUnderstanding.roleVariations.length > 0) {
        this.logger.log(`Discovery: Found ${queryUnderstanding.roleVariations.length} role variations`);
      }
      if (queryUnderstanding.companyPreferences?.current && queryUnderstanding.companyPreferences.current.length > 0) {
        this.logger.log(`Discovery: Found ${queryUnderstanding.companyPreferences.current.length} companies`);
      }

      // Log ambiguity detection results
      if (queryUnderstanding.ambiguityReasons && queryUnderstanding.ambiguityReasons.length > 0) {
        this.logger.log(`Ambiguity detected: ${queryUnderstanding.ambiguityReasons.length} reason(s)`);
        queryUnderstanding.ambiguityReasons.forEach((reason, i) => {
          this.logger.log(`  Ambiguity ${i + 1}: ${reason}`);
        });
      } else if (!queryUnderstanding.needsClarification) {
        this.logger.log(`No ambiguity detected - query is clear`);
      }

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
      model?: string;
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
        await this.candidateSearchHandlerService.generateUnresolvedSearchParams(
          body.parsedJobDescription,
          body.searchType,
          body.searchCategory,
          apiToken,
          body.prompt,
          undefined, // jobId
          undefined, // sendEvent
          false, // includeJd
          body.queryUnderstanding,
          body.model || 'gpt-5.1-chat-latest', // model parameter
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
      model?: string;
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
        await this.candidateSearchHandlerService.generateUnresolvedSearchParams(
          body.parsedJobDescription,
          body.searchType,
          body.searchCategory,
          apiToken,
          body.prompt,
          undefined, // jobId
          undefined, // sendEvent
          false, // includeJd
          body.queryUnderstanding,
          body.model || 'gpt-5.1-chat-latest', // model parameter
        );

      const searchParamKey = `${body.searchType.replace(/_([a-z])/g, (_, l) =>
        l.toUpperCase(),
      )}${body.searchCategory.charAt(0).toUpperCase() + body.searchCategory.slice(1)}Search`;

      const primaryParams = unresolvedSearchParams[searchParamKey] || unresolvedSearchParams;
      const strategiesKey = `${searchParamKey}Strategies`;
      const strategies = body.searchCategory === 'people' ? unresolvedSearchParams[strategiesKey] || [] : undefined;

      // Generate URLs
      this.logger.log(`Generated search parameters: ${JSON.stringify(primaryParams, null, 2)}`);
      this.logger.log(`Generated search strategies: ${JSON.stringify(strategies, null, 2)}`);

      return {
        searchParameters: primaryParams,
        searchStrategies: strategies,
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
        description: 'Primary search strategy',
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
      description: 'Primary search strategy',
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

      const strategyResolvedParams: GeneratedSearchParameters = {
        [searchParamKey]: body.searchParameters,
      } as GeneratedSearchParameters;

      // Execute single page search directly
      const accountId = await this.searchExecutionService.getLinkedInAccountId(apiToken);
      const resolvedParams = await this.searchExecutionService.resolveSearchParameters(
        strategyResolvedParams,
        body.searchType,
        body.searchCategory,
        accountId,
      );

      const searchResults = await this.searchExecutionService.executeLinkedInSearch(
        resolvedParams,
        body.searchType,
        body.searchCategory,
        accountId,
        {
          cursor: body.cursor,
          limit: 25, // LinkedIn default page size
        },
      );

      const pageItems = searchResults?.items || [];
      const pageTransformed = this.searchExecutionService.transformSearchResults(
        pageItems,
        body.searchType,
        body.searchCategory,
      );
      const nextCursor = searchResults?.cursor || undefined;
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
      candidates: LinkedInSearchResult[];
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
        body.candidates as LinkedInSearchResultFromLinkedIn[],
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

      // Filter out TransformedCandidateForTable (which has __isFetched or tempId) and keep only LinkedInSearchResult
      // Then cast to the expected LinkedInSearchResultFromLinkedIn type
      const linkedInResults = body.candidates.filter(
        (candidate): candidate is LinkedInSearchResult => 
          'type' in candidate && !('__isFetched' in candidate) && !('tempId' in candidate)
      ) as LinkedInSearchResultFromLinkedIn[];

      const validationResult = await this.resultValidationService.validateResultsAgainstQuery(
        linkedInResults,
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
   * Test endpoint for generating sample answers to clarification questions using LLM
   */
  @Post('generate-clarification-answers')
  async testGenerateClarificationAnswers(
    @Body() body: {
      originalQuery: string;
      clarificationQuestions: string[];
    },
    @Req() req: Request,
  ): Promise<{ answers: string }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Generating clarification answers for ${body.clarificationQuestions.length} questions...`);

      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } =
        await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const questionsText = body.clarificationQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');

      const systemPrompt = `You are an expert recruiter helping to clarify candidate search requirements. Your task is to generate realistic, specific answers to clarification questions.

When generating answers:
- Generate concise, realistic answers to each question
- Format your response as a single paragraph that naturally answers all the questions
- Be specific and realistic (e.g., if asked about location, provide actual city names; if asked about industry, provide specific industries)
- Your response should be a natural continuation of the original query that answers all the clarification questions
- Keep it concise but informative`;

      const userPrompt = `ORIGINAL QUERY:
"${body.originalQuery}"

CLARIFICATION QUESTIONS:
${questionsText}

Generate answers to the clarification questions above.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const answers = completion.choices[0]?.message?.content || '';
      
      if (!answers) {
        // Fallback to simple answers
        const fallbackAnswers: string[] = [];
        body.clarificationQuestions.forEach((question) => {
          const lowerQuestion = question.toLowerCase();
          if (lowerQuestion.includes('location')) {
            fallbackAnswers.push(`Location: Bangalore, India`);
          } else if (lowerQuestion.includes('industry')) {
            fallbackAnswers.push(`Industry: Technology/SaaS`);
          } else if (lowerQuestion.includes('seniority') || lowerQuestion.includes('level')) {
            fallbackAnswers.push(`Seniority: Senior level`);
          } else if (lowerQuestion.includes('company')) {
            fallbackAnswers.push(`Company: Looking for candidates from top tech companies`);
          } else {
            fallbackAnswers.push(`Based on the original query requirements`);
          }
        });
        return { answers: fallbackAnswers.join(' ') };
      }

      this.logger.log(`Generated clarification answers (${answers.length} chars)`);
      return { answers };
    } catch (error) {
      this.logger.error('Error generating clarification answers:', error);
      
      // Fallback to simple answers on error
      const fallbackAnswers: string[] = [];
      body.clarificationQuestions.forEach((question) => {
        const lowerQuestion = question.toLowerCase();
        if (lowerQuestion.includes('location')) {
          fallbackAnswers.push(`Location: Bangalore, India`);
        } else if (lowerQuestion.includes('industry')) {
          fallbackAnswers.push(`Industry: Technology/SaaS`);
        } else if (lowerQuestion.includes('seniority') || lowerQuestion.includes('level')) {
          fallbackAnswers.push(`Seniority: Senior level`);
        } else if (lowerQuestion.includes('company')) {
          fallbackAnswers.push(`Company: Looking for candidates from top tech companies`);
        } else {
          fallbackAnswers.push(`Based on the original query requirements`);
        }
      });
      
      return { answers: fallbackAnswers.join(' ') };
    }
  }

  /**
   * Test endpoint for comparing model outputs
   */
  @Post('compare-models')
  async testCompareModels(
    @Body() body: {
      requirement: string;
      queryUnderstanding?: QueryUnderstanding;
      strategiesByModel: Record<string, { strategies: any; timing: number; error: string | null }>;
      parametersByModel: Record<string, { parameters: any; strategies: any; timing: number; error: string | null }>;
    },
    @Req() req: Request,
  ): Promise<{
    analysis: string;
    bestModel: string;
    reasoning: string;
    detailedComparison: any;
  }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log('Comparing models...');

      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } =
        await this.workspaceQueryService.initializeLLMClients(workspaceId);

      // Format the comparison data
      const systemPrompt = `You are an expert AI model evaluator specializing in candidate search systems. Your task is to compare the outputs from different AI models and determine which model generates the best search strategies and parameters.

EVALUATION CRITERIA:
1. Strategy Quality:
   - Relevance to the original query
   - Completeness and comprehensiveness
   - Practicality and effectiveness
   - Number of strategies (more is not always better, but variety can be valuable)

2. Parameter Quality:
   - Accuracy of extracted parameters
   - Completeness (all relevant fields populated)
   - Precision (no irrelevant fields)
   - Alignment with query understanding

3. Overall Assessment:
   - Which model best understands the search requirements?
   - Which model generates the most actionable and effective search strategies?
   - Which model produces the most accurate and complete parameters?
   - Consider both quality and consistency

INSTRUCTIONS:
1. Analyze each model's strategies and parameters in detail. Evaluate instruction following (e.g., for classic search, keywords must have maximum 6 terms)
2. Compare them against the original query and query understanding
3. Identify strengths and weaknesses of each model
4. Determine which model performs best overall
5. Provide clear reasoning for your assessment
6. Return your analysis in the following JSON format:
{
  "bestModel": "model-name",
  "analysis": "Overall analysis of all models (2-3 paragraphs)",
  "reasoning": "Detailed reasoning for why the best model was chosen (2-3 paragraphs)",
  "detailedComparison": {
    "model-name": {
      "strategyScore": 0-10,
      "parameterScore": 0-10,
      "overallScore": 0-10,
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "summary": "Brief summary"
    }
  }
}

Be thorough, objective, and provide actionable insights. Return ONLY valid JSON, no additional text.`;

      const userPrompt = `ORIGINAL SEARCH QUERY:
"${body.requirement}"

QUERY UNDERSTANDING:
${JSON.stringify(body.queryUnderstanding ? {
  primaryRole: body.queryUnderstanding.primaryRole,
  roleVariations: body.queryUnderstanding.roleVariations,
  industry: body.queryUnderstanding.industry,
  locationHierarchy: body.queryUnderstanding.locationHierarchy,
  seniorityLevel: body.queryUnderstanding.seniorityLevel,
  skills: body.queryUnderstanding.skills,
} : null, null, 2)}

MODEL OUTPUTS:
${JSON.stringify({
  strategies: body.strategiesByModel,
  parameters: body.parametersByModel,
}, null, 2)}

Compare the model outputs above and determine which model performs best.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '';
      
      try {
        const parsed = JSON.parse(responseText);
        this.logger.log(`Model comparison completed. Best model: ${parsed.bestModel}`);
        this.logger.log(`Model comparison: ${JSON.stringify(parsed, null, 2)}`);
        return parsed;
      } catch (parseError) {
        // Try to extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          this.logger.log(`Model comparison completed (extracted JSON). Best model: ${parsed.bestModel}`);
          return parsed;
        }
        
        // Fallback
        this.logger.warn('Could not parse JSON from model comparison, using fallback');
        return {
          analysis: responseText.substring(0, 500) || 'Comparison analysis unavailable',
          bestModel: 'unknown',
          reasoning: responseText.substring(500) || 'Unable to determine best model',
          detailedComparison: {},
        };
      }
    } catch (error) {
      this.logger.error('Error comparing models:', error);
      throw new HttpException(
        error.message || 'Failed to compare models',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint for counting keyword terms
   */
  @Post('count-keyword-terms')
  async testCountKeywordTerms(
    @Body() body: {
      keywords: string;
    },
  ): Promise<{
    keywords: string;
    count: number;
  }> {
    try {
      const count = this.searchParameterGenerationService.countKeywordTerms(body.keywords);
      
      this.logger.log(`Counted ${count} terms in keywords: "${body.keywords}"`);
      
      return {
        keywords: body.keywords,
        count,
      };
    } catch (error) {
      this.logger.error('Error counting keyword terms:', error);
      throw new HttpException(
        error.message || 'Failed to count keyword terms',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

