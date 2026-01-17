import { Injectable, Logger } from '@nestjs/common';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { LinkedInSearchParameterType } from '../types/linkedin-search-parameter.type';
import {
  LinkedInClassicCompaniesSearchRequest,
  LinkedInClassicJobsSearchRequest,
  LinkedInClassicPeopleSearchRequest,
  LinkedInClassicPostsSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorCompaniesSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
  LinkedInSearchFromUrlRequest,
  LinkedInSearchRequest,
  LinkedInSearchWithCursorRequest,
} from '../types/linkedin-search-request.type';
import {
  LinkedInErrorResponse,
  LinkedInSearchParametersList,
  LinkedInSearchResponse,
} from '../types/linkedin-search-response.type';
import { LinkedInSessionTrackerService } from './linkedin-session-tracker.service';

@Injectable()
export class LinkedInSearchService {
  private readonly logger = new Logger(LinkedInSearchService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly minRequestIntervalMs: number;
  private lastRequestTimestamp = 0;
  private requestLock: Promise<void> = Promise.resolve();

  constructor(
    private readonly requestTracker: LinkedInSessionTrackerService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {
    this.baseUrl = process.env.UNIPILE_API_URL || '';
    this.apiKey = process.env.UNIPILE_ACCESS_TOKEN || '';
    
    if (!this.apiKey) {
      this.logger.warn('LinkedIn Unipile API key not configured');
    }

    // Ensure minimum 1 second delay between requests
    this.minRequestIntervalMs = Math.max(1000, Number(process.env.LINKEDIN_REQUEST_DELAY_MS ?? 1000));
  }

  /**
   * Perform LinkedIn search using the Unipile API
   */
  async search(
    searchRequest: LinkedInSearchRequest,
    accountId: string,
    options: {
      cursor?: string;
      limit?: number;
      workspaceId?: string;
    } = {}
  ): Promise<LinkedInSearchResponse> {
    try {
      // Track request if workspaceId is provided
      if (options.workspaceId) {
        const trackingResult = await this.requestTracker.trackRequest(options.workspaceId, 'search');
        
        if (!trackingResult.allowed) {
          throw new Error(trackingResult.warning || 'LinkedIn request limit exceeded');
        }
        
        if (trackingResult.warning) {
          this.logger.warn(trackingResult.warning);
        }
      }

      const url = `${this.baseUrl}/api/v1/linkedin/search`;
      this.logger.debug(
        `LinkedIn search request:
          URL: ${url}
          Account ID: ${accountId}
          Options: ${JSON.stringify(options, null, 2)}
          Search Request: ${JSON.stringify(searchRequest, null, 2)}`
      );
      const queryParams = new URLSearchParams({
        account_id: accountId,
        ...(options.cursor && { cursor: options.cursor }),
        ...(options.limit && { limit: options.limit.toString() }),
      });

      this.logger.log(`Making LinkedIn API call with URL: ${url}?${queryParams}`);
      this.logger.log(`Request body: ${JSON.stringify(searchRequest, null, 2)}`);

      return await this.searchWithRetry(url, queryParams, searchRequest);
    } catch (error) {
      this.logger.error(`LinkedIn search failed exception: ${error}`);
      throw error;
    }
  }

  /**
   * Perform search with retry logic for 503 errors
   * Uses exponential backoff: 2s, 4s, 8s, 16s
   */
  private async searchWithRetry(
    url: string,
    queryParams: URLSearchParams,
    searchRequest: LinkedInSearchRequest,
    retryCount = 0,
    maxRetries = 1
  ): Promise<LinkedInSearchResponse> {
    await this.enforceRequestSpacing();
    
    const response = await fetch(`${url}?${queryParams}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.apiKey,
      },
      body: JSON.stringify(searchRequest),
    });

    this.logger.log(`LinkedIn API response status: ${response.status}`);

    if (response.status === 503 && retryCount < maxRetries) {
      // Exponential backoff: 2^retryCount seconds (2s, 4s, 8s, 16s)
      const backoffMs = Math.min(2000 * Math.pow(2, retryCount), 16000);
      this.logger.warn(
        `Received 503 error (Service unavailable), waiting ${backoffMs / 1000}s before retry (attempt ${retryCount + 1}/${maxRetries})`
      );
      await this.delay(backoffMs);
      return this.searchWithRetry(url, queryParams, searchRequest, retryCount + 1, maxRetries);
    }

    if (!response.ok) {
      const errorData: LinkedInErrorResponse = await response.json();
      this.logger.error(`LinkedIn API error response: ${JSON.stringify(errorData, null, 2)}`);
      throw new Error(`LinkedIn search failed: ${errorData.title} - ${errorData.detail || 'Unknown error'}`);
    }

    const data: LinkedInSearchResponse = await response.json();
    this.logger.log(`LinkedIn search completed successfully. Found ${data.items.length} results.`);
    
    return data;
  }

  /**
   * Get LinkedIn search parameters for a specific type
   */
  async getSearchParameters(
    type: LinkedInSearchParameterType,
    accountId: string,
    options: {
      limit?: number;
      keywords?: string;
    } = {}
  ): Promise<LinkedInSearchParametersList> {
    try {
      const url = `${this.baseUrl}/api/v1/linkedin/search/parameters`;
      const queryParams = new URLSearchParams({
        type,
        account_id: accountId,
        ...(options.limit && { limit: options.limit.toString() }),
        ...(options.keywords && { keywords: options.keywords }),
      });
      this.logger.log(`Query params in getSearchParameters:: ${queryParams}`);
      
      return await this.getSearchParametersWithRetry(url, queryParams);
    } catch (error) {
      this.logger.error(`Failed to get LinkedIn search parameters: ${error}`);
      throw error;
    }
  }

  /**
   * Get search parameters with retry logic for 503 errors
   */
  private async getSearchParametersWithRetry(
    url: string,
    queryParams: URLSearchParams,
    retryCount = 0,
    maxRetries = 1
  ): Promise<LinkedInSearchParametersList> {
    await this.enforceRequestSpacing();
    
    const response = await fetch(`${url}?${queryParams}`, {
      method: 'GET',
      headers: { 'X-API-KEY': this.apiKey, },
    });

    if (response.status === 503 && retryCount < maxRetries) {
      this.logger.warn(`Received 503 error when getting search parameters, waiting 3 seconds before retry (attempt ${retryCount + 1}/${maxRetries})`);
      await this.delay(3000);
      return this.getSearchParametersWithRetry(url, queryParams, retryCount + 1, maxRetries);
    }

    if (!response.ok) {
      const errorData: LinkedInErrorResponse = await response.json();
      throw new Error(`Failed to get LinkedIn search parameters: ${errorData.title} - ${errorData.detail || 'Unknown error'}`);
    }

    const data: LinkedInSearchParametersList = await response.json();
    this.logger.log(`Retrieved ${data.items.length} LinkedIn search parameters for type: ${queryParams.get('type')}`);
    
    return data;
  }

  /**
   * Search for people using LinkedIn Classic API
   */
  async searchPeopleClassic(
    request: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
    accountId: string,
    options: { cursor?: string; limit?: number } = {}
  ): Promise<LinkedInSearchResponse> {
    const searchRequest: LinkedInClassicPeopleSearchRequest = {
      api: 'classic',
      category: 'people',
      ...request,
    };
    return this.search(searchRequest, accountId, options);
  }

  /**
   * Search for companies using LinkedIn Classic API
   */
  async searchCompanies(
    request: Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>,
    accountId: string,
    options: { cursor?: string; limit?: number } = {}
  ): Promise<LinkedInSearchResponse> {
    this.logger.log(`Request in searchCompanies:: ${JSON.stringify(request, null, 2)}`);
    const searchRequest: LinkedInClassicCompaniesSearchRequest = {
      api: 'classic',
      category: 'companies',
      ...request,
    };

    return this.search(searchRequest, accountId, options);
  }

  /**
   * Search for posts using LinkedIn Classic API
   */
  async searchPosts(
    request: Omit<LinkedInClassicPostsSearchRequest, 'api' | 'category'>,
    accountId: string,
    options: { cursor?: string; limit?: number } = {}
  ): Promise<LinkedInSearchResponse> {
    const searchRequest: LinkedInClassicPostsSearchRequest = {
      api: 'classic',
      category: 'posts',
      ...request,
    };

    return this.search(searchRequest, accountId, options);
  }

  /**
   * Search for jobs using LinkedIn Classic API
   */
  async searchJobs(
    request: Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>,
    accountId: string,
    options: { cursor?: string; limit?: number } = {}
  ): Promise<LinkedInSearchResponse> {
    const searchRequest: LinkedInClassicJobsSearchRequest = {
      api: 'classic',
      category: 'jobs',
      ...request,
    };

    return this.search(searchRequest, accountId, options);
  }

  /**
   * Search for people using LinkedIn Sales Navigator API
   */
  async searchPeopleSalesNavigator(
    request: Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>,
    accountId: string,
    options: { cursor?: string; limit?: number } = {}
  ): Promise<LinkedInSearchResponse> {
    const searchRequest: LinkedInSalesNavigatorPeopleSearchRequest = {
      api: 'sales_navigator',
      category: 'people',
      ...request,
    };
    this.logger.log(`Request in searchCompaniesSalesNavigator:: ${JSON.stringify(request, null, 2)}`);
    return this.search(searchRequest, accountId, options);
  }

  /**
   * Search for companies using LinkedIn Sales Navigator API
   */
  async searchCompaniesSalesNavigator(
    request: Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>,
    accountId: string,
    options: { cursor?: string; limit?: number } = {}
  ): Promise<LinkedInSearchResponse> {
    const searchRequest: LinkedInSalesNavigatorCompaniesSearchRequest = {
      api: 'sales_navigator',
      category: 'companies',
      ...request,
    };
    this.logger.log(`Request in searchCompaniesSalesNavigator:: ${JSON.stringify(request, null, 2)}`);
    return this.search(searchRequest, accountId, options);
  }

  /**
   * Search for people using LinkedIn Recruiter API
   */
  async searchPeopleRecruiter(
    request: Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
    accountId: string,
    options: { cursor?: string; limit?: number } = {}
  ): Promise<LinkedInSearchResponse> {
    const searchRequest: LinkedInRecruiterPeopleSearchRequest = {
      api: 'recruiter',
      category: 'people',
      ...request,
    };
    this.logger.log(`Request in searchPeopleRecruiter:: ${JSON.stringify(searchRequest, null, 2)}`);
    return this.search(searchRequest, accountId, options);
  }

  /**
   * Search using a LinkedIn URL
   */
  async searchFromUrl(
    url: string,
    accountId: string,
    options: { cursor?: string; limit?: number } = {}
  ): Promise<LinkedInSearchResponse> {
    const searchRequest: LinkedInSearchFromUrlRequest = { url };
    this.logger.log(`Request in searchFromUrl:: ${JSON.stringify(searchRequest, null, 2)}`);
    return this.search(searchRequest, accountId, options);
  }

  /**
   * Continue search using cursor
   */
  async searchWithCursor(
    cursor: string,
    accountId: string,
    options: { limit?: number } = {}
  ): Promise<LinkedInSearchResponse> {
    const searchRequest: LinkedInSearchWithCursorRequest = { cursor };
    return this.search(searchRequest, accountId, options);
  }

  /**
   * Get location parameters for search
   */
  async getLocationParameters(
    accountId: string,
    keywords?: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('LOCATION', accountId, { keywords, limit });
  }

  /**
   * Get industry parameters for search
   */
  async getIndustryParameters(
    accountId: string,
    keywords?: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('INDUSTRY', accountId, { keywords, limit });
  }

  /**
   * Get company parameters for search
   */
  async getCompanyParameters(
    accountId: string,
    keywords?: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('COMPANY', accountId, { keywords, limit });
  }

  /**
   * Get school parameters for search
   */
  async getSchoolParameters(
    accountId: string,
    keywords?: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('SCHOOL', accountId, { keywords, limit });
  }

  /**
   * Get job title parameters for search
   */
  async getJobTitleParameters(
    accountId: string,
    keywords?: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('JOB_TITLE', accountId, { keywords, limit });
  }

  /**
   * Get skill parameters for search
   */
  async getSkillParameters(
    accountId: string,
    keywords?: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('SKILL', accountId, { keywords, limit });
  }

  /**
   * Get people parameters for search
   */
  async getPeopleParameters(
    accountId: string,
    keywords?: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('PEOPLE', accountId, { keywords, limit });
  }

  /**
   * Get connections parameters for search
   */
  async getConnectionsParameters(
    accountId: string,
    keywords?: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('CONNECTIONS', accountId, { keywords, limit });
  }

  /**
   * Get saved searches parameters for Sales Navigator
   */
  async getSavedSearchesParameters(
    accountId: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('SAVED_SEARCHES', accountId, { limit });
  }

  /**
   * Get recent searches parameters for Sales Navigator
   */
  async getRecentSearchesParameters(
    accountId: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('RECENT_SEARCHES', accountId, { limit });
  }

  /**
   * Get groups parameters for search
   */
  async getGroupsParameters(
    accountId: string,
    keywords?: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('GROUPS', accountId, { keywords, limit });
  }

  /**
   * Get department parameters for Sales Navigator
   */
  async getDepartmentParameters(
    accountId: string,
    keywords?: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('DEPARTMENT', accountId, { keywords, limit });
  }

  /**
   * Get persona parameters for Sales Navigator
   */
  async getPersonaParameters(
    accountId: string,
    keywords?: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('PERSONA', accountId, { keywords, limit });
  }

  /**
   * Get technologies parameters for Sales Navigator
   */
  async getTechnologiesParameters(
    accountId: string,
    keywords?: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('TECHNOLOGIES', accountId, { keywords, limit });
  }

  /**
   * Get postal code parameters for Sales Navigator
   */
  async getPostalCodeParameters(
    accountId: string,
    keywords?: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('POSTAL_CODE', accountId, { keywords, limit });
  }

  /**
   * Get hiring projects parameters for Recruiter
   */
  async getHiringProjectsParameters(
    accountId: string,
    keywords?: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('HIRING_PROJECTS', accountId, { keywords, limit });
  }

  /**
   * Get saved filters parameters for Recruiter
   */
  async getSavedFiltersParameters(
    accountId: string,
    keywords?: string,
    limit?: number
  ): Promise<LinkedInSearchParametersList> {
    return this.getSearchParameters('SAVED_FILTERS', accountId, { keywords, limit });
  }

  private async enforceRequestSpacing(): Promise<void> {
    const schedule = async (): Promise<void> => {
      const now = Date.now();
      const elapsed = now - this.lastRequestTimestamp;

      if (elapsed < this.minRequestIntervalMs) {
        await this.delay(this.minRequestIntervalMs - elapsed);
      }

      this.lastRequestTimestamp = Date.now();
    };

    this.requestLock = this.requestLock.then(schedule, schedule);
    await this.requestLock;
  }

  private delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return Promise.resolve();
    }

    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
