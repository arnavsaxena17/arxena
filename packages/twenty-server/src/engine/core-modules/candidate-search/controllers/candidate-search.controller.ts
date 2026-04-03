import {
    Body,
    Controller,
    Get,
    Headers,
    HttpException,
    HttpStatus,
    Logger,
    Param,
    Post,
    Put,
    Query,
    Req,
} from '@nestjs/common';
import { WorkspaceCreditsService } from 'src/engine/core-modules/billing/services/workspace-credits.service';
import { CandidateSearchBaseService } from 'src/engine/core-modules/candidate-search/services/candidate-search-base.service';
import { CandidateDataService } from 'src/engine/core-modules/candidate-sourcing/services/candidate-data.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { LinkedInSessionTrackerService } from 'src/engine/core-modules/linkedin-search/services/linkedin-session-tracker.service';
import { OrgchartCancelRegistryService } from 'src/engine/core-modules/org-chart/services/orgchart-cancel-registry.service';
import { OrgChartS3Service } from 'src/engine/core-modules/org-chart/services/orgchart-s3.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import type { ParsedRequirement } from '../schemas/parsed-requirement.schema';
import { CandidateSearchHandlerService } from '../services/candidate-search-handler.service';
import { CompanyExpanderService } from '../services/company-expander.service';
import { JobTitleExpanderService } from '../services/job-title-expander.service';
import { SearchExecutionService } from '../services/search-execution.service';
import { SearchResultsCacheService } from '../services/search-results-cache.service';
import {
    CandidateSearchResponse,
    ParsedJobDescription,
} from '../types/candidate-search-request.type';
import { LinkedinParameterResolver } from '../utils/linkedin-parameter-resolver.util';

type OrgchartSearchMode =
  | 'current_node'
  | 'leadership'
  | 'entire_company'
  | 'function_grade'
  | 'all_people'
  | 'selected_nodes';

type OrgchartSearchType = 'classic' | 'sales_navigator' | 'recruiter';

type SearchExecutionPreview = {
  itemCount: number;
  searchResults: CandidateSearchResponse['searchResults'];
  transformedCandidates?: CandidateSearchResponse['transformedCandidates'];
  searchMetadata?: CandidateSearchResponse['searchMetadata'];
};

@Controller('candidate-search')
export class CandidateSearchController {
  private readonly logger = new Logger(CandidateSearchController.name);

