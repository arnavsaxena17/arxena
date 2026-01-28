import { Logger } from '@nestjs/common';
import { LinkedInClassicPeopleSearchRequest, LinkedInRawClassicPeopleSearchRequest, LinkedInRawSearchFilterState } from '../types/linkedin-search-request.type';

export class RawSearchRequestBuilder {
  private static readonly logger = new Logger(RawSearchRequestBuilder.name);

  /**
   * Build raw LinkedIn search request from classic search parameters
   */
  static buildRawRequest(
    params: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
    accountId: string,
  ): LinkedInRawClassicPeopleSearchRequest {
    // Build the LinkedIn search URL
    const searchUrl = this.buildSearchUrl(params);
    const fullRequestUrl = `https://www.linkedin.com${searchUrl}`;

    // Build requested arguments states
    const states: LinkedInRawSearchFilterState[] = [];

    // Add network distance filter (SEARCH_FILTER_network)
    // Maps: 1 -> ["S"], 2 -> ["O"], 3 -> ["O"], [1,2] -> ["S","O"]
    if (params.network_distance && params.network_distance.length > 0) {
      const networkValues = params.network_distance.map(dist => {
        if (dist === 1) return 'S';
        if (dist === 2 || dist === 3) return 'O';
        return 'O'; // Default to out of network
      });
      states.push({
        key: 'SEARCH_FILTER_network',
        namespace: 'MemoryNamespace',
        value: networkValues,
        originalProtoCase: 'stringListValue',
      });
    }

    // Add location filter (geoUrn)
    if (params.location && params.location.length > 0) {
      states.push({
        key: 'SEARCH_FILTER_geoUrn',
        namespace: 'MemoryNamespace',
        value: params.location,
        originalProtoCase: 'stringListValue',
      });
    }

    // Add current company filter
    if (params.company && params.company.length > 0) {
      states.push({
        key: 'SEARCH_FILTER_currentCompany',
        namespace: 'MemoryNamespace',
        value: params.company,
        originalProtoCase: 'stringListValue',
      });
    }

    // Add past company filter
    if (params.past_company && params.past_company.length > 0) {
      states.push({
        key: 'SEARCH_FILTER_pastCompany',
        namespace: 'MemoryNamespace',
        value: params.past_company,
        originalProtoCase: 'stringListValue',
      });
    }

    // Add industry filter
    if (params.industry && params.industry.length > 0) {
      states.push({
        key: 'SEARCH_FILTER_industry',
        namespace: 'MemoryNamespace',
        value: params.industry,
        originalProtoCase: 'stringListValue',
      });
    }

    // Add school filter
    if (params.school && params.school.length > 0) {
      states.push({
        key: 'SEARCH_FILTER_schoolFilter',
        namespace: 'MemoryNamespace',
        value: params.school,
        originalProtoCase: 'stringListValue',
      });
    }

    // Add service category filter
    if (params.service && params.service.length > 0) {
      states.push({
        key: 'SEARCH_FILTER_serviceCategory',
        namespace: 'MemoryNamespace',
        value: params.service,
        originalProtoCase: 'stringListValue',
      });
    }

    // Add profile language filter
    if (params.profile_language && params.profile_language.length > 0) {
      states.push({
        key: 'SEARCH_FILTER_profileLanguage',
        namespace: 'MemoryNamespace',
        value: params.profile_language,
        originalProtoCase: 'stringListValue',
      });
    }

    // Add connections_of filter
    if (params.connections_of && params.connections_of.length > 0) {
      states.push({
        key: 'SEARCH_FILTER_connectionOf',
        namespace: 'MemoryNamespace',
        value: params.connections_of,
        originalProtoCase: 'stringListValue',
      });
    }

    // Add followers_of filter
    if (params.followers_of && params.followers_of.length > 0) {
      states.push({
        key: 'SEARCH_FILTER_followerOf',
        namespace: 'MemoryNamespace',
        value: params.followers_of,
        originalProtoCase: 'stringListValue',
      });
    }

    // Add open_to filter (maps to SEARCH_FILTER_openToVolunteer)
    if (params.open_to && params.open_to.length > 0) {
      states.push({
        key: 'SEARCH_FILTER_openToVolunteer',
        namespace: 'MemoryNamespace',
        value: params.open_to,
        originalProtoCase: 'stringListValue',
      });
    }

    // Add advanced keywords filters (stringValue types)
    if (params.advanced_keywords) {
      // First name (stringValue)
      if (params.advanced_keywords.first_name) {
        states.push({
          key: 'SEARCH_FILTER_firstName',
          namespace: 'MemoryNamespace',
          value: params.advanced_keywords.first_name,
          originalProtoCase: 'stringValue',
        });
      }

      // Last name (stringValue)
      if (params.advanced_keywords.last_name) {
        states.push({
          key: 'SEARCH_FILTER_lastName',
          namespace: 'MemoryNamespace',
          value: params.advanced_keywords.last_name,
          originalProtoCase: 'stringValue',
        });
      }

      // Title (stringValue) - Note: This is different from the title in URL
      if (params.advanced_keywords.title) {
        states.push({
          key: 'SEARCH_FILTER_title',
          namespace: 'MemoryNamespace',
          value: params.advanced_keywords.title,
          originalProtoCase: 'stringValue',
        });
      }

      // Company (stringValue) - freetext company search
      if (params.advanced_keywords.company) {
        states.push({
          key: 'SEARCH_FILTER_company',
          namespace: 'MemoryNamespace',
          value: params.advanced_keywords.company,
          originalProtoCase: 'stringValue',
        });
      }

      // School freetext (stringValue)
      if (params.advanced_keywords.school) {
        states.push({
          key: 'SEARCH_FILTER_schoolFreetext',
          namespace: 'MemoryNamespace',
          value: params.advanced_keywords.school,
          originalProtoCase: 'stringValue',
        });
      }
    }

    // Add empty states for filters that LinkedIn expects (even if empty)
    // This ensures the request structure matches LinkedIn's expectations
    const emptyStringValueStates = [
      'SEARCH_FILTER_firstName',
      'SEARCH_FILTER_lastName',
      'SEARCH_FILTER_title',
      'SEARCH_FILTER_company',
      'SEARCH_FILTER_schoolFreetext',
    ];

    const emptyStringListValueStates = [
      'SEARCH_FILTER_activelyHiringForJobTitles',
      'SEARCH_FILTER_openToVolunteer',
      'SEARCH_FILTER_connectionOf',
      'SEARCH_FILTER_followerOf',
    ];

    // Add empty states for stringValue filters that weren't set
    for (const key of emptyStringValueStates) {
      const exists = states.some(s => s.key === key);
      if (!exists) {
        states.push({
          key,
          namespace: 'MemoryNamespace',
          value: '',
          originalProtoCase: 'stringValue',
        });
      }
    }

    // Add empty states for stringListValue filters that weren't set
    for (const key of emptyStringListValueStates) {
      const exists = states.some(s => s.key === key);
      if (!exists) {
        states.push({
          key,
          namespace: 'MemoryNamespace',
          value: [],
          originalProtoCase: 'stringListValue',
        });
      }
    }

    // Build the request body
    // Note: body.url should be the relative URL (without domain)
    // request_url should be the full URL (with domain)
    const body = {
      url: searchUrl, // Relative URL: /search/results/people/?...
      requestedArguments: {
        states: states,
      },
    };

    return {
      account_id: accountId,
      method: 'POST',
      request_url: fullRequestUrl, // Full URL: https://www.linkedin.com/search/results/people/?...
      body: body,
      encoding: false,
    };
  }

