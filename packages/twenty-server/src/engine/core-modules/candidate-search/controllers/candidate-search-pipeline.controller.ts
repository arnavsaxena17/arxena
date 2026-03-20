/**
 * Pipeline Controller for Candidate Search
 *
 * Exposes step-by-step HTTP endpoints for the candidate search pipeline (cleanup,
 * requirement analysis, parameter generation, search execution, validation, scoring).
 * Consumed by the frontend Search Models UI, MCP tools, and testing/scripting flows.
 */

import { Body, Controller, HttpException, HttpStatus, Logger, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { McpAssistantService } from 'src/engine/core-modules/assistant/mcp-assistant.service';
import { ParsedRequirement } from 'src/engine/core-modules/candidate-search/schemas/parsed-requirement.schema';
import { CandidateSearchHandlerService } from 'src/engine/core-modules/candidate-search/services/candidate-search-handler.service';
import { RequirementAnalyzerService } from 'src/engine/core-modules/candidate-search/services/requirement-analyzer.service';
import { TransformedCandidateForTable } from '../../candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { LinkedInSearchResult as LinkedInSearchResultFromLinkedIn } from '../../linkedin-search/types/linkedin-search-response.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { CandidateRelevanceScoring } from '../schemas/candidate-relevance-scoring.schema';
import type { CompanyExpanderResult } from '../schemas/company-expander.schema';
import type { JobTitleExpanderResult } from '../schemas/job-title-expander.schema';
import type { QueryConstructorResult } from '../schemas/query-constructor.schema';
import { BooltreeHintService } from '../services/booltree-hint.service';
import { CandidateScoringService } from '../services/candidate-scoring.service';
import { CleanupService } from '../services/cleanup.service';
import { CompanyExpanderService } from '../services/company-expander.service';
import { JobTitleExpanderService } from '../services/job-title-expander.service';
import { QueryConstructorService } from '../services/query-constructor.service';
import { ResultValidationService } from '../services/result-validation.service';
import { SearchExecutionService } from '../services/search-execution.service';
import { SearchParameterGenerationService } from '../services/search-parameter-generation.service';
import {
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  ParsedJobDescription,
  RecruiterPeopleSearchStrategyResult,
  SalesNavigatorPeopleSearchStrategyResult,
  ResultValidationResult as ValidationResult
} from '../types/candidate-search-request.type';
import { LinkedInSearchResult } from '../types/linkedin-search-result.type';
import { LinkedinParameterResolver } from '../utils/linkedin-parameter-resolver.util';
import { mapQueryConstructorToUnresolved } from '../utils/query-constructor-mapper.util';

type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

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

@Controller('candidate-search/pipeline')
export class CandidateSearchPipelineController {
  private readonly logger = new Logger(CandidateSearchPipelineController.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly candidateScoringService: CandidateScoringService,
    private readonly resultValidationService: ResultValidationService,

    private readonly candidateSearchHandlerService: CandidateSearchHandlerService,
    private readonly searchExecutionService: SearchExecutionService,
    private readonly requirementAnalyzerService: RequirementAnalyzerService,
    private readonly jobTitleExpanderService: JobTitleExpanderService,
    private readonly companyExpanderService: CompanyExpanderService,
    private readonly booltreeHintService: BooltreeHintService,
    private readonly queryConstructorService: QueryConstructorService,
    private readonly searchParameterGenerationService: SearchParameterGenerationService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly cleanupService: CleanupService,
    private readonly mcpAssistantService: McpAssistantService,
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
   * Test endpoint for cleaning up a raw client query
   * Uses the same cleanup flow as the chat controller so that
   * the test pipeline can work with realistic profile-style queries.
   */
  @Post('cleanup-query')
  async testCleanupQuery(
    @Body() body: { rawQuery: string },
    @Req() req: Request,
  ): Promise<{ cleanedQuery: string }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      // this.logger.log(`Cleaning up raw query for test flow: "${body.rawQuery}"`);

      const cleanedQuery = await this.cleanupService.cleanupQuery(
        body.rawQuery,
        apiToken,
      );

      return { cleanedQuery };
    } catch (error) {
      this.logger.error('Error cleaning up query for test flow:', error);
      throw new HttpException(
        error.message || 'Failed to clean up query',
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
      rawQuery?: string;
      cleanedQuery?: string;
      parsedJobDescription: ParsedJobDescription;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
      model?: string;
    },
    @Req() req: Request,
  ): Promise<SearchStrategiesResult> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      if (body.prompt == null || typeof body.prompt !== 'string') {
        throw new HttpException('prompt is required and must be a string', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Generating search strategies for: "${body.prompt.substring(0, 50)}..."`);

      if (body.searchCategory !== 'people') {
        throw new HttpException('Search strategies are only available for people searches', HttpStatus.BAD_REQUEST);
      }

      const rawQuery = body.rawQuery ?? body.prompt;
      const cleanedQuery = body.cleanedQuery ?? body.prompt;
      const generatedParams =
        await this.candidateSearchHandlerService.generateUnresolvedSearchParams(
          rawQuery,
          cleanedQuery,
          body.searchType,
          body.searchCategory,
          apiToken,
          body.prompt,
          body.parsedJobDescription as ParsedJobDescription,
          undefined, // jobId
          undefined, // sendEvent
          false, // includeJd
          undefined, // onTokenUsage
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
  /** Header sent by MCP tools when calling this API (so we can log assistant/MCP-originated calls). */
  private static readonly MCP_REQUEST_SOURCE_HEADER = 'x-request-source';
  private static readonly MCP_REQUEST_SOURCE_VALUE = 'mcp';

  @Post('generate-unresolved-search-parameters')
  async testGenerateUnresolvedSearchParameters(
    @Body() body: {
      prompt: string;
      rawQuery?: string;
      cleanedQuery?: string;
      parsedJobDescription?: ParsedJobDescription;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
      model?: string;
      assistantThreadId?: string;
    },
    @Req() req: Request,
  ): Promise<SearchParametersResult> {
    try {
      const fromMcp =
        (req.headers[CandidateSearchPipelineController.MCP_REQUEST_SOURCE_HEADER] as string) ===
        CandidateSearchPipelineController.MCP_REQUEST_SOURCE_VALUE;
      if (fromMcp) {
        this.logger.log(
          `generate_unresolved search_parameters invoked via REST (caller: MCP assistant), prompt: "${body?.prompt?.substring(0, 60) ?? ''}..."`,
        );
      }
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }
      this.logger.log(`Generating search parameters for prompt: "${body.prompt}..."`);
      this.logger.log(`Generating search parameters for raw Query: "${body.rawQuery}..."`);
      if (body.prompt == null || typeof body.prompt !== 'string') {
        throw new HttpException('prompt is required and must be a string', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Generating search parameters for prompt substring: "${body.prompt.substring(0, 50)}..."`);

      const rawQuery = body.rawQuery ?? body.prompt;
      const cleanedQuery = body.cleanedQuery ?? body.prompt;
      this.logger.log(`Generating search parameters for raw Query: "${rawQuery}..."`);
      this.logger.log(`Generating search parameters for cleaned Query: "${cleanedQuery}..."`);
      const unresolvedSearchParams: GeneratedSearchParameters =
        await this.candidateSearchHandlerService.generateUnresolvedSearchParams(
          rawQuery,
          cleanedQuery,
          body.searchType,
          body.searchCategory,
          apiToken,
          body.prompt,
          body.parsedJobDescription,
          undefined, // jobId
          undefined, // sendEvent
          false, // includeJd
          undefined, // onTokenUsage
        );

      const searchParamKey = `${body?.searchType?.replace(/_([a-z])/g, (_, l) =>
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
      this.logger.error('Error generating search parameters in testGenerateSearchParameters:', error);
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

      const searchParamKey = `${body?.searchType?.replace(/_([a-z])/g, (_, l) =>
        l.toUpperCase(),
      )}${body.searchCategory.charAt(0).toUpperCase() + body.searchCategory.slice(1)}Search`;

      // Create a strategy result for execution
      const primaryStrategy: PeopleSearchStrategyResult = {
        id: 'primary',
        label: 'Primary Search',
        description: 'Primary search strategy',
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

  // /**
  //  * Internal method for executing search (for backward compatibility)
  //  */
  // async executeSearch(
  //   prompt: string,
  //   apiToken: string,
  //   parsedJD: ParsedJobDescription,
  //   searchType: 'classic' | 'sales_navigator' | 'recruiter',
  //   searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  //   searchParameters: GeneratedSearchParameters,
  //   maxPages = 7,
  // ): Promise<SearchResultsResult> {
  //   this.logger.log(`Executing search (max ${maxPages} pages)...`);

  //   const searchParamKey = `${searchType.replace(/_([a-z])/g, (_, l) =>
  //     l.toUpperCase(),
  //   )}${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}Search`;

  //   // Create a strategy result for execution
  //   const primaryStrategy: PeopleSearchStrategyResult = {
  //     id: 'primary',
  //     label: 'Primary Search',
  //     description: 'Primary search strategy',
  //     parameters: searchParameters as any,
  //   } as PeopleSearchStrategyResult;

  //   const searchPreview =
  //     await this.searchExecutionService.executeMultiPageStrategySearch(
  //       parsedJD,
  //       primaryStrategy,
  //       searchType,
  //       searchCategory,
  //       searchParamKey,
  //       apiToken,
  //       prompt,
  //       undefined, // sendEvent
  //     );

  //   const allCandidates: (LinkedInSearchResult | TransformedCandidateForTable)[] = [];
  //   const resultsByPage: Array<{ page: number; candidates: (LinkedInSearchResult | TransformedCandidateForTable)[] }> = [];

  //   if (searchPreview && searchPreview.transformedCandidates) {
  //     const candidates = searchPreview.transformedCandidates;
  //     allCandidates.push(...candidates);

  //     const pageSize = 25;
  //     for (let page = 0; page < Math.min(maxPages, Math.ceil(candidates.length / pageSize)); page++) {
  //       const start = page * pageSize;
  //       const end = start + pageSize;
  //       const pageCandidates = candidates.slice(start, end);
  //       if (pageCandidates.length > 0) {
  //         resultsByPage.push({
  //           page: page + 1,
  //           candidates: pageCandidates,
  //         });
  //       }
  //     }
  //   }

  //   this.logger.log(`Found ${allCandidates.length} total candidates`);

  //   return {
  //     searchResultsPages: resultsByPage,
  //     allResults: allCandidates,
  //   };
  // }

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
          limit: 10, // Default page size
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
        'people', // searchCategory - default for test endpoint
        'classic', // searchType - default for test endpoint
        body.prompt,
        apiToken,
        body.parsedJobDescription,
        undefined, // sendEvent
        undefined, // strategyText - optional, not provided in test endpoint
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



  @Post('job-brief-understanding')
  async jobBriefUnderstanding(
    @Body() body: { jobBrief: string; assistantThreadId?: string },
    @Req() req: any,
  ) {
    this.logger.log('jobBriefUnderstanding body::', JSON.stringify(body, null, 2));
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }
      const SYSTEM_PROMPT = `You are an expert at understanding job briefs and generating a detailed job brief understanding.. 

      You can call find_company_by_name to get information about the company. If inspite of that you don't understand then ask about the  
      You will try to understand the nature of the company in terms of how long they have been in business, whats their turnover, how many employees, employee culture, number of working days, work hours, etc.
      You will also probe on understanding the nature of the hiring manager. How do they work, how do they communicate, how do they make decisions, etc. 
      You will try to ascertain the culture of the firm - is it an MNC, an Indian company, a startup, a family run business, etc.
      Generate questions until you are satisfied with the understanding of the role and the client.
      If you are satisfied with the understanding, return 'COMPLETELY_UNDERSTOOD'.
      If you are not entirely satisfied, generate a few more questions to ask the user and return 'PARTIALLY_UNDERSTOOD'.
      Return in the form of a json object
      `

      const userPrompt = `Please understand the job brief and generate a detailed job brief understanding.
      Job Brief: ${body.jobBrief}`;

      const parsed = await this.mcpAssistantService.callJsonWithTools(
        apiToken,
        SYSTEM_PROMPT,
        userPrompt,
        {
          allowedToolNames: [
            'find_company_by_name',
            // Internal tools are explicitly allowed here so the assistant
            // can use candidate-search pipeline steps when needed.
            // 'generate_unresolved_search_parameters',
            // 'resolve_parameters',
          ],
        },
      );

      this.logger.log(
        `Job brief understanding completed. Parsed response: ${JSON.stringify(parsed, null, 2)}`,
      );
      return parsed;
    } catch (error) {
      this.logger.error('Job brief understanding failed', error);
      throw new HttpException(
        error.message || 'Job brief understanding failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint for comparing model outputs
   */
  @Post('compare-models')
  async testCompareModels(
    @Body() body: {
      requirement: string;
      strategiesByModel: Record<string, { strategies: any; timing: number; error: string | null }>;
      parametersByModel: Record<string, { parameters: any; strategies: any; timing: number; error: string | null }>;
      userMessage?: string;
      prompt?: string;
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
${JSON.stringify({ userMessage: body.userMessage ?? body.prompt ?? '' }, null, 2)}

MODEL OUTPUTS:
${JSON.stringify({
  strategies: body.strategiesByModel,
  parameters: body.parametersByModel,
}, null, 2)}

Compare the model outputs above and determine which model performs best.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-5.1-chat-latest',
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

  // /**
  //  * Test endpoint for generating boolean query from raw query
  //  */
  // @Post('generate-boolean-query')
  // async testGenerateBooleanQuery(
  //   @Body() body: {
  //     rawQuery: string;
  //   },
  //   @Req() req: Request,
  // ): Promise<{
  //   booleanQueryResponse: z.infer<typeof booleanQueryResponseSchema>;
  //   final_boolean_string: string;
  //   raw_input: string;
  // }> {
  //   try {
  //     const apiToken = req.headers.authorization?.replace('Bearer ', '');
  //     if (!apiToken) {
  //       throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
  //     }

  //     this.logger.log(`Generating boolean query for: ${body.rawQuery}`);

  //     const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
  //     const { openAIclient: openaiClient } =
  //       await this.workspaceQueryService.initializeLLMClients(workspaceId);

  //     const booleanQueryResponse = await this.searchParameterGenerationService.generateBooleanQueryFromUserMessage(
  //       body.rawQuery,
  //       'classic',
  //       openaiClient,
  //       undefined,
  //       undefined,
  //     );

  //     return {
  //       booleanQueryResponse: booleanQueryResponse,
  //       final_boolean_string: booleanQueryResponse.boolean_components.final_boolean_string,
  //       raw_input: booleanQueryResponse.requirement.raw_input,
  //     };
  //   } catch (error) {
  //     this.logger.error('Error generating boolean query:', error);
  //     throw new HttpException(
  //       error.message || 'Failed to generate boolean query',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  /**
   * Test endpoint for Agent 1: Requirement Analyzer
   */
  @Post('requirement-analyzer')
  async testRequirementAnalyzer(
    @Body() body: { rawRequirement: string; cleanedQuery?: string },
    @Req() req: Request,
  ): Promise<{ parsedRequirement: unknown }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } =
        await this.workspaceQueryService.initializeLLMClients(workspaceId);
      const rawQuery = body.rawRequirement;
      const cleanedQuery = body.cleanedQuery ?? body.rawRequirement;
      const parsedRequirement = await this.requirementAnalyzerService.analyzeRequirement(
        rawQuery,
        cleanedQuery,
        openaiClient,
      );
      return { parsedRequirement };
    } catch (error) {
      this.logger.error('Error in requirement analyzer:', error);
      throw new HttpException(
        error.message || 'Failed to analyze requirement',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint for Agent 2: Job Title Expander
   */
  @Post('job-title-expander')
  async testJobTitleExpander(
    @Body() body: { parsedRequirement: Record<string, unknown> },
    @Req() req: Request,
  ): Promise<{ titleAnalysis: unknown }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } =
        await this.workspaceQueryService.initializeLLMClients(workspaceId);
      const titleAnalysis = await this.jobTitleExpanderService.expandJobTitles(
        body.parsedRequirement as ParsedRequirement,
        openaiClient,
      );
      this.logger.log(`Title analysis:: ${JSON.stringify(titleAnalysis, null, 2)}`);
      return { titleAnalysis };
    } catch (error) {
      this.logger.error('Error in job title expander:', error);
      throw new HttpException(
        error.message || 'Failed to expand job titles',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint for Agent 3: Company Expander
   */
  @Post('company-expander')
  async testCompanyExpander(
    @Body() body: { parsedRequirement: Record<string, unknown> },
    @Req() req: Request,
  ): Promise<{ companyAnalysis: unknown }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } =
        await this.workspaceQueryService.initializeLLMClients(workspaceId);
      const companyAnalysis = await this.companyExpanderService.expandCompanies(
        body.parsedRequirement as ParsedRequirement,
        openaiClient,
      );
      this.logger.log(`Company analysis:: ${JSON.stringify(companyAnalysis, null, 2)}`);
      return { companyAnalysis };
    } catch (error) {
      this.logger.error('Error in company expander:', error);
      throw new HttpException(
        error.message || 'Failed to expand companies',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint for Agent 4: Query Constructor
   */
  @Post('query-constructor')
  async testQueryConstructor(
    @Body() body: {
      parsedRequirement: Record<string, unknown>;
      titleAnalysis: Record<string, unknown>;
      companyAnalysis: Record<string, unknown>;
      rawRequirement?: string;
      cleanedQuery?: string;
      searchType?: 'classic' | 'sales_navigator' | 'recruiter';
    },
    @Req() req: Request,
  ): Promise<{
    linkedin_searches: unknown[];
    requirement?: string | null;
  }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

      const { openAIclient: openaiClient } =
        await this.workspaceQueryService.initializeLLMClients(workspaceId);
      
      const parsedReq = body?.parsedRequirement as unknown as ParsedRequirement;
      // const rawOrCleanedQuery =
      //   (body.rawRequirement as string) ??
      //   (body.cleanedQuery as string) ??
      //   [parsedReq?.primary_role_name, parsedReq?.industries?.join(' ')]
      //     .filter((item): item is string => !!item && typeof item === 'string')
      //     .join(' ');
      // let booltreeHints = this.booltreeHintService.getHintsForQuery(
      //   rawOrCleanedQuery,
      //   parsedReq,
      // );

      const booltreeHints = '';
      const rawQuery = (body.rawRequirement as string) ?? (body.cleanedQuery as string) ?? '';
      const cleanedQuery = (body.cleanedQuery as string) ?? (body.rawRequirement as string) ?? '';
      const searchType = body.searchType ?? 'classic';

      const result = await this.queryConstructorService.constructQueries(
        searchType,
        rawQuery,
        cleanedQuery,
        parsedReq,
        body.titleAnalysis as JobTitleExpanderResult,
        body.companyAnalysis as CompanyExpanderResult,
        booltreeHints,
        openaiClient,
      );
      return {
        linkedin_searches: result.linkedin_searches ?? [],
        requirement: result.requirement ?? undefined,
      };
    } catch (error) {
      this.logger.error('Error in query constructor:', error);
      throw new HttpException(
        error.message || 'Failed to construct queries',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint for Booltree hints cache.
   * Exposes BooltreeHintService so the test pipeline can cache and inspect hints
   * used when constructing LinkedIn searches and unresolved parameters.
   */
  @Post('booltree-hints')
  async testBooltreeHints(
    @Body()
    body: {
      cleanedQuery?: string;
      parsedRequirement: ParsedRequirement;
    },
  ): Promise<{ hints: string }> {
    try {
      const rawQuery = body.cleanedQuery ?? '';
      const cleanedQuery = body.cleanedQuery ?? '';
      const hints = this.booltreeHintService.getHintsForQuery(
        rawQuery,
        cleanedQuery,
        body.parsedRequirement,
      );
      this.logger.log(
        `Booltree hints generated for test flow (length=${hints.length} chars)`,
      );
      return { hints };
    } catch (error) {
      this.logger.error('Error generating booltree hints:', error);
      throw new HttpException(
        (error as Error).message || 'Failed to generate booltree hints',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint: build unresolved parameters from Query Constructor (Agent 4) output.
   */
  @Post('build-unresolved-from-query-constructor')
  async testBuildUnresolvedFromQueryConstructor(
    @Body() body: {
      queryConstructorResult: { linkedin_searches: unknown[]; [key: string]: unknown };
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
    },
    @Req() req: Request,
  ): Promise<{ unresolvedParameters: GeneratedSearchParameters }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }
      const unresolvedParameters = mapQueryConstructorToUnresolved(
        body.queryConstructorResult as QueryConstructorResult,
        body.searchType,
      );
      this.logger.log(`Unresolved parameters:: ${JSON.stringify(unresolvedParameters, null, 2)}`);
      return { unresolvedParameters };
    } catch (error) {
      this.logger.error('Error building unresolved from query constructor:', error);
      throw new HttpException(
        error.message || 'Failed to build unresolved parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  /**
   * Test endpoint for resolving parameters (checks cache first)
   */
  @Post('resolve-parameters')
  async testResolveParameters(
    @Body() body: {
      unresolvedParameters: any;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
    },
    @Req() req: Request,
  ): Promise<{
    resolvedParameters: any;
  }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Resolving ${body.searchType} ${body.searchCategory} parameters...`);

      const accountId = await this.searchExecutionService.getLinkedInAccountId(apiToken);
      
      // Use the linkedinParameterResolver which checks cache first
      const resolvedParameters = await this.linkedinParameterResolver.resolveParameterIds(
        body.unresolvedParameters,
        accountId,
        'test',
      );
      return {
        resolvedParameters,
      };
    } catch (error) {
      this.logger.error('Error resolving parameters:', error);
      throw new HttpException(
        error.message || 'Failed to resolve parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint for generating LinkedIn URLs from resolved parameters
   */
  @Post('generate-linkedin-url')
  async testGenerateLinkedInUrl(
    @Body() body: {
      resolvedParameters: any;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
    },
  ): Promise<{
    linkedInUrl: string | null;
  }> {
    try {
      this.logger.log(`Generating ${body.searchType} ${body.searchCategory} LinkedIn URL...`);

      const { generateLinkedInSearchUrl } = await import('../utils/search-parameter.utils');
      const linkedInUrl = generateLinkedInSearchUrl(
        body.resolvedParameters,
        body.searchType,
        body.searchCategory,
      );

      return {
        linkedInUrl,
      };
    } catch (error) {
      this.logger.error('Error generating LinkedIn URL:', error);
      throw new HttpException(
        error.message || 'Failed to generate LinkedIn URL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint for executing search with resolved parameters (without validation/scoring)
   * This only executes the search and returns raw results with pagination info
   */
  @Post('execute-parameter-search')
  async testExecuteParameterSearch(
    @Body() body: {
      resolvedParameters: any;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
      parsedJobDescription?: ParsedJobDescription;
      maxPages?: number;
    },
    @Req() req: Request,
  ): Promise<{
    searchResult: {
      itemCount: number;
      searchResults: any;
      transformedCandidates?: any;
      searchMetadata?: any;
      error?: {
        message: string;
        code?: string;
        details?: string;
      };
    } | null;
  }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(
        `Executing ${body.searchType} ${body.searchCategory} search with resolved parameters (without validation/scoring)...`,
      );

      // Create a strategy object from resolved parameters
      const strategy: PeopleSearchStrategyResult = {
        id: 'test-strategy',
        label: 'Test Search Strategy',
        description: 'Test search strategy from resolved parameters',
        strategyText: '',
        parameters: body.resolvedParameters,
      } as PeopleSearchStrategyResult;

      // Create a minimal parsedJobDescription if not provided
      const parsedJD: ParsedJobDescription = body.parsedJobDescription || {
        jobTitle: '',
        company: '',
        location: '',
        industry: '',
        requiredSkills: [],
        preferredSkills: [],
        experienceLevel: 'mid_level',
        education: [],
        keywords: [],
        responsibilities: [],
        qualifications: [],
        benefits: [],
        employmentType: 'full_time',
        remoteWork: false,
        salaryRange: null,
      };

      const searchParamKey = `${body.searchType.replace(/_([a-z])/g, (_, l) =>
        l.toUpperCase(),
      )}${body.searchCategory.charAt(0).toUpperCase() + body.searchCategory.slice(1)}Search`;

      const searchResult = await this.searchExecutionService.executeMultiPageSearchWithoutValidation(
        parsedJD,
        strategy,
        body.searchType,
        body.searchCategory,
        searchParamKey,
        apiToken,
        body.maxPages,
        undefined, // sendEvent
      );

      this.logger.log(
        `Search execution completed: ${searchResult?.itemCount || 0} candidates found`,
      );

      return {
        searchResult,
      };
    } catch (error) {
      this.logger.error('Error executing parameter search:', error);
      throw new HttpException(
        error.message || 'Failed to execute parameter search',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint for validating parameter search results
   * Takes search results and validates them per page, handling pagination
   */
  @Post('validate-parameter-results')
  async testValidateParameterResults(
    @Body() body: {
      searchResults: {
        searchResults: {
          items: any[];
          paging?: { total_count: number };
          cursor?: string | null;
        };
        transformedCandidates?: any[];
      };
      userMessage: string;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
      pageSize?: number;
    },
    @Req() req: Request,
  ): Promise<{
    validationResults: Array<{
      page: number;
      validation: ValidationResult;
      timestamp: string;
    }>;
    overallValidation?: ValidationResult;
  }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Validating parameter search results...`);

      const pageSize = body.pageSize || 25;
      const allItems = body.searchResults.searchResults?.items || [];
      const totalItems = allItems.length;
      const totalPages = Math.ceil(totalItems / pageSize);

      const validationResults: Array<{
        page: number;
        validation: ValidationResult;
        timestamp: string;
      }> = [];

      // Validate each page
      for (let page = 1; page <= totalPages; page++) {
        const startIndex = (page - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalItems);
        const pageItems = allItems.slice(startIndex, endIndex);

        if (pageItems.length === 0) {
          break;
        }

        this.logger.log(`Validating page ${page}/${totalPages} (${pageItems.length} candidates)...`);

        const validationResult = await this.resultValidationService.validateResultsAgainstQuery(
          pageItems as LinkedInSearchResultFromLinkedIn[],
          body.userMessage,
          apiToken,
          undefined, // sendEvent
        );

        validationResults.push({
          page,
          validation: validationResult,
          timestamp: new Date().toISOString(),
        });

        // Check if we should continue based on validation
        if (!this.resultValidationService.shouldContinuePagination(validationResult, totalItems, page)) {
          this.logger.log(`Stopping validation after page ${page} based on validation result`);
          break;
        }
      }
      // We intentionally skip a separate overall validation pass because
      // per-page validation is only used for pagination, and candidates
      // are scored individually elsewhere in the flow.
      const lastPageValidation = validationResults[validationResults.length - 1]?.validation;

      this.logger.log(
        `Validation completed: ${validationResults.length} page(s) validated${
          lastPageValidation
            ? `, last page relevance: ${(lastPageValidation.relevanceScore * 100).toFixed(0)}%`
            : ''
        }`,
      );

      return {
        validationResults,
        overallValidation: undefined,
      };
    } catch (error) {
      this.logger.error('Error validating parameter results:', error);
      throw new HttpException(
        error.message || 'Failed to validate parameter results',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint for scoring parameter search results
   * Takes search results and scores candidates per page, handling pagination
   */
  @Post('score-parameter-results')
  async testScoreParameterResults(
    @Body() body: {
      searchResults: {
        searchResults: {
          items: any[];
        };
        transformedCandidates?: any[];
      };
      userMessage: string;
      parsedJobDescription?: ParsedJobDescription;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
      pageSize?: number;
    },
    @Req() req: Request,
  ): Promise<{
    scores: Array<{
      candidateId: string;
      candidateName: string;
      score: CandidateRelevanceScoring;
    }>;
    scoresByPage: Array<{
      page: number;
      scores: Array<{
        candidateId: string;
        candidateName: string;
        score: CandidateRelevanceScoring;
      }>;
    }>;
  }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Scoring parameter search results...`);

      const pageSize = body.pageSize || 25;
      const allItems = body.searchResults.searchResults?.items || [];
      const totalItems = allItems.length;
      const totalPages = Math.ceil(totalItems / pageSize);

      const allScores: Array<{
        candidateId: string;
        candidateName: string;
        score: CandidateRelevanceScoring;
      }> = [];
      const scoresByPage: Array<{
        page: number;
        scores: Array<{
          candidateId: string;
          candidateName: string;
          score: CandidateRelevanceScoring;
        }>;
      }> = [];

      // Score each page
      for (let page = 1; page <= totalPages; page++) {
        const startIndex = (page - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalItems);
        const pageItems = allItems.slice(startIndex, endIndex);

        if (pageItems.length === 0) {
          break;
        }

        this.logger.log(`Scoring page ${page}/${totalPages} (${pageItems.length} candidates)...`);

        const pageScores = await this.candidateScoringService.scoreCandidatesBatch(
          pageItems,
          body.searchCategory,
          body.searchType,
          body.userMessage,
          apiToken,
          body.parsedJobDescription,
          undefined, // sendEvent
          undefined, // strategyText
        );

        // Convert map to array format for this page
        const pageScoresArray: Array<{
          candidateId: string;
          candidateName: string;
          score: CandidateRelevanceScoring;
        }> = [];

        pageItems.forEach((candidate, index) => {
          const isLinkedInResult = 'type' in candidate;
          const candidateUrn = isLinkedInResult 
            ? (candidate as LinkedInSearchResult).member_urn 
            : undefined;
          const candidateFirstName = isLinkedInResult 
            ? (candidate as LinkedInSearchResult).first_name 
            : undefined;
          
          const candidateId = candidate.id || candidateUrn || `${candidate.name || 'unknown'}-${index}`;
          const candidateName = candidate.name || candidateFirstName || 'Unknown';
          const foundScore = pageScores.get(candidateId) || 
                       (candidateUrn ? pageScores.get(candidateUrn) : undefined) ||
                       pageScores.get(candidateName);
          
          const score: CandidateRelevanceScoring = foundScore || {
            relevanceScore: 0.5,
            relevanceLabel: 'somewhat_relevant' as const,
            matchReasons: [],
            mismatchReasons: [],
            roleMatch: false,
            companyTypeMatch: false,
            industryMatch: false,
            locationMatch: false,
            educationMatch: null,
            certificationMatch: null,
            regulatoryExperienceMatch: null,
            companySizeRangeMatch: null,
            functionalMatch: null,
            ageMatch: null,
            likeToLikeMatch: null,
            hierarchicalMatchLevel: null,
            reasoning: 'Scoring not available',
          };
          
          pageScoresArray.push({
            candidateId,
            candidateName,
            score,
          });
        });

        scoresByPage.push({
          page,
          scores: pageScoresArray,
        });

        allScores.push(...pageScoresArray);
      }

      this.logger.log(`Scoring completed: ${allScores.length} candidates scored across ${scoresByPage.length} page(s)`);

      return {
        scores: allScores,
        scoresByPage,
      };
    } catch (error) {
      this.logger.error('Error scoring parameter results:', error);
      throw new HttpException(
        error.message || 'Failed to score parameter results',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

