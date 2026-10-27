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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  parseWorkspaceMemberLinkedinProfile,
  workspaceMemberLinkedinProfileMatchesAccountId,
  type LinkedInSearchType,
} from 'twenty-shared';

import { LinkedinParameterResolver } from 'src/engine/core-modules/candidate-search/utils/linkedin-parameter-resolver.util';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import type { SearchQuerySet } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

import { WorkspaceMemberUnipileService } from '../../arx-chat/services/workspace-member-unipile.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { LinkedInSearchService } from '../services/linkedin-search.service';
import { LinkedInSearchParameterType } from '../types/linkedin-search-parameter.type';
import {
  LinkedInClassicCompaniesSearchRequest,
  LinkedInClassicJobsSearchRequest,
  LinkedInClassicPeopleSearchRequest,
  LinkedInClassicPostsSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorCompaniesSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
  LinkedInSearchRequest,
} from '../types/linkedin-search-request.type';
import {
  LinkedInSearchParametersList,
  LinkedInSearchResponse,
} from '../types/linkedin-search-response.type';
import {
  classifyLinkedInSearchUrl,
  isCompanyLinkedInSearchUrl,
  isPeopleLinkedInSearchUrl,
  type LinkedInSearchUrlCategory,
} from '../utils/classify-linkedin-search-url.util';
import {
  formatUnavailableLinkedinSearchModeMessage,
  isLinkedinSearchMode,
  resolveLinkedinSearchMode,
  type LinkedinSearchCategory,
  type LinkedinSearchModeAvailability,
} from '../utils/linkedin-search-mode.util';
import {
  mapLinkedinQuerySetToSearchParameters,
  splitLinkedinFacetDisplay,
} from '../utils/map-linkedin-query-set-to-search-parameters.util';
import { type UnipileUserRelationsList } from '../utils/unipile-user-relations.util';

type ResolvedLinkedinSearchMode = {
  accountId: string;
  mode: LinkedInSearchType;
  availability: LinkedinSearchModeAvailability;
};

@Controller('linkedin-search')
export class LinkedInSearchController {
  private readonly logger = new Logger(LinkedInSearchController.name);

  constructor(
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly workspaceMemberUnipileService: WorkspaceMemberUnipileService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
  ) {}