  /**
   * Build LinkedIn search URL from parameters
   */
  private static buildSearchUrl(
    params: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
  ): string {
    const urlParts: string[] = ['/search/results/people/'];
    const queryParams: string[] = [];

    // Add keywords
    if (params.keywords) {
      queryParams.push(`keywords=${encodeURIComponent(params.keywords)}`);
    }

    // Add origin
    queryParams.push('origin=FACETED_SEARCH');

    // Add network distance to URL if present
    if (params.network_distance && params.network_distance.length > 0) {
      const networkValues = params.network_distance.map(dist => {
        if (dist === 1) return 'S';
        if (dist === 2 || dist === 3) return 'O';
        return 'O';
      });
      const networkParam = networkValues.map(v => `"${v}"`).join(',');
      queryParams.push(`network=%5B${encodeURIComponent(networkParam)}%5D`);
    }

    // Add location (geoUrn) to URL if present
    if (params.location && params.location.length > 0) {
      const locationIds = params.location.map(id => `"${id}"`).join(',');
      queryParams.push(`geoUrn=%5B${encodeURIComponent(locationIds)}%5D`);
    }

    // Add title to URL if present (only from advanced_keywords.title, not from keywords)
    // Keywords and title are separate fields
    const titleQuery = this.buildTitleQuery(params);
    if (titleQuery) {
      // Title should be wrapped in quotes and URL encoded
      const quotedTitle = titleQuery.startsWith('"') && titleQuery.endsWith('"') 
        ? titleQuery 
        : `"${titleQuery}"`;
      queryParams.push(`title=${encodeURIComponent(quotedTitle)}`);
    }

    // Add current company to URL if present
    if (params.company && params.company.length > 0) {
      const companyIds = params.company.map(id => `"${id}"`).join(',');
      queryParams.push(`currentCompany=%5B${encodeURIComponent(companyIds)}%5D`);
    }

    // Add past company to URL if present
    if (params.past_company && params.past_company.length > 0) {
      const companyIds = params.past_company.map(id => `"${id}"`).join(',');
      queryParams.push(`pastCompany=%5B${encodeURIComponent(companyIds)}%5D`);
    }

    // Add industry to URL if present
    if (params.industry && params.industry.length > 0) {
      const industryIds = params.industry.map(id => `"${id}"`).join(',');
      queryParams.push(`industry=%5B${encodeURIComponent(industryIds)}%5D`);
    }

    // Add school to URL if present
    if (params.school && params.school.length > 0) {
      const schoolIds = params.school.map(id => `"${id}"`).join(',');
      queryParams.push(`schoolFilter=%5B${encodeURIComponent(schoolIds)}%5D`);
    }

    // Add service to URL if present
    if (params.service && params.service.length > 0) {
      const serviceIds = params.service.map(id => `"${id}"`).join(',');
      queryParams.push(`serviceCategory=%5B${encodeURIComponent(serviceIds)}%5D`);
    }

    // Add profile language to URL if present
    if (params.profile_language && params.profile_language.length > 0) {
      const langIds = params.profile_language.map(id => `"${id}"`).join(',');
      queryParams.push(`profileLanguage=%5B${encodeURIComponent(langIds)}%5D`);
    }

    // Add connections_of to URL if present
    if (params.connections_of && params.connections_of.length > 0) {
      const connectionIds = params.connections_of.map(id => `"${id}"`).join(',');
      queryParams.push(`connectionOf=%5B${encodeURIComponent(connectionIds)}%5D`);
    }

    // Add followers_of to URL if present
    if (params.followers_of && params.followers_of.length > 0) {
      const followerIds = params.followers_of.map(id => `"${id}"`).join(',');
      queryParams.push(`followerOf=%5B${encodeURIComponent(followerIds)}%5D`);
    }

    // Add open_to to URL if present
    if (params.open_to && params.open_to.length > 0) {
      const openToValues = params.open_to.map(v => `"${v}"`).join(',');
      queryParams.push(`openToVolunteer=%5B${encodeURIComponent(openToValues)}%5D`);
    }

    // Add advanced keywords to URL if present
    if (params.advanced_keywords) {
      if (params.advanced_keywords.first_name) {
        queryParams.push(`firstName=${encodeURIComponent(params.advanced_keywords.first_name)}`);
      }
      if (params.advanced_keywords.last_name) {
        queryParams.push(`lastName=${encodeURIComponent(params.advanced_keywords.last_name)}`);
      }
      if (params.advanced_keywords.company) {
        queryParams.push(`company=${encodeURIComponent(params.advanced_keywords.company)}`);
      }
      if (params.advanced_keywords.school) {
        queryParams.push(`schoolFreetext=${encodeURIComponent(params.advanced_keywords.school)}`);
      }
    }

    if (queryParams.length > 0) {
      urlParts.push('?');
      urlParts.push(queryParams.join('&'));
    }

    return urlParts.join('');
  }

