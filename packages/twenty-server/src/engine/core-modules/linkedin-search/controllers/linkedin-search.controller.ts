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
  Query
} from '@nestjs/common';
import { WorkspaceMemberProfileUnipileService } from '../../arx-chat/services/workspace-member-profile-unipile.service';
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

@Controller('linkedin-search')
export class LinkedInSearchController {
  private readonly logger = new Logger(LinkedInSearchController.name);

  constructor(
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
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
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const workspaceMemberId =
        await this.workspaceQueryService.getWorkspaceMemberIdFromToken(apiToken);
      const linkedinAccountId =
        await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
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
      this.logger.error(`Error getting LinkedIn account ID from token: ${error}`);
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
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Performing LinkedIn search for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.search(
        searchRequest,
        resolvedAccountId,
        { cursor, limit }
      );

      this.logger.log(`LinkedIn search completed successfully. Found ${result.items.length} results.`);
      return result;
    } catch (error) {
      this.logger.error('LinkedIn search failed', error);
      throw new HttpException(
        error.message || 'LinkedIn search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for people using LinkedIn Classic API
   */
  @Post('search/people')
  async searchPeople(
    @Body() request: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Searching for people on LinkedIn for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.searchPeopleClassic(
        request,
        resolvedAccountId,
        { cursor, limit }
      );

      this.logger.log(`People search completed successfully. Found ${result.items.length} results.`);
      return result;
    } catch (error) {
      this.logger.error('LinkedIn people search failed', error);
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
    @Body() request: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
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
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(
        `Comparing LinkedIn classic vs raw people search for account: ${resolvedAccountId}`,
      );

      const result = await this.linkedInSearchService.comparePeopleClassicAndRaw(
        request,
        resolvedAccountId,
        { cursor, limit, start, workspaceId },
      );

      this.logger.log(
        `Comparison completed. classicCount=${result.comparison.classicCount}, rawCount=${result.comparison.rawCount}, overlapById=${result.comparison.overlapById}`,
      );

      return result;
    } catch (error) {
      this.logger.error('LinkedIn classic vs raw people search comparison failed', error);
      throw new HttpException(
        error.message || 'LinkedIn classic vs raw people search comparison failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for companies using LinkedIn Classic API
   */
  @Post('search/companies')
  async searchCompanies(
    @Body() request: Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>,
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Searching for companies on LinkedIn for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.searchCompanies(
        request,
        resolvedAccountId,
        { cursor, limit }
      );

      this.logger.log(`Companies search completed successfully. Found ${result.items.length} results.`);
      return result;
    } catch (error) {
      this.logger.error('LinkedIn companies search failed', error);
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
    @Body() request: Omit<LinkedInClassicPostsSearchRequest, 'api' | 'category'>,
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Searching for posts on LinkedIn for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.searchPosts(
        request,
        resolvedAccountId,
        { cursor, limit }
      );

      this.logger.log(`Posts search completed successfully. Found ${result.items.length} results.`);
      return result;
    } catch (error) {
      this.logger.error('LinkedIn posts search failed', error);
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
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Searching for jobs on LinkedIn for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.searchJobs(
        request,
        resolvedAccountId,
        { cursor, limit }
      );

      this.logger.log(`Jobs search completed successfully. Found ${result.items.length} results.`);
      return result;
    } catch (error) {
      this.logger.error('LinkedIn jobs search failed', error);
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
    @Body() request: Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>,
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Searching for people on LinkedIn Sales Navigator for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.searchPeopleSalesNavigator(
        request,
        resolvedAccountId,
        { cursor, limit }
      );

      this.logger.log(`Sales Navigator people search completed successfully. Found ${result.items.length} results.`);
      return result;
    } catch (error) {
      this.logger.error('LinkedIn Sales Navigator people search failed', error);
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
    @Body() request: Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>,
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Searching for companies on LinkedIn Sales Navigator for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.searchCompaniesSalesNavigator(
        request,
        resolvedAccountId,
        { cursor, limit }
      );

      this.logger.log(`Sales Navigator companies search completed successfully. Found ${result.items.length} results.`);
      return result;
    } catch (error) {
      this.logger.error('LinkedIn Sales Navigator companies search failed', error);
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
    @Body() request: Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
    @Query('account_id') accountId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchResponse> {
    try {
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Searching for people on LinkedIn Recruiter for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.searchPeopleRecruiter(
        request,
        resolvedAccountId,
        { cursor, limit }
      );

      this.logger.log(`Recruiter people search completed successfully. Found ${result.items.length} results.`);
      return result;
    } catch (error) {
      this.logger.error('LinkedIn Recruiter people search failed', error);
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
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      if (!body.url) {
        throw new HttpException('URL is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Searching LinkedIn using URL for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.searchFromUrl(
        body.url,
        resolvedAccountId,
        { cursor, limit }
      );

      this.logger.log(`URL search completed successfully. Found ${result.items.length} results.`);
      return result;
    } catch (error) {
      this.logger.error('LinkedIn URL search failed', error);
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
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      if (!body.cursor) {
        throw new HttpException('Cursor is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Continuing LinkedIn search with cursor for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.searchWithCursor(
        body.cursor,
        resolvedAccountId,
        { limit }
      );

      this.logger.log(`Cursor search completed successfully. Found ${result.items.length} results.`);
      return result;
    } catch (error) {
      this.logger.error('LinkedIn cursor search failed', error);
      throw new HttpException(
        error.message || 'LinkedIn cursor search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get LinkedIn search parameters
   */
  @Get('parameters/:type')
  async getSearchParameters(
    @Param('type') type: LinkedInSearchParameterType,
    @Query('account_id') accountId: string | undefined,
    @Query('limit') limit?: number,
    @Query('keywords') keywords?: string,
    @Headers() headers?: any,
  ): Promise<LinkedInSearchParametersList> {
    try {
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Getting LinkedIn search parameters for type: ${type}, account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.getSearchParameters(
        type,
        resolvedAccountId,
        { limit, keywords }
      );

      this.logger.log(`Retrieved ${result.items.length} parameters for type: ${type}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn search parameters', error);
      throw new HttpException(
        error.message || 'Failed to get LinkedIn search parameters',
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
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Getting LinkedIn location parameters for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.getLocationParameters(
        resolvedAccountId,
        keywords,
        limit
      );

      this.logger.log(`Retrieved ${result.items.length} location parameters`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn location parameters', error);
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
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Getting LinkedIn industry parameters for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.getIndustryParameters(
        resolvedAccountId,
        keywords,
        limit
      );

      this.logger.log(`Retrieved ${result.items.length} industry parameters`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn industry parameters', error);
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
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Getting LinkedIn company parameters for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.getCompanyParameters(
        resolvedAccountId,
        keywords,
        limit
      );

      this.logger.log(`Retrieved ${result.items.length} company parameters`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn company parameters', error);
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
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Getting LinkedIn school parameters for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.getSchoolParameters(
        resolvedAccountId,
        keywords,
        limit
      );

      this.logger.log(`Retrieved ${result.items.length} school parameters`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn school parameters', error);
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
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Getting LinkedIn job title parameters for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.getJobTitleParameters(
        resolvedAccountId,
        keywords,
        limit
      );

      this.logger.log(`Retrieved ${result.items.length} job title parameters`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn job title parameters', error);
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
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Getting LinkedIn skill parameters for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.getSkillParameters(
        resolvedAccountId,
        keywords,
        limit
      );

      this.logger.log(`Retrieved ${result.items.length} skill parameters`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn skill parameters', error);
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
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Getting LinkedIn saved searches parameters for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.getSavedSearchesParameters(
        resolvedAccountId,
        limit
      );

      this.logger.log(`Retrieved ${result.items.length} saved searches parameters`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn saved searches parameters', error);
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
      const resolvedAccountId = await this.getAccountId(accountId, headers || {});

      this.logger.log(`Getting LinkedIn recent searches parameters for account: ${resolvedAccountId}`);
      
      const result = await this.linkedInSearchService.getRecentSearchesParameters(
        resolvedAccountId,
        limit
      );

      this.logger.log(`Retrieved ${result.items.length} recent searches parameters`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn recent searches parameters', error);
      throw new HttpException(
        error.message || 'Failed to get LinkedIn recent searches parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