  /**
   * Extract API token from headers
   */
  private extractApiToken(headers: any): string | null {
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Get LinkedIn account ID from token if not provided.
   * Uses workspace member profile first, then falls back to workspace-level.
   */
  private async getAccountId(
    accountId: string | undefined,
    headers: any,
  ): Promise<string> {
    if (accountId) {
      return accountId;
    }

    const apiToken = this.extractApiToken(headers);
    if (!apiToken) {
      throw new HttpException(
        'Account ID is required or valid authorization token must be provided',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const workspaceMemberId =
        await this.workspaceQueryService.getWorkspaceMemberIdFromToken(
          apiToken,
        );
      const linkedinAccountId =
        await this.workspaceMemberUnipileService.getWorkspaceMemberUnipileAccountId(
          workspaceMemberId,
          workspaceId,
          apiToken,
          'linkedin',
        );

      if (!linkedinAccountId) {
        throw new HttpException(
          'LinkedIn account ID not found in workspace API keys',
          HttpStatus.BAD_REQUEST,
        );
      }

      return linkedinAccountId;
    } catch (error) {
      this.logger.error(
        `Error getting LinkedIn account ID from token: ${error}`,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to get LinkedIn account ID from token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Perform LinkedIn search
   */
  @Post('search')
  async search(
    @Body() searchRequest: LinkedInSearchRequest,
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      this.logger.log(
        `Performing LinkedIn search for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.search(
        searchRequest,
        resolvedAccountId,
        { cursor, limit },
      );

      this.logger.log(
        `LinkedIn search completed successfully. Found ${result.items.length} results.`,
      );
      return result;
    } catch (error) {
      this.logger.error('LinkedIn search failed', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'LinkedIn search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Seats come from the stored workspace member profile (`linkedinProfile.me`)
  // of the member who owns the account, so no Unipile call is made here
  private async findStoredLinkedinProfile(
    accountId: string,
    headers: any,
  ): Promise<unknown> {
    const apiToken = this.extractApiToken(headers);
    if (!apiToken) {
      return null;
    }

    try {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      if (!workspaceId) {
        return null;
      }

      const profiles =
        await this.workspaceQueryService.listWorkspaceMemberLinkedinUnipileProfiles(
          workspaceId,
        );
      const owner = profiles.find(
        (profile) => profile.linkedinUnipileAccountId === accountId,
      );
      const stored = parseWorkspaceMemberLinkedinProfile(
        owner?.linkedinProfile,
      );

      // A profile fetched for an earlier account says nothing about this one
      return workspaceMemberLinkedinProfileMatchesAccountId(stored, accountId)
        ? stored
        : null;
    } catch (error) {
      this.logger.warn(
        `LinkedIn search mode: stored profile lookup failed for account ${accountId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  private async resolveSearchModeOrThrow(
    accountId: string | undefined,
    headers: any,
    category: LinkedinSearchCategory,
    requestedSearchType: unknown,
  ): Promise<ResolvedLinkedinSearchMode> {
    if (
      requestedSearchType !== undefined &&
      requestedSearchType !== null &&
      !isLinkedinSearchMode(requestedSearchType)
    ) {
      throw new HttpException(
        `searchType must be one of classic, sales_navigator, recruiter (got "${String(requestedSearchType)}")`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const resolvedAccountId = await this.getAccountId(accountId, headers);
    const linkedinProfile = await this.findStoredLinkedinProfile(
      resolvedAccountId,
      headers,
    );
    const resolution = resolveLinkedinSearchMode({
      requested: requestedSearchType ?? undefined,
      linkedinProfile,
      category,
    });

    if (!resolution.ok) {
      throw new HttpException(
        formatUnavailableLinkedinSearchModeMessage(
          resolution.requested,
          category,
          resolution.availability,
        ),
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      accountId: resolvedAccountId,
      mode: resolution.mode,
      availability: resolution.availability,
    };
  }

  private toSearchBody(
    searchParameters: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    const { api: _api, category: _category, ...rest } = searchParameters ?? {};

    return splitLinkedinFacetDisplay(rest).searchParameters;
  }

  /**
   * Which search modes the account can use, from its stored seats
   */
  @Get('search-modes')
  @UseGuards(JwtAuthGuard, NoPermissionGuard)
  async getSearchModes(
    @Query('category') category: string | undefined,
    @Query('account_id') accountId: string | undefined,
    @Headers() headers?: any,
  ): Promise<{
    accountId: string;
    category: LinkedinSearchCategory;
    defaultMode: LinkedInSearchType;
    available: LinkedInSearchType[];
    known: boolean;
  }> {
    const resolvedCategory: LinkedinSearchCategory =
      category === 'companies' ? 'companies' : 'people';
    const resolved = await this.resolveSearchModeOrThrow(
      accountId,
      headers || {},
      resolvedCategory,
      undefined,
    );

    return {
      accountId: resolved.accountId,
      category: resolvedCategory,
      defaultMode: resolved.mode,
      available: resolved.availability.available,
      known: resolved.availability.known,
    };
  }

  /**
   * People search where searchType is optional: it defaults to the account's
   * best seat and is rejected with 400 when the account lacks that seat
   */
  @Post('search/auto/people')
  @UseGuards(JwtAuthGuard, NoPermissionGuard)
  async searchPeopleAuto(
    @Body()
    body: {
      searchType?: LinkedInSearchType;
      searchParameters?: Record<string, unknown>;
    },
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse & { searchType: LinkedInSearchType }> {
    const { accountId: resolvedAccountId, mode } =
      await this.resolveSearchModeOrThrow(
        accountId,
        headers || {},
        'people',
        body?.searchType,
      );
    const request = this.toSearchBody(body?.searchParameters);
    const options = { cursor, limit };

    this.logger.log(
      `Searching people on LinkedIn (${mode}) for account: ${resolvedAccountId}`,
    );

    try {
      const result =
        mode === 'sales_navigator'
          ? await this.linkedInSearchService.searchPeopleSalesNavigator(
              request as Omit<
                LinkedInSalesNavigatorPeopleSearchRequest,
                'api' | 'category'
              >,
              resolvedAccountId,
              options,
            )
          : mode === 'recruiter'
            ? await this.linkedInSearchService.searchPeopleRecruiter(
                request as Omit<
                  LinkedInRecruiterPeopleSearchRequest,
                  'api' | 'category'
                >,
                resolvedAccountId,
                options,
              )
            : await this.linkedInSearchService.searchPeopleClassic(
                request as Omit<
                  LinkedInClassicPeopleSearchRequest,
                  'api' | 'category'
                >,
                resolvedAccountId,
                options,
              );

      return { ...result, searchType: mode };
    } catch (error) {
      this.logger.error(`LinkedIn ${mode} people search failed`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || `LinkedIn ${mode} people search failed`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Company search where searchType is optional (classic or sales_navigator)
   */
  @Post('search/auto/companies')
  @UseGuards(JwtAuthGuard, NoPermissionGuard)
  async searchCompaniesAuto(
    @Body()
    body: {
      searchType?: LinkedInSearchType;
      searchParameters?: Record<string, unknown>;
    },
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse & { searchType: LinkedInSearchType }> {
    const { accountId: resolvedAccountId, mode } =
      await this.resolveSearchModeOrThrow(
        accountId,
        headers || {},
        'companies',
        body?.searchType,
      );
    const request = this.toSearchBody(body?.searchParameters);
    const options = { cursor, limit };

    this.logger.log(
      `Searching companies on LinkedIn (${mode}) for account: ${resolvedAccountId}`,
    );

    try {
      const result =
        mode === 'sales_navigator'
          ? await this.linkedInSearchService.searchCompaniesSalesNavigator(
              request as Omit<
                LinkedInSalesNavigatorCompaniesSearchRequest,
                'api' | 'category'
              >,
              resolvedAccountId,
              options,
            )
          : await this.linkedInSearchService.searchCompanies(
              request as Omit<
                LinkedInClassicCompaniesSearchRequest,
                'api' | 'category'
              >,
              resolvedAccountId,
              options,
            );

      return { ...result, searchType: mode };
    } catch (error) {
      this.logger.error(`LinkedIn ${mode} company search failed`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || `LinkedIn ${mode} company search failed`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Turn a generated query set (names) into searchParameters for one mode,
   * with facet names resolved to LinkedIn ids for this account
   */
  @Post('query-set/parameters')
  @UseGuards(JwtAuthGuard, NoPermissionGuard)
  async buildQuerySetParameters(
    @Body()
    body: {
      querySet: SearchQuerySet;
      category?: LinkedinSearchCategory;
      searchType?: LinkedInSearchType;
      requirement?: string;
    },
    @Query('account_id') accountId: string | undefined,
    @Headers() headers?: any,
  ): Promise<{
    searchType: LinkedInSearchType;
    category: LinkedinSearchCategory;
    available: LinkedInSearchType[];
    queries: Array<{
      id: string;
      label: string;
      searchParameters: Record<string, unknown>;
      display: Record<string, unknown>;
      unresolved?: string[];
    }>;
  }> {
    if (!Array.isArray(body?.querySet?.search_query_set)) {
      throw new HttpException(
        'querySet.search_query_set is required (the final_query_set from generate)',
        HttpStatus.BAD_REQUEST,
      );
    }

    const category: LinkedinSearchCategory =
      body.category === 'companies' ? 'companies' : 'people';
    const {
      accountId: resolvedAccountId,
      mode,
      availability,
    } = await this.resolveSearchModeOrThrow(
      accountId,
      headers || {},
      category,
      body.searchType,
    );

    const unresolvedQueries = mapLinkedinQuerySetToSearchParameters({
      querySet: body.querySet,
      mode,
      category,
      requirement: body.requirement,
    });

    const queries = [];
    for (const query of unresolvedQueries) {
      queries.push(
        await this.resolveQuerySetFacets(query, mode, resolvedAccountId),
      );
    }

    return {
      searchType: mode,
      category,
      available: availability.available,
      queries,
    };
  }

  private async resolveQuerySetFacets(
    query: {
      id: string;
      label: string;
      searchParameters: Record<string, unknown>;
    },
    mode: LinkedInSearchType,
    accountId: string,
  ): Promise<{
    id: string;
    label: string;
    searchParameters: Record<string, unknown>;
    display: Record<string, unknown>;
    unresolved?: string[];
  }> {
    // Recruiter takes companies as keyword objects, not facet ids
    const isRecruiter = mode === 'recruiter';
    const { company: recruiterCompany, ...withoutCompany } =
      query.searchParameters;
    const toResolve = isRecruiter ? withoutCompany : query.searchParameters;

    const resolved = (await this.linkedinParameterResolver.resolveParameterIds(
      toResolve,
      accountId,
      query.id,
    )) as Record<string, unknown>;
    const { searchParameters, display } = splitLinkedinFacetDisplay({
      ...resolved,
      ...(isRecruiter && recruiterCompany !== undefined
        ? { company: recruiterCompany }
        : {}),
    });

    // A facet the resolver could not match is dropped; say which, so the
    // agent can report it instead of silently widening the search
    const unresolved = ['location', 'industry', 'company'].filter(
      (key) =>
        toResolve[key] !== undefined && searchParameters[key] === undefined,
    );

    // Classic keeps an unmatched employer as a keyword filter, as the
    // candidate search does
    const companyNames = query.searchParameters.company;
    if (
      mode === 'classic' &&
      unresolved.includes('company') &&
      Array.isArray(companyNames) &&
      typeof companyNames[0] === 'string'
    ) {
      const advancedKeywords =
        typeof searchParameters.advanced_keywords === 'object' &&
        searchParameters.advanced_keywords !== null
          ? (searchParameters.advanced_keywords as Record<string, unknown>)
          : {};
      searchParameters.advanced_keywords = {
        ...advancedKeywords,
        company: companyNames[0],
      };
    }

    return {
      id: query.id,
      label: query.label,
      searchParameters,
      display,
      ...(unresolved.length > 0 ? { unresolved } : {}),
    };
  }

  private extractSearchUrl(body: { url?: string }): string | undefined {
    return body.url?.trim() || undefined;
  }

  private assertSearchUrlCategory(
    url: string,
    expectedCategory: LinkedInSearchUrlCategory,
  ): string {
    const classified = classifyLinkedInSearchUrl(url);
    const matches =
      expectedCategory === 'people'
        ? isPeopleLinkedInSearchUrl(classified)
        : isCompanyLinkedInSearchUrl(classified);

    if (!classified || !matches) {
      throw new HttpException(
        expectedCategory === 'people'
          ? 'url must be a LinkedIn people search URL (classic /search/results/people, Sales Navigator /sales/search/people or /sales/lists/people, or Recruiter /talent/search)'
          : 'url must be a LinkedIn company search URL (classic /search/results/companies or Sales Navigator /sales/search/company)',
        HttpStatus.BAD_REQUEST,
      );
    }

    return classified.url;
  }

  /**
   * Search for people using LinkedIn Classic API
   */
  @Post('search/people')
  async searchPeople(
    @Body()
    request: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> & {
      url?: string;
    },
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );
      const searchUrl = this.extractSearchUrl(request);

      if (searchUrl) {
        const normalizedUrl = this.assertSearchUrlCategory(searchUrl, 'people');
        return await this.linkedInSearchService.searchFromUrl(
          normalizedUrl,
          resolvedAccountId,
          { cursor, limit },
        );
      }

      this.logger.log(
        `Searching for people on LinkedIn for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.searchPeopleClassic(
        request,
        resolvedAccountId,
        { cursor, limit },
      );

      this.logger.log(
        `People search completed successfully. Found ${result.items.length} results.`,
      );
      return result;
    } catch (error) {
      this.logger.error('LinkedIn people search failed', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'LinkedIn people search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Compare people search results between classic JSON endpoint and raw HTML endpoint.
   * Accepts the same body shape as classic people search (you can include api/category, they will be ignored).
   */
  @Post('search/people/compare-classic-raw')
  async comparePeopleClassicAndRaw(
    @Body()
    request: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('start') start?: number,
    @Query('workspace_id') workspaceId?: string,
    @Headers() headers?: any,
  ): Promise<{
    classic: LinkedInSearchResponse;
    raw: LinkedInSearchResponse;
    comparison: {
      classicCount: number;
      rawCount: number;
      overlapById: number;
      onlyInClassic: number;
      onlyInRaw: number;
    };
  }> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      this.logger.log(
        `Comparing LinkedIn classic vs raw people search for account: ${resolvedAccountId}`,
      );

      const result =
        await this.linkedInSearchService.comparePeopleClassicAndRaw(
          request,
          resolvedAccountId,
          { cursor, limit, start, workspaceId },
        );

      this.logger.log(
        `Comparison completed. classicCount=${result.comparison.classicCount}, rawCount=${result.comparison.rawCount}, overlapById=${result.comparison.overlapById}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        'LinkedIn classic vs raw people search comparison failed',
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message ||
          'LinkedIn classic vs raw people search comparison failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for companies using LinkedIn Classic API
   */
  @Post('search/companies')
  async searchCompanies(
    @Body()
    request: Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'> & {
      url?: string;
    },
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );
      const searchUrl = this.extractSearchUrl(request);

      if (searchUrl) {
        const normalizedUrl = this.assertSearchUrlCategory(
          searchUrl,
          'companies',
        );
        return await this.linkedInSearchService.searchFromUrl(
          normalizedUrl,
          resolvedAccountId,
          { cursor, limit },
        );
      }

      this.logger.log(
        `Searching for companies on LinkedIn for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.searchCompanies(
        request,
        resolvedAccountId,
        { cursor, limit },
      );

      this.logger.log(
        `Companies search completed successfully. Found ${result.items.length} results.`,
      );
      return result;
    } catch (error) {
      this.logger.error('LinkedIn companies search failed', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'LinkedIn companies search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for posts using LinkedIn Classic API
   */
  @Post('search/posts')
  async searchPosts(
    @Body()
    request: Omit<LinkedInClassicPostsSearchRequest, 'api' | 'category'>,
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      this.logger.log(
        `Searching for posts on LinkedIn for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.searchPosts(
        request,
        resolvedAccountId,
        { cursor, limit },
      );

      this.logger.log(
        `Posts search completed successfully. Found ${result.items.length} results.`,
      );
      return result;
    } catch (error) {
      this.logger.error('LinkedIn posts search failed', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'LinkedIn posts search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for jobs using LinkedIn Classic API
   */
  @Post('search/jobs')
  async searchJobs(
    @Body() request: Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>,
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      this.logger.log(
        `Searching for jobs on LinkedIn for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.searchJobs(
        request,
        resolvedAccountId,
        { cursor, limit },
      );

      this.logger.log(
        `Projects search completed successfully. Found ${result.items.length} results.`,
      );
      return result;
    } catch (error) {
      this.logger.error('LinkedIn jobs search failed', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'LinkedIn jobs search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for people using LinkedIn Sales Navigator API
   */
  @Post('search/sales-navigator/people')
  async searchPeopleSalesNavigator(
    @Body()
    request: Omit<
      LinkedInSalesNavigatorPeopleSearchRequest,
      'api' | 'category'
    > & {
      url?: string;
    },
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );
      const searchUrl = this.extractSearchUrl(request);

      if (searchUrl) {
        const normalizedUrl = this.assertSearchUrlCategory(searchUrl, 'people');
        return await this.linkedInSearchService.searchFromUrl(
          normalizedUrl,
          resolvedAccountId,
          { cursor, limit },
        );
      }

      this.logger.log(
        `Searching for people on LinkedIn Sales Navigator for account: ${resolvedAccountId}`,
      );

      const result =
        await this.linkedInSearchService.searchPeopleSalesNavigator(
          request,
          resolvedAccountId,
          { cursor, limit },
        );

      this.logger.log(
        `Sales Navigator people search completed successfully. Found ${result.items.length} results.`,
      );
      return result;
    } catch (error) {
      this.logger.error('LinkedIn Sales Navigator people search failed', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'LinkedIn Sales Navigator people search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for companies using LinkedIn Sales Navigator API
   */
  @Post('search/sales-navigator/companies')
  async searchCompaniesSalesNavigator(
    @Body()
    request: Omit<
      LinkedInSalesNavigatorCompaniesSearchRequest,
      'api' | 'category'
    > & {
      url?: string;
    },
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );
      const searchUrl = this.extractSearchUrl(request);

      if (searchUrl) {
        const normalizedUrl = this.assertSearchUrlCategory(
          searchUrl,
          'companies',
        );
        return await this.linkedInSearchService.searchFromUrl(
          normalizedUrl,
          resolvedAccountId,
          { cursor, limit },
        );
      }

      this.logger.log(
        `Searching for companies on LinkedIn Sales Navigator for account: ${resolvedAccountId}`,
      );

      const result =
        await this.linkedInSearchService.searchCompaniesSalesNavigator(
          request,
          resolvedAccountId,
          { cursor, limit },
        );

      this.logger.log(
        `Sales Navigator companies search completed successfully. Found ${result.items.length} results.`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        'LinkedIn Sales Navigator companies search failed',
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'LinkedIn Sales Navigator companies search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for people using LinkedIn Recruiter API
   */
  @Post('search/recruiter/people')
  async searchPeopleRecruiter(
    @Body()
    request: Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'> & {
      url?: string;
    },
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );
      const searchUrl = this.extractSearchUrl(request);

      if (searchUrl) {
        const normalizedUrl = this.assertSearchUrlCategory(searchUrl, 'people');
        return await this.linkedInSearchService.searchFromUrl(
          normalizedUrl,
          resolvedAccountId,
          { cursor, limit },
        );
      }

      this.logger.log(
        `Searching for people on LinkedIn Recruiter for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.searchPeopleRecruiter(
        request,
        resolvedAccountId,
        { cursor, limit },
      );

      this.logger.log(
        `Recruiter people search completed successfully. Found ${result.items.length} results.`,
      );
      return result;
    } catch (error) {
      this.logger.error('LinkedIn Recruiter people search failed', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'LinkedIn Recruiter people search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search using a LinkedIn URL
   */
  @Post('search/url')
  async searchFromUrl(
    @Body() body: { url: string },
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      if (!body.url) {
        throw new HttpException('URL is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(
        `Searching LinkedIn using URL for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.searchFromUrl(
        body.url,
        resolvedAccountId,
        { cursor, limit },
      );

      this.logger.log(
        `URL search completed successfully. Found ${result.items.length} results.`,
      );
      return result;
    } catch (error) {
      this.logger.error('LinkedIn URL search failed', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'LinkedIn URL search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Continue search using cursor
   */
  @Post('search/continue')
  async searchWithCursor(
    @Body() body: { cursor: string },
    @Query('account_id') accountId: string | undefined,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      if (!body.cursor) {
        throw new HttpException('Cursor is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(
        `Continuing LinkedIn search with cursor for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.searchWithCursor(
        body.cursor,
        resolvedAccountId,
        { limit },
      );

      this.logger.log(
        `Cursor search completed successfully. Found ${result.items.length} results.`,
      );
      return result;
    } catch (error) {
      this.logger.error('LinkedIn cursor search failed', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'LinkedIn cursor search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List 1st-degree LinkedIn connections for the connected account
   * (Unipile GET /api/v1/users/relations). Returns the last `limit` relations
   * sorted by created_at descending.
   */
  @Get('relations')
  async getRelations(
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('filter') filter?: string,
    @Headers() headers?: any,
  ): Promise<UnipileUserRelationsList> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      this.logger.log(
        `Listing LinkedIn relations for account: ${resolvedAccountId} (limit=${limit ?? 'default'})`,
      );

      const result = await this.linkedInSearchService.getRelations(
        resolvedAccountId,
        { cursor, limit, filter },
      );

      this.logger.log(`Retrieved ${result.items.length} LinkedIn relations.`);
      return result;
    } catch (error) {
      this.logger.error('Failed to list LinkedIn relations', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to list LinkedIn relations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get location parameters
   */
  @Get('parameters/locations')
  async getLocationParameters(
    @Query('account_id') accountId: string | undefined,
    @Query('limit') limit?: number,
    @Query('keywords') keywords?: string,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchParametersList> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      this.logger.log(
        `Getting LinkedIn location parameters for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.getLocationParameters(
        resolvedAccountId,
        keywords,
        limit,
      );

      this.logger.log(`Retrieved ${result.items.length} location parameters`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn location parameters', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to get LinkedIn location parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get industry parameters
   */
  @Get('parameters/industries')
  async getIndustryParameters(
    @Query('account_id') accountId: string | undefined,
    @Query('limit') limit?: number,
    @Query('keywords') keywords?: string,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchParametersList> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      this.logger.log(
        `Getting LinkedIn industry parameters for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.getIndustryParameters(
        resolvedAccountId,
        keywords,
        limit,
      );

      this.logger.log(`Retrieved ${result.items.length} industry parameters`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn industry parameters', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to get LinkedIn industry parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get company parameters
   */
  @Get('parameters/companies')
  async getCompanyParameters(
    @Query('account_id') accountId: string | undefined,
    @Query('limit') limit?: number,
    @Query('keywords') keywords?: string,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchParametersList> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      this.logger.log(
        `Getting LinkedIn company parameters for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.getCompanyParameters(
        resolvedAccountId,
        keywords,
        limit,
      );

      this.logger.log(`Retrieved ${result.items.length} company parameters`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn company parameters', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to get LinkedIn company parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get school parameters
   */
  @Get('parameters/schools')
  async getSchoolParameters(
    @Query('account_id') accountId: string | undefined,
    @Query('limit') limit?: number,
    @Query('keywords') keywords?: string,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchParametersList> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      this.logger.log(
        `Getting LinkedIn school parameters for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.getSchoolParameters(
        resolvedAccountId,
        keywords,
        limit,
      );

      this.logger.log(`Retrieved ${result.items.length} school parameters`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn school parameters', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to get LinkedIn school parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get job title parameters
   */
  @Get('parameters/job-titles')
  async getJobTitleParameters(
    @Query('account_id') accountId: string | undefined,
    @Query('limit') limit?: number,
    @Query('keywords') keywords?: string,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchParametersList> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      this.logger.log(
        `Getting LinkedIn job title parameters for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.getJobTitleParameters(
        resolvedAccountId,
        keywords,
        limit,
      );

      this.logger.log(`Retrieved ${result.items.length} job title parameters`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn job title parameters', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to get LinkedIn job title parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get skill parameters
   */
  @Get('parameters/skills')
  async getSkillParameters(
    @Query('account_id') accountId: string | undefined,
    @Query('limit') limit?: number,
    @Query('keywords') keywords?: string,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchParametersList> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      this.logger.log(
        `Getting LinkedIn skill parameters for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.getSkillParameters(
        resolvedAccountId,
        keywords,
        limit,
      );

      this.logger.log(`Retrieved ${result.items.length} skill parameters`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn skill parameters', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to get LinkedIn skill parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get saved searches parameters (Sales Navigator)
   */
  @Get('parameters/saved-searches')
  async getSavedSearchesParameters(
    @Query('account_id') accountId: string | undefined,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchParametersList> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      this.logger.log(
        `Getting LinkedIn saved searches parameters for account: ${resolvedAccountId}`,
      );

      const result =
        await this.linkedInSearchService.getSavedSearchesParameters(
          resolvedAccountId,
          limit,
        );

      this.logger.log(
        `Retrieved ${result.items.length} saved searches parameters`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        'Failed to get LinkedIn saved searches parameters',
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to get LinkedIn saved searches parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get recent searches parameters (Sales Navigator)
   */
  @Get('parameters/recent-searches')
  async getRecentSearchesParameters(
    @Query('account_id') accountId: string | undefined,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchParametersList> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      this.logger.log(
        `Getting LinkedIn recent searches parameters for account: ${resolvedAccountId}`,
      );

      const result =
        await this.linkedInSearchService.getRecentSearchesParameters(
          resolvedAccountId,
          limit,
        );

      this.logger.log(
        `Retrieved ${result.items.length} recent searches parameters`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        'Failed to get LinkedIn recent searches parameters',
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to get LinkedIn recent searches parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get Sales Navigator lead (people) lists for the connected account
   */
  @Get('parameters/lead-lists')
  async getLeadListsParameters(
    @Query('account_id') accountId: string | undefined,
    @Query('limit') limit?: number,
    @Query('keywords') keywords?: string,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchParametersList> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      this.logger.log(
        `Getting LinkedIn lead lists for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.getLeadListsParameters(
        resolvedAccountId,
        { keywords, limit },
      );

      this.logger.log(`Retrieved ${result.items.length} lead lists`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn lead lists', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to get LinkedIn lead lists',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get Sales Navigator account (company) lists for the connected account
   */
  @Get('parameters/account-lists')
  async getAccountListsParameters(
    @Query('account_id') accountId: string | undefined,
    @Query('limit') limit?: number,
    @Query('keywords') keywords?: string,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchParametersList> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      this.logger.log(
        `Getting LinkedIn account lists for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.getAccountListsParameters(
        resolvedAccountId,
        { keywords, limit },
      );

      this.logger.log(`Retrieved ${result.items.length} account lists`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn account lists', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to get LinkedIn account lists',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Map URL path segment values to LinkedIn API enum values.
   * Unipile API expects uppercase enum (e.g. SKILL, LOCATION), not plural path values (skills, locations).
   */
  private static readonly PARAM_TYPE_MAP: Record<
    string,
    LinkedInSearchParameterType
  > = {
    skills: 'SKILL',
    locations: 'LOCATION',
    industries: 'INDUSTRY',
    companies: 'COMPANY',
    schools: 'SCHOOL',
    'job-titles': 'JOB_TITLE',
    'saved-searches': 'SAVED_SEARCHES',
    'recent-searches': 'RECENT_SEARCHES',
    'lead-lists': 'LEAD_LISTS',
    'account-lists': 'ACCOUNT_LISTS',
  };

  /**
   * Get LinkedIn search parameters (generic fallback for types not covered by specific routes).
   * Must be declared after specific routes (locations, skills, etc.) so they take precedence.
   */
  @Get('parameters/:type')
  async getSearchParameters(
    @Param('type') type: string,
    @Query('account_id') accountId: string | undefined,
    @Query('limit') limit?: number,
    @Query('keywords') keywords?: string,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchParametersList> {
    try {
      const resolvedAccountId = await this.getAccountId(
        accountId,
        headers || {},
      );

      const apiType: LinkedInSearchParameterType =
        LinkedInSearchController.PARAM_TYPE_MAP[type] ??
        (type as LinkedInSearchParameterType);

      this.logger.log(
        `Getting LinkedIn search parameters for type: ${apiType}, account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.getSearchParameters(
        apiType,
        resolvedAccountId,
        { limit, keywords },
      );

      this.logger.log(
        `Retrieved ${result.items.length} parameters for type: ${apiType}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn search parameters', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to get LinkedIn search parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