  /**
   * Build title query from parameters
   * Title is separate from keywords - only comes from advanced_keywords.title
   */
  private static buildTitleQuery(
    params: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
  ): string | null {
    // Title only comes from advanced_keywords.title
    // Keywords are separate and should not be used for title
    if (params.advanced_keywords?.title) {
      return params.advanced_keywords.title;
    }

    return null;
  }

  /**
   * Build title query from title keywords array
   * Converts array like ["Director", "MD", "partner"] to "(Director OR MD OR partner)"
   */
  static buildTitleQueryFromKeywords(keywords: string[]): string {
    if (keywords.length === 0) {
      return '';
    }

    if (keywords.length === 1) {
      return keywords[0];
    }

    // Join with OR for multiple keywords
    return `(${keywords.join(' OR ')})`;
  }

  /**
   * Build title query with quoted phrases
   * Handles phrases like "Associate Director" that should be quoted
   */
  static buildTitleQueryWithQuotes(keywords: string[]): string {
    if (keywords.length === 0) {
      return '';
    }

    const quotedKeywords = keywords.map(kw => {
      // If keyword contains spaces, quote it
      if (kw.includes(' ')) {
        return `"${kw}"`;
      }
      return kw;
    });

    if (quotedKeywords.length === 1) {
      return quotedKeywords[0];
    }

    return `(${quotedKeywords.join(' OR ')})`;
  }
}