  constructor(
    private readonly candidateSearchBaseService: CandidateSearchBaseService,
    private readonly candidateSearchHandlerService: CandidateSearchHandlerService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly workspaceCreditsService: WorkspaceCreditsService,
    private readonly linkedInRequestTracker: LinkedInSessionTrackerService,
    private readonly searchResultsCacheService: SearchResultsCacheService,
    private readonly searchExecutionService: SearchExecutionService,
    private readonly companyExpanderService: CompanyExpanderService,
    private readonly jobTitleExpanderService: JobTitleExpanderService,
    private readonly candidateDataService: CandidateDataService,
    private readonly orgchartCancelRegistry: OrgchartCancelRegistryService,
    private readonly orgChartS3Service: OrgChartS3Service,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  /**
   * Fetch LinkedIn search parameters for a specific type
   */
  @Get('parameters/:type')
  async fetchLinkedInParameters(
    @Param('type') type: string,
    @Req() req: any,
    @Query('keywords') keywords?: string,
    @Query('limit') limit?: string,
  ): Promise<any> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Fetching LinkedIn parameters for type: ${type}`);
      
      // Validate and parse limit parameter
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
        throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
      }
      
      const result = await this.candidateSearchBaseService.fetchLinkedInParameters(
        type,
        keywords,
        parsedLimit,
        apiToken,
      );

      this.logger.log(`Retrieved ${result.items.length} parameters for type: ${type}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch LinkedIn parameters', error);
      throw new HttpException(
        error.message || 'Failed to fetch LinkedIn parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Resolve parameter names to LinkedIn IDs
   */
  @Post('resolve-parameters')
  async resolveParameterIds(
    @Body() body: {
      searchParameters: any;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
    },
    @Req() req: any,
  ): Promise<any> {
    try {
      if (!body.searchParameters) {
        throw new HttpException('Search parameters are required', HttpStatus.BAD_REQUEST);
      }

      if (!body.searchType || !body.searchCategory) {
        throw new HttpException('Search type and category are required', HttpStatus.BAD_REQUEST);
      }

      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Resolving parameter IDs for ${body.searchType} ${body.searchCategory}`);
      
      // Get LinkedIn account ID from workspace
      const accountId = await this.candidateSearchBaseService.getLinkedInAccountId(apiToken);
      
      const result = await this.linkedinParameterResolver.resolveParameterIds(
        body.searchParameters,
        accountId,
      );

      this.logger.log('Successfully resolved parameter IDs');
      return result;
    } catch (error) {
      this.logger.error('Failed to resolve parameter IDs', error);
      throw new HttpException(
        error.message || 'Failed to resolve parameter IDs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Execute search from file/JD context (resolved parameters + parsed JD).
   * Replaces the non-existent search/from-file path; use this endpoint for search-from-file flows.
   */
  @Post('search-from-file')
  async searchFromFile(
    @Body() body: {
      filePath?: string;
      jobDescription?: string;
      jobTitle?: string;
      company?: string;
      location?: string;
      industry?: string;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
      searchParameters: any;
      parsedJD?: ParsedJobDescription;
      options?: { limit?: number; cursor?: string };
    },
    @Req() req: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limitParam?: string,
  ): Promise<{
    searchResults: { items: any[]; cursor?: string | null; paging?: any };
    transformedCandidates?: any[];
    resolvedSearchParameters?: any;
    searchMetadata?: any;
  }> {
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      const limit = body.options?.limit ?? (limitParam ? parseInt(limitParam, 10) : undefined) ?? 10;
      const maxPages = Math.max(1, Math.ceil(limit / 25));

      const parsedJD: ParsedJobDescription = body.parsedJD ?? {
        jobTitle: body.jobTitle ?? '',
        company: body.company ?? '',
        location: body.location ?? '',
        industry: body.industry ?? '',
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

      const searchParamKey = `${body.searchType.replace(/_([a-z])/g, (_, l: string) =>
        l.toUpperCase(),
      )}${body.searchCategory.charAt(0).toUpperCase() + body.searchCategory.slice(1)}Search`;

      const strategy = {
        id: 'search-from-file',
        label: 'Search from file',
        description: '',
        strategyText: '',
        parameters: body.searchParameters,
      } as any;

      const searchResult = await this.searchExecutionService.executeMultiPageSearchWithoutValidation(
        parsedJD,
        strategy,
        body.searchType,
        body.searchCategory,
        searchParamKey,
        apiToken,
        maxPages,
        undefined,
      );

      if (searchResult?.error) {
        throw new HttpException(
          searchResult.error.message || 'Search failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const searchResults = searchResult?.searchResults ?? null;
      return {
        searchResults: {
          items: searchResults?.items ?? [],
          cursor: searchResults?.cursor ?? null,
          paging: searchResults?.paging,
        },
        transformedCandidates: searchResult?.transformedCandidates,
        resolvedSearchParameters: body.searchParameters,
        searchMetadata: searchResult?.searchMetadata,
      };
    } catch (error: any) {
      this.logger.error('Search from file failed', error);
      throw new HttpException(
        error?.message || 'Search from file failed',
        error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }




  @Get(':assistantThreadId/history')
  async getChatHistory(
    @Param('assistantThreadId') assistantThreadId: string,
    @Headers() headers: any
  ) {
    try {
      const apiToken = headers.authorization.split(' ')[1];

      const thread = await this.candidateSearchHandlerService.getAssistantThreadContext(
        assistantThreadId,
        apiToken,
      );

      return {
        success: true,
        chatHistory: thread.messages || [],
      };
    } catch (error) {
      console.error('Error in getChatHistory:', error);
      throw new HttpException(
        error.message || 'Failed to get chat history',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('compute-tokens')
  async computeTokens(
    @Body() { assistantThreadId, enrichmentId }: { assistantThreadId: string; enrichmentId: string },
    @Headers() headers: any
  ) {
    try {
      const apiToken = headers.authorization.split(' ')[1];

      if (!assistantThreadId || !enrichmentId) {
        throw new HttpException(
          'assistantThreadId and enrichmentId are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const thread = await this.candidateSearchHandlerService.getAssistantThreadContext(
        assistantThreadId,
        apiToken,
      );
      const enrichment = thread.enrichmentConfigs?.find((e: { id: string }) => e.id === enrichmentId);
      
      if (!enrichment) {
        throw new HttpException('AI filter not found', HttpStatus.NOT_FOUND);
      }

      // Use existing compute-tokens logic from candidate-sourcing.controller.ts
      // This would need to be implemented to call the actual token computation service
      const tokenAnalysis = {
        enrichmentId: enrichmentId,
        estimatedTokens: 1000, // Mock value
        cost: 0.01, // Mock value
        model: enrichment.selectedModel || 'gpt-5.1-chat-latest',
      };
      
      return tokenAnalysis;
    } catch (error) {
      console.error('Error in computeTokens:', error);
      throw new HttpException(
        error.message || 'Failed to compute tokens',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('linkedin-request-status')
  async getLinkedInRequestStatus(@Headers() headers: any) {
    try {
      const apiToken = headers.authorization.split(' ')[1];
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      
      const status = await this.linkedInRequestTracker.getRequestStatus(workspaceId);
      
      return {
        success: true,
        ...status,
      };
    } catch (error) {
      console.error('Error in getLinkedInRequestStatus:', error);
      throw new HttpException(
        error.message || 'Failed to get request status',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get persisted search results and metadata from backend cache (3 months TTL).
   */
  @Get('cache/results')
  async getSearchResultsCache(
    @Query('jobId') jobId: string,
    @Req() req: any,
  ) {
    try {
      const apiToken = req.headers?.authorization?.replace?.('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }
      if (!jobId || jobId === 'job-id') {
        throw new HttpException('jobId is required', HttpStatus.BAD_REQUEST);
      }
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const payload =
        await this.searchResultsCacheService.get(workspaceId, jobId);
      if (!payload) {
        throw new HttpException('No cached results for this job', HttpStatus.NOT_FOUND);
      }
      return {
        results: payload.results,
        metadata: payload.metadata,
        jobId: payload.jobId,
        cachedAt: payload.cachedAt,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get search results cache', error);
      throw new HttpException(
        error?.message || 'Failed to get search results cache',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Persist search results and metadata to backend cache (3 months TTL).
   */
  @Put('cache/results')
  async setSearchResultsCache(
    @Body()
    body: {
      jobId: string;
      results: any[];
      metadata: {
        totalCount: number;
        currentPage: number;
        totalPages: number;
        cursor?: string;
        searchType?: string;
        searchCategory?: string;
        searchParameters?: any;
      };
    },
    @Req() req: any,
  ) {
    try {
      const apiToken = req.headers?.authorization?.replace?.('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }
      if (!body?.jobId || body.jobId === 'job-id') {
        throw new HttpException('jobId is required', HttpStatus.BAD_REQUEST);
      }
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      await this.searchResultsCacheService.set(
        workspaceId,
        body.jobId,
        body.results ?? [],
        body.metadata ?? {
          totalCount: 0,
          currentPage: 0,
          totalPages: 0,
        },
      );
      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to set search results cache', error);
      throw new HttpException(
        error?.message || 'Failed to set search results cache',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  /**
   * Expand companies from parsed requirement
   */
  @Post('expand-companies')
  async expandCompanies(
    @Body() body: { parsedRequirement: Record<string, unknown> },
    @Req() req: any,
  ) {
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
      this.logger.log(`Company analysis: ${JSON.stringify(companyAnalysis, null, 2)}`);
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
   * Expand job titles from parsed requirement
   */
  @Post('expand-job-titles')
  async expandJobTitles(
    @Body() body: { parsedRequirement: Record<string, unknown> },
    @Req() req: any,
  ) {
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
      this.logger.log(`Title analysis: ${JSON.stringify(titleAnalysis, null, 2)}`);
      return { titleAnalysis };
    } catch (error) {
      this.logger.error('Error in job title expander:', error);
      throw new HttpException(
        error.message || 'Failed to expand job titles',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

 
}
