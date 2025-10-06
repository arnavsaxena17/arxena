import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class LinkedInSearchService {
  private readonly logger = new Logger(LinkedInSearchService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = process.env.UNIPILE_API_URL || 'https://api1.unipile.com:13111';
    this.apiKey = process.env.UNIPILE_ACCESS_TOKEN || '';
    
    if (!this.apiKey) {
      this.logger.warn('LinkedIn Unipile API key not configured');
    }
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
    } = {}
  ): Promise<LinkedInSearchResponse> {
    try {
      const url = `${this.baseUrl}/api/v1/linkedin/search`;
      this.logger.debug('LinkedIn search URL:', url);
      this.logger.debug('Search request:', searchRequest);
      this.logger.debug('Account ID:', accountId);
      this.logger.debug('Options:', options);
      const queryParams = new URLSearchParams({
        account_id: accountId,
        ...(options.cursor && { cursor: options.cursor }),
        ...(options.limit && { limit: options.limit.toString() }),
      });

      const response = await fetch(`${url}?${queryParams}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
        },
        body: JSON.stringify(searchRequest),
      });

      if (!response.ok) {
        const errorData: LinkedInErrorResponse = await response.json();
        throw new Error(`LinkedIn search failed: ${errorData.title} - ${errorData.detail || 'Unknown error'}`);
      }

      const data: LinkedInSearchResponse = await response.json();
      this.logger.log(`LinkedIn search completed successfully. Found ${data.items.length} results.`);
      
      return data;
    } catch (error) {
      this.logger.error('LinkedIn search failed exception:', error);
      throw error;
    }
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

      const response = await fetch(`${url}?${queryParams}`, {
        method: 'GET',
        headers: {
          'X-API-KEY': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorData: LinkedInErrorResponse = await response.json();
        throw new Error(`Failed to get LinkedIn search parameters: ${errorData.title} - ${errorData.detail || 'Unknown error'}`);
      }

      const data: LinkedInSearchParametersList = await response.json();
      this.logger.log(`Retrieved ${data.items.length} LinkedIn search parameters for type: ${type}`);
      
      return data;
    } catch (error) {
      this.logger.error('Failed to get LinkedIn search parameters', error);
      throw error;
    }
  }

  /**
   * Search for people using LinkedIn Classic API
   */
  async searchPeople(
    request: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
    accountId: string,
    options: { cursor?: string; limit?: number } = {}
  ): Promise<LinkedInSearchResponse> {
    const searchRequest: LinkedInClassicPeopleSearchRequest = {
      api: 'classic',
      category: 'people',
      ...request,
    };
    this.logger.log('Searching for people with classic parameters:', searchRequest);

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
}
