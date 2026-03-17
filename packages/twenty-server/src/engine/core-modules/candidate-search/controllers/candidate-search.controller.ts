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
import { LinkedInSessionTrackerService } from 'src/engine/core-modules/linkedin-search/services/linkedin-session-tracker.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import type { OrgChartData } from 'twenty-shared';
import type { ParsedRequirement } from '../schemas/parsed-requirement.schema';
import { CandidateSearchHandlerService } from '../services/candidate-search-handler.service';
import { CompanyExpanderService } from '../services/company-expander.service';
import { JobTitleExpanderService } from '../services/job-title-expander.service';
import { OrgchartCancelRegistryService } from '../services/orgchart-cancel-registry.service';
import { SearchExecutionService } from '../services/search-execution.service';
import { SearchResultsCacheService } from '../services/search-results-cache.service';
import {
  CandidateSearchResponse,
  ParsedJobDescription,
} from '../types/candidate-search-request.type';
import { extractApiToken } from '../utils/auth.utils';
import { LinkedinParameterResolver } from '../utils/linkedin-parameter-resolver.util';
import { hasMeaningfulOrgChartFunctionRootFilter } from '../utils/orgchart-filter.util';

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




  @Get(':searchFilterId/history')
  async getChatHistory(
    @Param('searchFilterId') searchFilterId: string,
    @Headers() headers: any
  ) {
    try {
      const apiToken = headers.authorization.split(' ')[1];
        
      const searchFilter = await this.candidateSearchHandlerService.getSearchFilter(searchFilterId, apiToken);
      
      return {
        success: true,
        chatHistory: searchFilter.chatHistory || [],
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
    @Body() { searchFilterId, enrichmentId }: { searchFilterId: string; enrichmentId: string },
    @Headers() headers: any
  ) {
    try {
      const apiToken = headers.authorization.split(' ')[1];
      
      if (!searchFilterId || !enrichmentId) {
        throw new HttpException('searchFilterId and enrichmentId are required', HttpStatus.BAD_REQUEST);
      }

      const searchFilter = await this.candidateSearchHandlerService.getSearchFilter(searchFilterId, apiToken);
      const enrichment = searchFilter.enrichmentConfigs?.find((e: any) => e.id === enrichmentId);
      
      if (!enrichment) {
        throw new HttpException('AI filter not found', HttpStatus.NOT_FOUND);
      }

      // Use existing compute-tokens logic from candidate-sourcing.controller.ts
      // This would need to be implemented to call the actual token computation service
      const tokenAnalysis = {
        enrichmentId: enrichmentId,
        estimatedTokens: 1000, // Mock value
        cost: 0.01, // Mock value
        model: enrichment.selectedModel || 'gpt-4o',
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
   * Build an org chart directly from candidates attached to a specific job,
   * without running a new LinkedIn search.
   */
  @Post('orgchart/from-job')
  async buildOrgChartFromJobCandidates(
    @Body()
    body: {
      jobId: string;
      jobName?: string;
    },
    @Req() req: any,
  ) {
    try {
      const apiToken = req.headers?.authorization?.replace?.('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      const jobId = body?.jobId;
      if (!jobId || jobId === 'job-id') {
        throw new HttpException('jobId is required', HttpStatus.BAD_REQUEST);
      }

      // Fetch all candidates currently attached to this job
      const candidates =
        await this.candidateDataService.fetchCandidatesForJob(
          jobId,
          [],
          apiToken,
        );

      if (!candidates.length) {
        return {
          success: true,
          mode: 'entire_company' as OrgchartSearchMode,
          searchType: 'classic' as OrgchartSearchType,
          jobId,
          itemCount: 0,
          items: [],
          orgChart: undefined,
          isCached: false,
          cacheSource: 'none',
        };
      }

      // Infer primary company name from candidate data (e.g. job_company_name field),
      // falling back to the provided jobName when needed.
      const companyCounts = new Map<string, number>();
      for (const candidate of candidates as Array<Record<string, unknown>>) {
        const raw = candidate as { [key: string]: unknown };
        const companyNameValue =
          (typeof raw.job_company_name === 'string' &&
            raw.job_company_name) ||
          (typeof raw.company === 'string' && raw.company) ||
          '';
        const trimmed = companyNameValue?.trim();
        if (trimmed) {
          companyCounts.set(trimmed, (companyCounts.get(trimmed) ?? 0) + 1);
        }
      }

      let primaryCompanyName = '';
      let maxCount = 0;
      for (const [name, count] of companyCounts.entries()) {
        if (count > maxCount) {
          primaryCompanyName = name;
          maxCount = count;
        }
      }

      if (!primaryCompanyName) {
        primaryCompanyName = body.jobName?.trim() || 'OrgChart Job';
      }

      this.logger.log(
        `Building job org chart from ${candidates.length} candidates for jobId="${jobId}", primaryCompany="${primaryCompanyName}"`,
      );

      const orgChart =
        await this.candidateSearchHandlerService.buildOrgChartFromLinkedInCompanyCandidates(
          candidates,
          {
            companyName: primaryCompanyName,
            companyId: undefined,
            mode: 'entire_company',
            function: undefined,
          },
        );

      return {
        success: true,
        mode: 'entire_company' as OrgchartSearchMode,
        searchType: 'classic' as OrgchartSearchType,
        jobId,
        companyName: primaryCompanyName,
        itemCount: candidates.length,
        items: candidates,
        orgChart,
        isCached: false,
        cacheSource: 'job_candidates',
      };
    } catch (error: any) {
      this.logger.error(
        'Failed to build org chart from job candidates',
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error?.message || 'Failed to build org chart from job candidates',
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

 
  /**
   * Org chart search: find people at a company by mode (leadership, entire_company, function_grade, etc.).
   */
  @Post('orgchart')
  async searchOrgchart(
    @Body() body: {
      rawQuery: string;
      cleanedQuery: string;
      companyName?: string;
      companyId?: string;
      jobTitles?: string[];
      mode: OrgchartSearchMode;
      maxPages?: number;
      searchType?: OrgchartSearchType;
      requestId?: string;
      country?: string;
      functionRoot?: string;
    },
    @Headers() headers: Record<string, string>,
  ) {
    const apiToken = extractApiToken(headers);
    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.log("body::", body);
    const {
      companyName,
      companyId,
      jobTitles = [],
      mode,
      searchType = 'classic',
      requestId,
      country,
      functionRoot,
    } = body;



    const resolvedCompanyName =
      companyName || (companyId ? String(companyId) : '');

    let requirement: string;
    switch (mode) {
      case 'leadership':
        requirement = `Find all leadership positions at ${resolvedCompanyName}.`;
        break;
      case 'entire_company':
      case 'all_people':
        requirement = `Find all people currently working at ${resolvedCompanyName}.`;
        break;
      case 'function_grade': {
        const titlesText =
          jobTitles && jobTitles.length > 0
            ? jobTitles.join(', ')
            : 'the relevant function and seniority described by the node';
        requirement = `Find people at ${resolvedCompanyName} with job titles similar to: ${titlesText}.`;
        break;
      }
      case 'selected_nodes':
        requirement = `Find people for the selected nodes at ${resolvedCompanyName}.`;
        break;
      case 'current_node':
      default: {
        const titlesText =
          jobTitles && jobTitles.length > 0
            ? jobTitles.join(', ')
            : 'this role';
        requirement = `Find people matching ${titlesText} at ${resolvedCompanyName}.`;
        break;
      }
    }

    this.logger.log(
      `Orgchart search requested. Mode=${mode}, searchType=${searchType}, company="${resolvedCompanyName}", jobTitles=${JSON.stringify(
        jobTitles,
      )}`,
    );

    let shouldWriteCompanyOrgChartCache = true;

    if (mode === 'entire_company') {
      const filterCountryRaw = body.country;
      const filterFunctionRootRaw = body.functionRoot;
      const normalizedCountryRaw =
        typeof filterCountryRaw === 'string' ? filterCountryRaw.trim() : '';
      const hasCountryFilter =
        normalizedCountryRaw.length > 0 &&
        normalizedCountryRaw.toLowerCase() !== 'global';

      const normalizedFunctionRootRaw =
        typeof filterFunctionRootRaw === 'string'
          ? filterFunctionRootRaw.trim()
          : '';
      const hasFunctionRootFilter =
        hasMeaningfulOrgChartFunctionRootFilter(normalizedFunctionRootRaw);
      shouldWriteCompanyOrgChartCache =
        !hasCountryFilter && !hasFunctionRootFilter;

      const applyFiltersToItems = (items: any[]): any[] => {
        if (!hasCountryFilter && !hasFunctionRootFilter) {
          return items;
        }

        return items.filter((item) => {
          const raw = item as Record<string, unknown>;

          if (hasCountryFilter) {
            const filterCountry = normalizedCountryRaw.toLowerCase();
            const possibleCountryValues = [
              raw.locationCountry,
              raw.location_country,
              raw.country,
            ].filter(
              (v): v is string =>
                typeof v === 'string' && v.trim().length > 0,
            );

            const normalizedCountry =
              possibleCountryValues[0]?.trim().toLowerCase() ?? '';

            if (!normalizedCountry.includes(filterCountry)) {
              return false;
            }
          }

          if (hasFunctionRootFilter) {
            const filterFunctionRoot = normalizedFunctionRootRaw.toLowerCase();
            const possibleFunctionRootValues = [
              (raw as { std_function_root?: unknown }).std_function_root,
              (raw as { functionRoot?: unknown }).functionRoot,
              (raw as { function_root?: unknown }).function_root,
            ].filter(
              (v): v is string =>
                typeof v === 'string' && v.trim().length > 0,
            );

            const normalizedFunctionRoot =
              possibleFunctionRootValues[0]?.trim().toLowerCase() ?? '';

            if (
              normalizedFunctionRoot === '' ||
              !normalizedFunctionRoot.includes(filterFunctionRoot)
            ) {
              return false;
            }
          }

          return true;
        });
      };

      const isFullCompanyOrgChartPayload = (
        orgChartPayload: unknown,
      ): boolean => {
        if (
          !orgChartPayload ||
          typeof orgChartPayload !== 'object' ||
          Array.isArray(orgChartPayload)
        ) {
          return false;
        }

        const rawType = (orgChartPayload as { type?: unknown }).type;
        return (
          typeof rawType === 'string' &&
          rawType.trim().toLowerCase() === 'fullcompany'
        );
      };

      const cachedOrgChart =
        await this.candidateSearchHandlerService.getCachedCompanyOrgChart({
          companyName: resolvedCompanyName,
          companyId,
          mode: 'entire_company',
          searchType,
        });

      if (cachedOrgChart) {
        if (
          !hasCountryFilter &&
          !hasFunctionRootFilter &&
          !isFullCompanyOrgChartPayload(cachedOrgChart.orgChart)
        ) {
          this.logger.warn(
            `Ignoring invalid company org chart cache for company="${resolvedCompanyName}" because cached orgChart.type is not fullcompany`,
          );
        } else {
          const creditsAlreadyDebited = cachedOrgChart.creditsDebited !== false;
          if (creditsAlreadyDebited) {
            this.logger.log(
              `Serving cached company org chart for company="${resolvedCompanyName}" (credits already debited)`,
            );
            const baseItems = Array.isArray(cachedOrgChart.items)
              ? cachedOrgChart.items
              : [];
            const filteredItems = applyFiltersToItems(baseItems);
            const orgChartForResponse = hasCountryFilter || hasFunctionRootFilter
              ? await this.candidateSearchHandlerService.buildOrgChartFromLinkedInCompanyCandidates(
                  filteredItems,
                  {
                    companyName: resolvedCompanyName,
                    companyId,
                    mode: 'entire_company',
                    function: hasFunctionRootFilter
                      ? normalizedFunctionRootRaw
                      : undefined,
                  },
                )
              : cachedOrgChart.orgChart;
            return {
              success: true,
              mode,
              searchType,
              companyName: resolvedCompanyName,
              jobTitles,
              itemCount: filteredItems.length,
              items: filteredItems,
              orgChart: orgChartForResponse,
              isCached: true,
              cacheSource: 'orgchart',
              cachedAt: cachedOrgChart.cachedAt,
            };
          }
          if (process.env.IS_BILLING_ENABLED === 'true' && apiToken) {
            const workspaceId =
              await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
            const hasSufficient =
              await this.workspaceCreditsService.hasSufficientOrgChartCredits(
                workspaceId,
                cachedOrgChart.itemCount,
              );
            if (!hasSufficient) {
              const creditsNeeded =
                this.workspaceCreditsService.computeOrgChartCreditsNeeded(
                  cachedOrgChart.itemCount,
                );
              throw new HttpException(
                `Insufficient org chart credits. Need ${creditsNeeded} credits for ${cachedOrgChart.itemCount} employees.`,
                HttpStatus.FORBIDDEN,
              );
            }
            await this.workspaceCreditsService.debitOrgChartCredits(
              workspaceId,
              cachedOrgChart.itemCount,
              { companyName: resolvedCompanyName, companyId },
            );
            await this.candidateSearchHandlerService.setCachedCompanyOrgChart({
              companyName: resolvedCompanyName,
              companyId,
              mode: 'entire_company',
              searchType,
              orgChart: cachedOrgChart.orgChart,
              items: cachedOrgChart.items,
              itemCount: cachedOrgChart.itemCount,
              creditsDebited: true,
            });
          }
          this.logger.log(
            `Serving cached company org chart for company="${resolvedCompanyName}" (credits debited on this request)`,
          );
          const baseItems = Array.isArray(cachedOrgChart.items)
            ? cachedOrgChart.items
            : [];
          const filteredItems = applyFiltersToItems(baseItems);
          const orgChartForResponse = hasCountryFilter || hasFunctionRootFilter
            ? await this.candidateSearchHandlerService.buildOrgChartFromLinkedInCompanyCandidates(
                filteredItems,
                {
                  companyName: resolvedCompanyName,
                  companyId,
                  mode: 'entire_company',
                  function: hasFunctionRootFilter
                    ? normalizedFunctionRootRaw
                    : undefined,
                },
              )
            : cachedOrgChart.orgChart;
          return {
            success: true,
            mode,
            searchType,
            companyName: resolvedCompanyName,
            jobTitles,
            itemCount: filteredItems.length,
            items: filteredItems,
            orgChart: orgChartForResponse,
            isCached: true,
            cacheSource: 'orgchart',
            cachedAt: cachedOrgChart.cachedAt,
          };
        }
      }

      const cachedCandidateList =
        await this.candidateSearchHandlerService.getCachedCompanyCandidateList({
          companyName: resolvedCompanyName,
          companyId,
          mode: 'entire_company',
          searchType,
        });

      if (cachedCandidateList && cachedCandidateList.itemCount > 0) {
        this.logger.log(
          `Building org chart from cached candidate list for company="${resolvedCompanyName}" (${cachedCandidateList.itemCount} candidates)`,
        );
        try {
          const baseItems = Array.isArray(cachedCandidateList.items)
            ? cachedCandidateList.items
            : [];
          const filteredItems = applyFiltersToItems(baseItems);
          const orgChartFromCache =
            await this.candidateSearchHandlerService.buildOrgChartFromLinkedInCompanyCandidates(
              filteredItems,
              {
                companyName: resolvedCompanyName,
                companyId,
                mode,
                function: hasFunctionRootFilter
                  ? normalizedFunctionRootRaw
                  : undefined,
              },
            );
          const shouldCacheBuiltOrgChartFromCandidateList =
            this.candidateSearchHandlerService.shouldCacheCompanyOrgChart({
              orgChart: orgChartFromCache,
              fallbackCandidateCount: cachedCandidateList.itemCount,
              companyName: resolvedCompanyName,
              companyId,
            });
          let creditsDebited = process.env.IS_BILLING_ENABLED !== 'true';
          if (process.env.IS_BILLING_ENABLED === 'true' && apiToken) {
            const workspaceId =
              await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
            const hasSufficient =
              await this.workspaceCreditsService.hasSufficientOrgChartCredits(
                workspaceId,
                cachedCandidateList.itemCount,
              );
            if (!hasSufficient) {
              if (
                shouldCacheBuiltOrgChartFromCandidateList &&
                shouldWriteCompanyOrgChartCache
              ) {
                await this.candidateSearchHandlerService.setCachedCompanyOrgChart({
                  companyName: resolvedCompanyName,
                  companyId,
                  mode: 'entire_company',
                  searchType,
                  orgChart: orgChartFromCache,
                  items: cachedCandidateList.items,
                  itemCount: cachedCandidateList.itemCount,
                  creditsDebited: false,
                });
              }
              const creditsNeeded =
                this.workspaceCreditsService.computeOrgChartCreditsNeeded(
                  cachedCandidateList.itemCount,
                );
              throw new HttpException(
                `Insufficient org chart credits. Need ${creditsNeeded} credits for ${cachedCandidateList.itemCount} employees.`,
                HttpStatus.FORBIDDEN,
              );
            }
            await this.workspaceCreditsService.debitOrgChartCredits(
              workspaceId,
              cachedCandidateList.itemCount,
              { companyName: resolvedCompanyName, companyId },
            );
            creditsDebited = true;
          }
          if (
            shouldCacheBuiltOrgChartFromCandidateList &&
            shouldWriteCompanyOrgChartCache
          ) {
            await this.candidateSearchHandlerService.setCachedCompanyOrgChart({
              companyName: resolvedCompanyName,
              companyId,
              mode: 'entire_company',
              searchType,
              orgChart: orgChartFromCache,
              items: baseItems,
              itemCount: baseItems.length,
              creditsDebited,
            });
          }
          return {
            success: true,
            mode,
            searchType,
            companyName: resolvedCompanyName,
            jobTitles,
            itemCount: filteredItems.length,
            items: filteredItems,
            orgChart: orgChartFromCache,
            isCached: true,
            cacheSource: 'candidate_list',
            cachedAt: cachedCandidateList.cachedAt,
          };
        } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }
          this.logger.error(
            `Failed to build org chart from cached candidates for company="${resolvedCompanyName}"`,
            error as Error,
          );
          const baseItems = Array.isArray(cachedCandidateList.items)
            ? cachedCandidateList.items
            : [];
          const filteredItems = applyFiltersToItems(baseItems);
          return {
            success: true,
            mode,
            searchType,
            companyName: resolvedCompanyName,
            jobTitles,
            itemCount: filteredItems.length,
            items: filteredItems,
            orgChart: undefined,
            isCached: true,
            cacheSource: 'candidate_list',
            cachedAt: cachedCandidateList.cachedAt,
          };
        }
      }
    }

    if (requestId) {
      this.orgchartCancelRegistry.register(requestId);
    }

    const result =
      await this.candidateSearchHandlerService.runOrgchartLinkedInSearch(
        body.rawQuery,
        body.cleanedQuery,
        searchType,
        apiToken,
        undefined,
        {
          mode,
          companyName: resolvedCompanyName,
          companyId,
          requestId,
          jobTitles: body.jobTitles,
          country: body.country,
          functionRoot: body.functionRoot,
        },
      );

    let orgChart: OrgChartData | undefined;

    if (mode === 'entire_company' && result.itemCount > 0) {
      await this.candidateSearchHandlerService.setCachedCompanyCandidateList({
        companyName: resolvedCompanyName,
        companyId,
        mode: 'entire_company',
        searchType,
        items: result.items,
        itemCount: result.itemCount,
      });
    }

    if (mode === 'entire_company' && result.itemCount > 0) {
      try {
        orgChart =
          await this.candidateSearchHandlerService.buildOrgChartFromLinkedInCompanyCandidates(
            result.items,
            {
              companyName: resolvedCompanyName,
              companyId,
              mode,
              // When a functionRoot filter is provided, pass it down so that
              // the Python org-chart pipeline can build a function-specific
              // chart instead of always returning the full company.
              function: body.functionRoot,
            },
          );
      } catch (error) {
        this.logger.error(
          `Failed to build org chart from LinkedIn orgchart search for company="${resolvedCompanyName}"`,
          error as Error,
        );
      }
      const shouldCacheBuiltOrgChartFromLinkedIn =
        orgChart &&
        this.candidateSearchHandlerService.shouldCacheCompanyOrgChart({
          orgChart,
          fallbackCandidateCount: result.itemCount,
          companyName: resolvedCompanyName,
          companyId,
        });
      let creditsDebited = process.env.IS_BILLING_ENABLED !== 'true';
      if (process.env.IS_BILLING_ENABLED === 'true' && apiToken) {
        const workspaceId =
          await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
        const hasSufficient =
          await this.workspaceCreditsService.hasSufficientOrgChartCredits(
            workspaceId,
            result.itemCount,
          );
        if (!hasSufficient) {
          if (
            shouldCacheBuiltOrgChartFromLinkedIn &&
            shouldWriteCompanyOrgChartCache &&
            orgChart
          ) {
            await this.candidateSearchHandlerService.setCachedCompanyOrgChart({
              companyName: resolvedCompanyName,
              companyId,
              mode: 'entire_company',
              searchType,
              orgChart,
              items: result.items,
              itemCount: result.itemCount,
              creditsDebited: false,
            });
          }
          const creditsNeeded =
            this.workspaceCreditsService.computeOrgChartCreditsNeeded(
              result.itemCount,
            );
          throw new HttpException(
            `Insufficient org chart credits. Need ${creditsNeeded} credits for ${result.itemCount} employees.`,
            HttpStatus.FORBIDDEN,
          );
        }
        await this.workspaceCreditsService.debitOrgChartCredits(
          workspaceId,
          result.itemCount,
          { companyName: resolvedCompanyName, companyId },
        );
        creditsDebited = true;
      }
      if (
        shouldCacheBuiltOrgChartFromLinkedIn &&
        shouldWriteCompanyOrgChartCache &&
        orgChart
      ) {
        await this.candidateSearchHandlerService.setCachedCompanyOrgChart({
          companyName: resolvedCompanyName,
          companyId,
          mode: 'entire_company',
          searchType,
          orgChart,
          items: result.items,
          itemCount: result.itemCount,
          creditsDebited,
        });
      }
    }

    // Build and return org chart for function-root scoped searches as well.
    // This keeps the candidate list payload while enabling the org chart UI to render.
    if (mode === 'function_grade' && result.itemCount > 0) {
      orgChart = result.orgChart;
      try {
        if (!orgChart) {
          orgChart =
            await this.candidateSearchHandlerService.buildOrgChartFromLinkedInCompanyCandidates(
              result.items,
              {
                companyName: resolvedCompanyName,
                companyId,
                mode,
                function: body.functionRoot,
              },
            );
        }
      } catch (error) {
        this.logger.error(
          `Failed to build function-grade org chart for company="${resolvedCompanyName}"`,
          error as Error,
        );
      }

      if (
        result.functionGradeCacheMeta &&
        result.functionGradeCacheMeta.functionRoot
      ) {
        await this.candidateSearchHandlerService.setCachedFunctionGradeSearch({
          companyName: resolvedCompanyName,
          companyId,
          functionRoot: result.functionGradeCacheMeta.functionRoot,
          country: result.functionGradeCacheMeta.country,
          searchType,
          strategyCap: result.functionGradeCacheMeta.strategyCap,
          keywordsHash: result.functionGradeCacheMeta.keywordsHash,
          items: result.items,
          itemCount: result.itemCount,
          ...(orgChart ? { orgChart } : {}),
        });
      }
    }

    return {
      success: true,
      mode,
      searchType,
      companyName: resolvedCompanyName,
      jobTitles,
      itemCount: result.itemCount,
      items: result.items,
      orgChart,
      isCached: result.isCached ?? false,
      cacheSource: result.cacheSource ?? 'none',
    };
  }

  /**
   * Cancel an in-progress orgchart search by requestId.
   * The running search will stop at the next progress check (e.g. between pages).
   */
  @Post('orgchart/cancel')
  async cancelOrgchartSearch(
    @Body() body: { requestId: string },
    @Headers() headers: Record<string, string>,
  ) {
    const apiToken = extractApiToken(headers);
    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }
    const { requestId } = body;
    if (!requestId || typeof requestId !== 'string') {
      throw new HttpException('requestId is required', HttpStatus.BAD_REQUEST);
    }
    this.orgchartCancelRegistry.setCancelled(requestId);
    this.logger.log(`Orgchart search cancelled. requestId=${requestId}`);
    return { success: true, requestId };
  }
}
