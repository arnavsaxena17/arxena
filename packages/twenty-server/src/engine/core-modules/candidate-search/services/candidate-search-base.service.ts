import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { WorkspaceMemberProfileUnipileService } from '../../arx-chat/services/workspace-member-profile-unipile.service';
import { LinkedInSearchTransformerService } from '../../candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { ResumeReadParseUploadService } from '../../candidate-sourcing/services/resume-read-parse-upload.service';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { LinkedInSearchService } from '../../linkedin-search/services/linkedin-search.service';
import { LinkedInCompanySearchResult, LinkedInJobSearchResult, LinkedInPeopleSearchResult, LinkedInSearchResponse } from '../../linkedin-search/types/linkedin-search-response.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

import {
  GeneratedSearchParameters
} from '../types/candidate-search-request.type';
import {
  FileUtils,
  generateLinkedInSearchUrl,
  LinkedinParameterResolver,
  ParameterSanitizer,
} from '../utils';
import { JobDescriptionService } from './job-description.service';
// import { QuerySimplificationService } from './query-simplification.service';

@Injectable()
export class CandidateSearchBaseService {
  protected readonly logger = new Logger(CandidateSearchBaseService.name);
  private static readonly LINKEDIN_PARAMETER_TYPE_MAP: Record<string, string> = {
    LOCATION: 'LOCATION',
    locations: 'LOCATION',
    location: 'LOCATION',
    INDUSTRY: 'INDUSTRY',
    industries: 'INDUSTRY',
    industry: 'INDUSTRY',
    COMPANY: 'COMPANY',
    companies: 'COMPANY',
    company: 'COMPANY',
    SCHOOL: 'SCHOOL',
    schools: 'SCHOOL',
    school: 'SCHOOL',
    JOB_TITLE: 'JOB_TITLE',
    'job-titles': 'JOB_TITLE',
    'job-title': 'JOB_TITLE',
    SKILL: 'SKILL',
    skills: 'SKILL',
    skill: 'SKILL',
    SAVED_SEARCHES: 'SAVED_SEARCHES',
    'saved-searches': 'SAVED_SEARCHES',
    'saved-search': 'SAVED_SEARCHES',
    RECENT_SEARCHES: 'RECENT_SEARCHES',
    'recent-searches': 'RECENT_SEARCHES',
    'recent-search': 'RECENT_SEARCHES',
  };
  
  // Cache for individual parameter resolutions: Map<"parameterType:parameterName:accountId", resolvedId>
  // e.g., "company:Apollo Hospitals:account123" -> "15053"
  private readonly parameterResolutionCache = new Map<string, { id: string; title: string }>();

  constructor(
    protected readonly linkedInSearchService: LinkedInSearchService,
    protected readonly workspaceQueryService: WorkspaceQueryService,
    protected readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    protected readonly linkedinParameterResolver: LinkedinParameterResolver,
    protected readonly parameterSanitizer: ParameterSanitizer,
    protected readonly fileUtils: FileUtils,
    protected readonly linkedinSearchResultTransformer: LinkedInSearchTransformerService,
    protected readonly staticGraphQLService: StaticGraphQLService,
    protected readonly resumeReadParseUploadService: ResumeReadParseUploadService,
    protected readonly jobDescriptionService: JobDescriptionService,
    // @Optional() protected readonly querySimplificationService?: QuerySimplificationService,
  ) {}

  /**
   * Generate search parameters - to be implemented by subclasses
   */

  /**
   * Generate a cache key for an individual parameter resolution
   * Format: "parameterType:parameterName:accountId"
   */
  private generateParameterCacheKey(
    parameterType: 'company' | 'location' | 'industry' | 'school' | 'past_company' | 'service',
    parameterName: string,
    accountId: string,
  ): string {
    const cacheString = `${parameterType}:${parameterName.toLowerCase().trim()}:${accountId}`;
    return createHash('sha256').update(cacheString).digest('hex');
  }

  /**
   * Get cached resolution for an individual parameter
   */
  private getCachedParameterResolution(
    parameterType: 'company' | 'location' | 'industry' | 'school' | 'past_company' | 'service',
    parameterName: string,
    accountId: string,
  ): { id: string; title: string } | undefined {
    const cacheKey = this.generateParameterCacheKey(parameterType, parameterName, accountId);
    return this.parameterResolutionCache.get(cacheKey);
  }

  /**
   * Cache an individual parameter resolution
   */
  private cacheParameterResolution(
    parameterType: 'company' | 'location' | 'industry' | 'school' | 'past_company' | 'service',
    parameterName: string,
    accountId: string,
    resolution: { id: string; title: string },
  ): void {
    const cacheKey = this.generateParameterCacheKey(parameterType, parameterName, accountId);
    this.parameterResolutionCache.set(cacheKey, resolution);
    this.logger.debug(`Cached ${parameterType} resolution: "${parameterName}" -> "${resolution.title}" (${resolution.id})`);
  }

  /**
   * Extract and cache individual parameter resolutions from resolved parameters
   */
  private extractAndCacheParameterResolutions(
    resolvedParams: any,
    originalParams: any,
    accountId: string,
  ): void {
    // Extract company resolutions
    if (resolvedParams.company_display && originalParams.company) {
      const companyNames = Array.isArray(originalParams.company) ? originalParams.company : [];
      const companyDisplays = Array.isArray(resolvedParams.company_display) ? resolvedParams.company_display : [];
      companyNames.forEach((name: string, index: number) => {
        if (companyDisplays[index]) {
          this.cacheParameterResolution('company', name, accountId, companyDisplays[index]);
        }
      });
    }

    // Extract location resolutions
    if (resolvedParams.location_display && originalParams.location) {
      const locationNames = Array.isArray(originalParams.location) ? originalParams.location : [];
      const locationDisplays = Array.isArray(resolvedParams.location_display) ? resolvedParams.location_display : [];
      locationNames.forEach((name: string, index: number) => {
        if (locationDisplays[index]) {
          this.cacheParameterResolution('location', name, accountId, locationDisplays[index]);
        }
      });
    }

    // Extract industry resolutions
    if (resolvedParams.industry_display && originalParams.industry) {
      const industryNames = Array.isArray(originalParams.industry) ? originalParams.industry : [];
      const industryDisplays = Array.isArray(resolvedParams.industry_display) ? resolvedParams.industry_display : [];
      industryNames.forEach((name: string, index: number) => {
        if (industryDisplays[index]) {
          this.cacheParameterResolution('industry', name, accountId, industryDisplays[index]);
        }
      });
    }

    // Extract school resolutions
    if (resolvedParams.school_display && originalParams.school) {
      const schoolNames = Array.isArray(originalParams.school) ? originalParams.school : [];
      const schoolDisplays = Array.isArray(resolvedParams.school_display) ? resolvedParams.school_display : [];
      schoolNames.forEach((name: string, index: number) => {
        if (schoolDisplays[index]) {
          this.cacheParameterResolution('school', name, accountId, schoolDisplays[index]);
        }
      });
    }

    // Extract past_company resolutions
    if (resolvedParams.past_company_display && originalParams.past_company) {
      const pastCompanyNames = Array.isArray(originalParams.past_company) ? originalParams.past_company : [];
      const pastCompanyDisplays = Array.isArray(resolvedParams.past_company_display) ? resolvedParams.past_company_display : [];
      pastCompanyNames.forEach((name: string, index: number) => {
        if (pastCompanyDisplays[index]) {
          this.cacheParameterResolution('past_company', name, accountId, pastCompanyDisplays[index]);
        }
      });
    }
  }

  /**
   * Build a partially resolved parameter set from cache
   * Replaces cached parameter names with IDs, keeps uncached names for resolver
   * Returns params with cached values as IDs and uncached values as names
   */
  private buildPartiallyResolvedParameters(
    params: any,
    accountId: string,
  ): any {
    const partiallyResolved = { ...params };

    // Helper to check if a value is already an ID
    const isAlreadyId = (value: any): boolean => {
      return typeof value === 'string' && 
             (!!value.match(/^\d+$/) || value.includes('urn:li:'));
    };

    // Helper to find display info for an ID in cache
    const findDisplayForId = (id: string): { id: string; title: string } | null => {
      for (const [key, value] of this.parameterResolutionCache.entries()) {
        if (value.id === id) {
          return value;
        }
      }
      return null;
    };

    // Process company parameters
    if (params.company && Array.isArray(params.company)) {
      const companyIds: string[] = [];
      const companyDisplay: Array<{ id: string; title: string }> = [];
      const uncachedCompanies: string[] = [];
      
      for (const companyItem of params.company) {
        if (isAlreadyId(companyItem)) {
          // Already an ID - keep it and find display info
          companyIds.push(companyItem);
          const display = findDisplayForId(companyItem);
          companyDisplay.push(display || { id: companyItem, title: companyItem });
        } else {
          // Company name - check cache
          const cached = this.getCachedParameterResolution('company', companyItem, accountId);
          if (cached) {
            companyIds.push(cached.id);
            companyDisplay.push(cached);
          } else {
            uncachedCompanies.push(companyItem);
          }
        }
      }
      
      // Combine cached IDs with uncached names
      partiallyResolved.company = [...companyIds, ...uncachedCompanies];
      if (companyDisplay.length > 0) {
        partiallyResolved.company_display = companyDisplay;
      }
    }

    // Process location parameters
    if (params.location && Array.isArray(params.location)) {
      const locationIds: string[] = [];
      const locationDisplay: Array<{ id: string; title: string }> = [];
      const uncachedLocations: string[] = [];
      
      for (const locationItem of params.location) {
        if (isAlreadyId(locationItem)) {
          locationIds.push(locationItem);
          const display = findDisplayForId(locationItem);
          locationDisplay.push(display || { id: locationItem, title: locationItem });
        } else {
          const cached = this.getCachedParameterResolution('location', locationItem, accountId);
          if (cached) {
            locationIds.push(cached.id);
            locationDisplay.push(cached);
          } else {
            uncachedLocations.push(locationItem);
          }
        }
      }
      
      partiallyResolved.location = [...locationIds, ...uncachedLocations];
      if (locationDisplay.length > 0) {
        partiallyResolved.location_display = locationDisplay;
      }
    }

    // Process industry parameters
    if (params.industry && Array.isArray(params.industry)) {
      const industryIds: string[] = [];
      const industryDisplay: Array<{ id: string; title: string }> = [];
      const uncachedIndustries: string[] = [];
      
      for (const industryItem of params.industry) {
        if (isAlreadyId(industryItem)) {
          industryIds.push(industryItem);
          const display = findDisplayForId(industryItem);
          industryDisplay.push(display || { id: industryItem, title: industryItem });
        } else {
          const cached = this.getCachedParameterResolution('industry', industryItem, accountId);
          if (cached) {
            industryIds.push(cached.id);
            industryDisplay.push(cached);
          } else {
            uncachedIndustries.push(industryItem);
          }
        }
      }
      
      partiallyResolved.industry = [...industryIds, ...uncachedIndustries];
      if (industryDisplay.length > 0) {
        partiallyResolved.industry_display = industryDisplay;
      }
    }

    // Process school parameters
    if (params.school && Array.isArray(params.school)) {
      const schoolIds: string[] = [];
      const schoolDisplay: Array<{ id: string; title: string }> = [];
      const uncachedSchools: string[] = [];
      
      for (const schoolItem of params.school) {
        if (isAlreadyId(schoolItem)) {
          schoolIds.push(schoolItem);
          const display = findDisplayForId(schoolItem);
          schoolDisplay.push(display || { id: schoolItem, title: schoolItem });
        } else {
          const cached = this.getCachedParameterResolution('school', schoolItem, accountId);
          if (cached) {
            schoolIds.push(cached.id);
            schoolDisplay.push(cached);
          } else {
            uncachedSchools.push(schoolItem);
          }
        }
      }
      
      partiallyResolved.school = [...schoolIds, ...uncachedSchools];
      if (schoolDisplay.length > 0) {
        partiallyResolved.school_display = schoolDisplay;
      }
    }

    // Process past_company parameters
    if (params.past_company && Array.isArray(params.past_company)) {
      const pastCompanyIds: string[] = [];
      const pastCompanyDisplay: Array<{ id: string; title: string }> = [];
      const uncachedPastCompanies: string[] = [];
      
      for (const pastCompanyItem of params.past_company) {
        if (isAlreadyId(pastCompanyItem)) {
          pastCompanyIds.push(pastCompanyItem);
          const display = findDisplayForId(pastCompanyItem);
          pastCompanyDisplay.push(display || { id: pastCompanyItem, title: pastCompanyItem });
        } else {
          const cached = this.getCachedParameterResolution('past_company', pastCompanyItem, accountId);
          if (cached) {
            pastCompanyIds.push(cached.id);
            pastCompanyDisplay.push(cached);
          } else {
            uncachedPastCompanies.push(pastCompanyItem);
          }
        }
      }
      
      partiallyResolved.past_company = [...pastCompanyIds, ...uncachedPastCompanies];
      if (pastCompanyDisplay.length > 0) {
        partiallyResolved.past_company_display = pastCompanyDisplay;
      }
    }

    return partiallyResolved;
  }

  /**
   * Whether to use Unipile raw endpoint for classic people search.
   * Set LINKEDIN_CLASSIC_PEOPLE_USE_RAW_ENDPOINT=true to use raw (HTML) endpoint; otherwise uses standard classic API.
   */
  private shouldUseRawEndpointForClassicPeople(paramValue?: boolean): boolean {
    const envRaw = process.env.LINKEDIN_CLASSIC_PEOPLE_USE_RAW_ENDPOINT;
    if (envRaw !== undefined && envRaw !== '') {
      return envRaw === 'true' || envRaw === '1';
    }
    return paramValue === true;
  }

  /**
   * Get the property key for search parameters based on search type and category
   */
  private getSearchParameterPropertyKey(
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): keyof GeneratedSearchParameters | null {
    const keyMap: Record<string, keyof GeneratedSearchParameters> = {
      'classic_people': 'classicPeopleSearch',
      'classic_companies': 'classicCompaniesSearch',
      'classic_jobs': 'classicJobsSearch',
      'sales_navigator_people': 'salesNavigatorPeopleSearch',
      'sales_navigator_companies': 'salesNavigatorCompaniesSearch',
      'recruiter_people': 'recruiterPeopleSearch',
    };

    const key = `${searchType}_${searchCategory}`;
    return keyMap[key] || null;
  }


  /**
   * Resolve search parameters by converting parameter names to LinkedIn IDs
   * Uses cache to avoid duplicate API calls - only resolves uncached parameters
   */
  async resolveSearchParameters(
    generatedSearchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    accountId: string,
  ): Promise<GeneratedSearchParameters> {
    const resolvedSearchParameters = { ...generatedSearchParameters };
  
    // Map search type/category to property name
    const propertyKey = this.getSearchParameterPropertyKey(searchType, searchCategory);
    if (!propertyKey) {
      return resolvedSearchParameters;
    }

    const originalParams = generatedSearchParameters[propertyKey];
    if (!originalParams) {
      return resolvedSearchParameters;
    }

    // Step 1: Build partially resolved params from cache (replaces cached names with IDs)
    const partiallyResolved = this.buildPartiallyResolvedParameters(originalParams, accountId);

    // Step 2: Check if everything is already resolved (all IDs, no names left)
    const areFullyResolved = this.checkIfParametersResolved(
      { [propertyKey]: partiallyResolved },
      searchType,
      searchCategory,
    );

    // Step 3: If fully resolved, return early (no API calls needed)
    if (areFullyResolved) {
      this.logger.log(
        `All parameters resolved from cache for ${searchType} ${searchCategory} (cache size: ${this.parameterResolutionCache.size})`,
      );
      resolvedSearchParameters[propertyKey] = partiallyResolved;
      return resolvedSearchParameters;
    }

    // Step 4: Resolve only the uncached parameters (resolver will skip already-resolved IDs)
    this.logger.log(
      `Resolving uncached parameters for ${searchType} ${searchCategory} (cache size: ${this.parameterResolutionCache.size})`,
    );
    
    resolvedSearchParameters[propertyKey] = await this.linkedinParameterResolver.resolveParameterIds(
      partiallyResolved, // Contains IDs for cached params, names for uncached
      accountId,
    );

    // Step 5: Cache the newly resolved parameters
    this.extractAndCacheParameterResolutions(
      resolvedSearchParameters[propertyKey],
      originalParams,
      accountId,
    );

    return resolvedSearchParameters;
  }

  /**
   * Execute LinkedIn search with resolved parameters
   */
  async executeLinkedInSearch(
    resolvedSearchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    accountId: string,
    options?: { cursor?: string; limit?: number; start?: number },
  ): Promise<LinkedInSearchResponse | undefined> {
    const areParametersResolved = this.checkIfParametersResolved(
      resolvedSearchParameters,
      searchType,
      searchCategory,
    );
    this.logger.log(`Are parameters resolved: ${areParametersResolved}`);
    this.logger.log(`Generated searchCategory: ${searchCategory}`);
    this.logger.log(`Generated searchType: ${searchType}`);
    this.logger.log(`Options passed to LinkedIn search: ${JSON.stringify(options, null, 2)}`);
    let searchResult: LinkedInSearchResponse | undefined;
    // Handle flat format resolved parameters (when resolvedSearchParameters are sent directly)
    if (searchType === 'classic' && searchCategory === 'people' && areParametersResolved && !resolvedSearchParameters.classicPeopleSearch) {
      this.logger.log(`Searching for people with flat format resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
      const useRaw = this.shouldUseRawEndpointForClassicPeople(cleanedParams.useRawEndpoint);
      const nestedParams = {
        keywords: cleanedParams.keywords,
        industry: cleanedParams.industry,
        location: cleanedParams.location,
        profile_language: cleanedParams.profile_language,
        network_distance: cleanedParams.network_distance,
        company: cleanedParams.company,
        past_company: cleanedParams.past_company,
        school: cleanedParams.school,
        service: cleanedParams.service,
        connections_of: cleanedParams.connections_of,
        followers_of: cleanedParams.followers_of,
        open_to: cleanedParams.open_to,
        advanced_keywords: cleanedParams.advanced_keywords,
        useRawEndpoint: useRaw,
      };
      const sanitizedParams = this.parameterSanitizer.sanitizeClassicPeopleSearchRequest(nestedParams);
      searchResult = await this.linkedInSearchService.searchPeopleClassic(
        { ...sanitizedParams, useRawEndpoint: useRaw },
        accountId,
        options,
      );
      this.logger.log(
        `Search result: ${JSON.stringify(
          searchResult?.items.map(item => ({
            name: 'name' in item ? item.name : undefined,
            headline: 'headline' in item ? item.headline : undefined,
            linkedinUrl: 'profile_url' in item ? item.profile_url : undefined,
            location: 'location' in item ? item.location : undefined,

          })),
          null,
          2,
        )}`,
      );
      return searchResult;
    }

    if (searchType === 'classic' && searchCategory === 'people' && resolvedSearchParameters.classicPeopleSearch) {
      this.logger.log(`Searching for people with resolved parameters for ${searchType} ${searchCategory}`);
      this.logger.log(`Parameters before cleaning: ${JSON.stringify(resolvedSearchParameters.classicPeopleSearch, null, 2)}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters.classicPeopleSearch);
      this.logger.log(`Parameters after cleaning: ${JSON.stringify(cleanedParams, null, 2)}`);
      const linkedInUrl = generateLinkedInSearchUrl(cleanedParams, searchType, searchCategory);
      this.logger.log(`Generated LinkedIn URL: ${linkedInUrl || 'null'}`);
      const sanitizedParams = this.parameterSanitizer.sanitizeClassicPeopleSearchRequest(cleanedParams);
      this.logger.log(`Sanitized parameters for LinkedIn API: ${JSON.stringify(sanitizedParams, null, 2)}`);
      const useRaw = this.shouldUseRawEndpointForClassicPeople(resolvedSearchParameters.classicPeopleSearch.useRawEndpoint);
      const searchParamsWithFlag = {
        ...sanitizedParams,
        useRawEndpoint: useRaw,
      };
      searchResult = await this.linkedInSearchService.searchPeopleClassic(searchParamsWithFlag, accountId, options);
      this.logger.log(`Search result: ${JSON.stringify(searchResult?.items.map(item => 'name' in item ? item.name : (item as unknown as LinkedInPeopleSearchResult)?.headline), null, 2)}`);
      return searchResult;
    }


    if (searchType === 'classic' && searchCategory === 'companies' && areParametersResolved && !resolvedSearchParameters.classicCompaniesSearch) {
      this.logger.log(`Searching for companies with flat format resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
      const nestedParams = {
        keywords: cleanedParams.keywords,
        industry: cleanedParams.industry,
        location: cleanedParams.location,
        has_job_offers: cleanedParams.has_job_offers,
        headcount: cleanedParams.headcount,
        network_distance: cleanedParams.network_distance,
      };
      const sanitizedParams = this.parameterSanitizer.sanitizeClassicCompaniesSearchRequest(nestedParams);
      searchResult = await this.linkedInSearchService.searchCompanies(
        sanitizedParams,
        accountId,
        options,
      );
      this.logger.log( `Search result: ${JSON.stringify( searchResult?.items.map(item => 'name' in item ? item.name : (item as unknown as LinkedInCompanySearchResult)?.name), null, 2, )}`, );
      return searchResult;
    }

    if (searchType === 'classic' && searchCategory === 'jobs' && areParametersResolved && !resolvedSearchParameters.classicJobsSearch) {
      this.logger.log(`Searching for jobs with flat format resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
      const nestedParams = {
        keywords: cleanedParams.keywords,
        location: cleanedParams.location,
        company: cleanedParams.company,
        job_type: cleanedParams.job_type,
        experience_level: cleanedParams.experience_level,
        date_posted: cleanedParams.date_posted,
        salary: cleanedParams.salary,
        job_function: cleanedParams.job_function,
        industries: cleanedParams.industries,
        seniority_level: cleanedParams.seniority_level,
        company_size: cleanedParams.company_size,
        when_hired: cleanedParams.when_hired,
        relevance: cleanedParams.relevance,
        remote: cleanedParams.remote,
      };
      const sanitizedParams = this.parameterSanitizer.sanitizeClassicJobsSearchRequest(nestedParams);
      searchResult = await this.linkedInSearchService.searchJobs(sanitizedParams, accountId, options);
      this.logger.log(`Search result: ${JSON.stringify(searchResult?.items.map(item => 'name' in item ? item.name : (item as unknown as LinkedInJobSearchResult)?.title || (item as unknown as LinkedInJobSearchResult)?.title), null, 2)}`);
      return searchResult;
    }

    if (searchType === 'sales_navigator' && searchCategory === 'people' && areParametersResolved && !resolvedSearchParameters.salesNavigatorPeopleSearch) {
      this.logger.log(`Searching for people with Sales Navigator flat format resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
      const sanitizedParams = this.parameterSanitizer.sanitizeSalesNavigatorPeopleSearchRequest(cleanedParams);
      this.logger.log(`Sanitized Sales Navigator parameters for ${searchType} ${searchCategory}: ${JSON.stringify(sanitizedParams, null, 2)}`);
      searchResult = await this.linkedInSearchService.searchPeopleSalesNavigator(sanitizedParams, accountId, options);
      this.logger.log(`Search result: ${JSON.stringify(searchResult?.items.map(item => 'name' in item ? item.name : (item as unknown as LinkedInPeopleSearchResult)?.headline), null, 2)}`);
      return searchResult;
    }

    if (searchType === 'sales_navigator' && searchCategory === 'companies' && areParametersResolved && !resolvedSearchParameters.salesNavigatorCompaniesSearch) {
      this.logger.log(`Searching for companies with Sales Navigator flat format resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
      const sanitizedParams = this.parameterSanitizer.sanitizeSalesNavigatorCompaniesSearchRequest(cleanedParams);
      this.logger.log(`Sanitized Sales Navigator Companies parameters for ${searchType} ${searchCategory}: ${JSON.stringify(sanitizedParams, null, 2)}`);
      searchResult = await this.linkedInSearchService.searchCompaniesSalesNavigator(sanitizedParams, accountId, options);
      this.logger.log(`Search result: ${JSON.stringify(searchResult?.items.map(item => 'name' in item ? item.name : (item as unknown as LinkedInCompanySearchResult)?.name), null, 2)}`);
      return searchResult;
    }

    if (searchType === 'recruiter' && searchCategory === 'people' && areParametersResolved && !resolvedSearchParameters.recruiterPeopleSearch) {
      this.logger.log(`Searching for people with Recruiter flat format resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
      const sanitizedParams = this.parameterSanitizer.sanitizeRecruiterPeopleSearchRequest(cleanedParams);
      this.logger.log(`Sanitized Recruiter People parameters for ${searchType} ${searchCategory}: ${JSON.stringify(sanitizedParams, null, 2)}`);
      searchResult = await this.linkedInSearchService.searchPeopleRecruiter(sanitizedParams, accountId, options);
      this.logger.log(`Search result: ${JSON.stringify(searchResult?.items.map(item => 'name' in item ? item.name : (item as unknown as LinkedInPeopleSearchResult)?.headline), null, 2)}`);
      return searchResult;
    }


    if (searchType === 'classic' && searchCategory === 'companies' && resolvedSearchParameters.classicCompaniesSearch) {
      this.logger.log(`Searching for companies with resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters.classicCompaniesSearch);
      const sanitizedParams = this.parameterSanitizer.sanitizeClassicCompaniesSearchRequest(cleanedParams);
      searchResult = await this.linkedInSearchService.searchCompanies(sanitizedParams, accountId, options);
      this.logger.log(`Search result: ${JSON.stringify(searchResult?.items.map(item => 'name' in item ? item.name : (item as unknown as LinkedInCompanySearchResult)?.name), null, 2)}`);
      return searchResult;
    }

    if (searchType === 'classic' && searchCategory === 'jobs' && resolvedSearchParameters.classicJobsSearch) {
      this.logger.log(`Searching for jobs with resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters.classicJobsSearch);
      const sanitizedParams = this.parameterSanitizer.sanitizeClassicJobsSearchRequest(cleanedParams);
      searchResult = await this.linkedInSearchService.searchJobs(sanitizedParams, accountId, options);
      this.logger.log(`Search result: ${JSON.stringify(searchResult?.items.map(item => 'name' in item ? item.name : (item as unknown as LinkedInJobSearchResult)?.title), null, 2)}`);
      return searchResult;
    }

    if (searchType === 'sales_navigator' && searchCategory === 'people' && resolvedSearchParameters.salesNavigatorPeopleSearch) {
      this.logger.log(`Searching for people with sales navigator resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters.salesNavigatorPeopleSearch);
      const sanitizedParams = this.parameterSanitizer.sanitizeSalesNavigatorPeopleSearchRequest(cleanedParams);
      this.logger.log(`Sanitized Sales Navigator People parameters for ${searchType} ${searchCategory}: ${JSON.stringify(sanitizedParams, null, 2)}`);
      searchResult = await this.linkedInSearchService.searchPeopleSalesNavigator(
        sanitizedParams,
        accountId,
        options,
      );
      this.logger.log(`Search result: ${JSON.stringify(searchResult?.items.map(item => 'name' in item ? item.name : (item as unknown as LinkedInPeopleSearchResult)?.headline), null, 2)}`);
      return searchResult;
    }

    if (searchType === 'sales_navigator' && searchCategory === 'companies' && resolvedSearchParameters.salesNavigatorCompaniesSearch) {
      this.logger.log(`Searching for companies with sales navigator resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters.salesNavigatorCompaniesSearch);
      const sanitizedParams = this.parameterSanitizer.sanitizeSalesNavigatorCompaniesSearchRequest(cleanedParams);
      this.logger.log(`Sanitized Sales Navigator Companies parameters for ${searchType} ${searchCategory}: ${JSON.stringify(sanitizedParams, null, 2)}`);
      searchResult = await this.linkedInSearchService.searchCompaniesSalesNavigator(
        sanitizedParams,
        accountId,
        options,
      );
      this.logger.log(`Search result: ${JSON.stringify(searchResult?.items.map(item => 'name' in item ? item.name : (item as unknown as LinkedInCompanySearchResult)?.name), null, 2)}`);
      return searchResult;
    }

    if (searchType === 'recruiter' && searchCategory === 'people' && resolvedSearchParameters.recruiterPeopleSearch) {
      this.logger.log(`Searching for people with recruiter resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters.recruiterPeopleSearch);
      const sanitizedParams = this.parameterSanitizer.sanitizeRecruiterPeopleSearchRequest(cleanedParams);
      this.logger.log(`Sanitized Recruiter People parameters for ${searchType} ${searchCategory}: ${JSON.stringify(sanitizedParams, null, 2)}`);
      searchResult = await this.linkedInSearchService.searchPeopleRecruiter(
        sanitizedParams,
        accountId,
        options,
      );
      this.logger.log(`Search result: ${JSON.stringify(searchResult?.items.map(item => 'name' in item ? item.name : (item as unknown as LinkedInPeopleSearchResult)?.headline), null, 2)}`);
      return searchResult;
    }

    return searchResult;
  }


  /**
   * Get LinkedIn account ID from workspace member profile (with workspace fallback).
   * When UNIPILE_LINKEDIN_ACCOUNT_ID is set (e.g. for testing), returns that value instead.
   */
  async getLinkedInAccountId(apiToken: string): Promise<string> {
    const envOverride = process.env.UNIPILE_LINKEDIN_ACCOUNT_ID?.trim();
    if (envOverride) {
      this.logger.debug(
        'Using UNIPILE_LINKEDIN_ACCOUNT_ID env override for LinkedIn search',
      );
      return envOverride;
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
        throw new Error('LinkedIn account ID not found in workspace API keys');
      }

      return linkedinAccountId;
    } catch (error) {
      this.logger.error(`Error getting LinkedIn account ID: ${error}`);
      throw new Error('Failed to get LinkedIn account ID');
    }
  }

  /**
   * Fetch LinkedIn search parameters for a specific type
   */
  async fetchLinkedInParameters(
    parameterType: string,
    keywords?: string,
    limit?: number,
    apiToken?: string,
  ): Promise<any> {
    try {
      const accountId = await this.getLinkedInAccountId(apiToken || '');
      const normalizedParameterType =
        CandidateSearchBaseService.LINKEDIN_PARAMETER_TYPE_MAP[parameterType] ?? parameterType;
      
      const result = await this.linkedInSearchService.getSearchParameters(
        normalizedParameterType as any,
        accountId,
        { keywords, limit }
      );

      this.logger.log(`Fetched ${result.items.length} LinkedIn parameters for type: ${normalizedParameterType}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch LinkedIn parameters for type: ${parameterType}`, error);
      throw error;
    }
  }

  /**
   * Remove display fields from parameters to prevent API validation errors
   */
  protected removeDisplayFields(params: any): any {
    const cleaned = { ...params };
    // Remove all display fields that are added by the parameter resolver
    delete cleaned.industry_display;
    delete cleaned.location_display;
    delete cleaned.company_display;
    delete cleaned.past_company_display;
    delete cleaned.school_display;
    delete cleaned.service_display;
    
    // Remove Sales Navigator and Recruiter specific display fields
    delete cleaned.role_display;
    delete cleaned.function_display;
    delete cleaned.past_role_display;
    delete cleaned.seniority_display;
    delete cleaned.skills_display;
    delete cleaned.groups_display;
    delete cleaned.spotlights_display;
    delete cleaned.current_companies_display;
    delete cleaned.past_companies_display;
    delete cleaned.spoken_languages_display;
    delete cleaned.recruiting_activity_display;
    delete cleaned.graduation_year_range_display;
    delete cleaned.tenure_range_display;
    delete cleaned.company_headcount_display;
    delete cleaned.experience_tenure_display;
    delete cleaned.tenure_at_company_display;
    delete cleaned.tenure_at_role_display;
    delete cleaned.time_at_current_company_display;
    delete cleaned.hide_previously_viewed_display;
    
    return cleaned;
  }

  /**
   * Check if search parameters are already resolved (contain LinkedIn IDs)
   */
  protected checkIfParametersResolved(
    generatedSearchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): boolean {
    // Check if parameters are in the nested format (e.g., { classicPeopleSearch: { ... } })
    if (searchType === 'classic' && searchCategory === 'people' && generatedSearchParameters.classicPeopleSearch) {
      return this.areParametersResolved(generatedSearchParameters.classicPeopleSearch);
    } else if (searchType === 'classic' && searchCategory === 'companies' && generatedSearchParameters.classicCompaniesSearch) {
      return this.areParametersResolved(generatedSearchParameters.classicCompaniesSearch);
    } else if (searchType === 'classic' && searchCategory === 'jobs' && generatedSearchParameters.classicJobsSearch) {
      return this.areParametersResolved(generatedSearchParameters.classicJobsSearch);
    } else if (searchType === 'sales_navigator' && searchCategory === 'people' && generatedSearchParameters.salesNavigatorPeopleSearch) {
      return this.areParametersResolved(generatedSearchParameters.salesNavigatorPeopleSearch);
    } else if (searchType === 'sales_navigator' && searchCategory === 'companies' && generatedSearchParameters.salesNavigatorCompaniesSearch) {
      return this.areParametersResolved(generatedSearchParameters.salesNavigatorCompaniesSearch);
    } else if (searchType === 'recruiter' && searchCategory === 'people' && generatedSearchParameters.recruiterPeopleSearch) {
      return this.areParametersResolved(generatedSearchParameters.recruiterPeopleSearch);
    }
    
    // Check if parameters are in the flat format (directly containing resolved IDs)
    // This happens when resolvedSearchParameters are sent directly
    if (this.areParametersResolved(generatedSearchParameters)) {
      return true;
    }
    
    // If we have any meaningful parameters (even if not LinkedIn IDs), consider them resolved
    // This handles cases where frontend sends user-modified parameters with text values
    if (this.hasMeaningfulSearchCriteria(generatedSearchParameters, searchType, searchCategory)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if search parameters contain meaningful search criteria (even if not LinkedIn IDs)
   * This handles cases where frontend sends user-modified parameters with text values
   */
  private hasMeaningfulSearchCriteria(
    generatedSearchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): boolean {
    let params: any = null;
    
    // Get the appropriate parameters based on search type and category
    if (searchType === 'classic' && searchCategory === 'people' && generatedSearchParameters.classicPeopleSearch) {
      params = generatedSearchParameters.classicPeopleSearch;
    } else if (searchType === 'classic' && searchCategory === 'companies' && generatedSearchParameters.classicCompaniesSearch) {
      params = generatedSearchParameters.classicCompaniesSearch;
    } else if (searchType === 'classic' && searchCategory === 'jobs' && generatedSearchParameters.classicJobsSearch) {
      params = generatedSearchParameters.classicJobsSearch;
    } else if (searchType === 'sales_navigator' && searchCategory === 'people' && generatedSearchParameters.salesNavigatorPeopleSearch) {
      params = generatedSearchParameters.salesNavigatorPeopleSearch;
    } else if (searchType === 'sales_navigator' && searchCategory === 'companies' && generatedSearchParameters.salesNavigatorCompaniesSearch) {
      params = generatedSearchParameters.salesNavigatorCompaniesSearch;
    } else if (searchType === 'recruiter' && searchCategory === 'people' && generatedSearchParameters.recruiterPeopleSearch) {
      params = generatedSearchParameters.recruiterPeopleSearch;
    }
    
    if (!params) return false;
    
    // Check for meaningful search criteria
    return this.checkHasMeaningfulCriteria(params);
  }

  /**
   * Check if parameters contain meaningful search criteria
   */
  private checkHasMeaningfulCriteria(params: any): boolean {
    // Check for keywords (can be string or array)
    if (params.keywords) {
      if (typeof params.keywords === 'string' && params.keywords.trim().length > 0) {
        return true;
      }
      if (Array.isArray(params.keywords) && params.keywords.length > 0) {
        return true;
      }
    }
    
    // Check for other text-based parameters that don't need LinkedIn IDs
    if (params.profile_language && Array.isArray(params.profile_language) && params.profile_language.length > 0) {
      return true;
    }
    if (params.network_distance && Array.isArray(params.network_distance) && params.network_distance.length > 0) {
      return true;
    }
    
    // Check for Sales Navigator specific meaningful criteria
    if (params.role && (params.role.include?.length > 0 || params.role.exclude?.length > 0)) {
      return true;
    }
    if (params.function && (params.function.include?.length > 0 || params.function.exclude?.length > 0)) {
      return true;
    }
    if (params.past_role && (params.past_role.include?.length > 0 || params.past_role.exclude?.length > 0)) {
      return true;
    }
    
    // Check for boolean parameters that indicate meaningful search criteria
    if (params.changed_jobs === true || params.past_colleague === true || 
        params.past_applicants === true || params.messaged_recently === true ||
        params.posted_on_linkedin === true || params.shared_experiences === true ||
        params.include_saved_leads === true || params.military_background === true ||
        params.following_your_company === true || params.include_saved_accounts === true ||
        params.viewed_profile_recently === true || params.viewed_your_profile_recently === true) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if a specific parameter object contains resolved LinkedIn IDs or meaningful search criteria
   */
  private areParametersResolved(params: any): boolean {
    if (!params) return false;
    
    // Check if any parameter arrays contain LinkedIn IDs (typically numeric strings)
    const checkArray = (arr: any[]): boolean => {
      if (!Array.isArray(arr) || arr.length === 0) return false;
      return arr.some(item => 
        typeof item === 'string' && 
        (item.match(/^\d+$/) || item.includes('urn:li:'))
      );
    };
    
    // Check if arrays contain unresolved string values (non-numeric company/industry names)
    const hasUnresolvedStrings = (arr: any[]): boolean => {
      if (!Array.isArray(arr) || arr.length === 0) return false;
      return arr.some(item => 
        typeof item === 'string' && 
        !item.match(/^\d+$/) && 
        !item.includes('urn:li:')
      );
    };
    
    // FIRST: Check for Classic search parameters - if they exist, verify they're resolved
    // If we have company/industry/etc arrays with string names (not IDs), they need resolution
    if (params.industry || params.location || params.company || params.past_company || params.school) {
      // If any array has unresolved string values, parameters are NOT resolved
      if (hasUnresolvedStrings(params.industry) || 
          hasUnresolvedStrings(params.location) || 
          hasUnresolvedStrings(params.company) || 
          hasUnresolvedStrings(params.past_company) ||
          hasUnresolvedStrings(params.school)) {
        return false;
      }
      // If arrays exist and all values are numeric IDs, parameters are resolved
      return checkArray(params.industry) || 
             checkArray(params.location) || 
             checkArray(params.company) || 
             checkArray(params.past_company) ||
             checkArray(params.school);
    }
    
    // Check for Sales Navigator parameters (different structure)
    if (params.location?.include || params.industry?.include || params.company?.include || 
        params.past_company?.include || params.school?.include) {
      // Check for unresolved strings first
      if (hasUnresolvedStrings(params.location?.include) ||
          hasUnresolvedStrings(params.industry?.include) ||
          hasUnresolvedStrings(params.company?.include) ||
          hasUnresolvedStrings(params.past_company?.include) ||
          hasUnresolvedStrings(params.school?.include)) {
        return false;
      }
      return checkArray(params.location?.include) ||
             checkArray(params.industry?.include) ||
             checkArray(params.company?.include) ||
             checkArray(params.past_company?.include) ||
             checkArray(params.school?.include);
    }
    
    // Check for Recruiter parameters (similar to Sales Navigator)
    if (params.location?.include || params.industry?.include || params.company?.include || 
        params.past_company?.include || params.school?.include) {
      // Check for unresolved strings first
      if (hasUnresolvedStrings(params.location?.include) ||
          hasUnresolvedStrings(params.industry?.include) ||
          hasUnresolvedStrings(params.company?.include) ||
          hasUnresolvedStrings(params.past_company?.include) ||
          hasUnresolvedStrings(params.school?.include)) {
        return false;
      }
      return checkArray(params.location?.include) ||
             checkArray(params.industry?.include) ||
             checkArray(params.company?.include) ||
             checkArray(params.past_company?.include) ||
             checkArray(params.school?.include);
    }
    
    // If no company/industry/etc parameters exist, check for meaningful search criteria
    // (e.g., keywords-only searches don't need resolution)
    if (this.checkHasMeaningfulCriteria(params)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if this search should use location fallback strategy
   * Only applies to classic people searches with location + company + quoted keywords
   */
  private shouldUseLocationFallback(
    resolvedSearchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): boolean {
    // Only for classic people searches
    if (searchType !== 'classic' || searchCategory !== 'people') {
      return false;
    }

    const classicParams = resolvedSearchParameters.classicPeopleSearch;
    if (!classicParams) {
      return false;
    }

    // Check if we have location filter
    const hasLocation = !!(classicParams.location && 
                       Array.isArray(classicParams.location) && 
                       classicParams.location.length > 0);

    // Check if we have company filter
    const hasCompany = !!(classicParams.company && 
                      Array.isArray(classicParams.company) && 
                      classicParams.company.length > 0);

    // Check if keywords contain quoted phrases (indicating exact phrase matching)
    const hasQuotedKeywords = !!(classicParams.keywords && 
                              typeof classicParams.keywords === 'string' && 
                              classicParams.keywords.includes('"'));

    // Only use fallback if all three conditions are met (the problematic combination)
    return hasLocation && hasCompany && hasQuotedKeywords;
  }

  /**
   * Create fallback parameters without location filter
   */
  private createFallbackParametersWithoutLocation(
    resolvedSearchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): GeneratedSearchParameters {
    const fallbackParams = { ...resolvedSearchParameters };

    if (searchType === 'classic' && searchCategory === 'people' && fallbackParams.classicPeopleSearch) {
      const params = { ...fallbackParams.classicPeopleSearch };
      // Remove location but keep location_display for filtering later
      delete params.location;
      fallbackParams.classicPeopleSearch = params;
      this.logger.log(`Created fallback parameters without location filter`);
    }

    return fallbackParams;
  }

  /**
   * Filter search results by location on the server side
   * Matches candidate location strings against the target location display names
   * 
   * IMPORTANT: Uses location_display (actual location names like "Mumbai, Maharashtra, India")
   * not location IDs, because we need to match against the location string in candidate profiles
   */
  private filterResultsByLocation(
    items: any[],
    targetLocationIds: string[], // Kept for reference but matching uses location_display names
    locationDisplayInfo?: Array<{ id: string; title: string }>,
  ): any[] {
    if (!targetLocationIds || targetLocationIds.length === 0) {
      return items;
    }

    // If no location display info, we can't filter (shouldn't happen, but safety check)
    if (!locationDisplayInfo || locationDisplayInfo.length === 0) {
      this.logger.warn('No location_display info provided for filtering, returning all items');
      return items;
    }

    // Get location display names for matching (these are the actual location strings to match against)
    // e.g., ["Mumbai, Maharashtra, India"] from location_display
    const targetLocationNames = locationDisplayInfo.map(loc => loc.title.toLowerCase());
    
    // Also extract city/region names from display info for fuzzy matching
    const locationKeywords: string[] = [];
    targetLocationNames.forEach(locName => {
      // Extract city name (usually first part before comma)
      const cityMatch = locName.match(/^([^,]+)/);
      if (cityMatch) {
        locationKeywords.push(cityMatch[1].trim().toLowerCase());
      }
      // Also add full location name
      locationKeywords.push(locName);
    });

    this.logger.log(`Filtering results by location. Target locations: ${targetLocationNames.join(', ')}`);

    return items.filter(item => {
      const candidateLocation = item.location;
      if (!candidateLocation || typeof candidateLocation !== 'string') {
        return false;
      }

      const candidateLocationLower = candidateLocation.toLowerCase();

      // Check for exact or partial match with any target location display name
      // e.g., candidate "Mumbai, Maharashtra, India" matches target "Mumbai, Maharashtra, India"
      // or candidate "Mumbai" matches target "Mumbai, Maharashtra, India"
      for (const targetName of targetLocationNames) {
        // Bidirectional matching: candidate location contains target OR target contains candidate location
        // This handles variations like "Mumbai, Maharashtra, India" vs "Mumbai"
        if (candidateLocationLower.includes(targetName) || targetName.includes(candidateLocationLower)) {
          return true;
        }
      }

      // Check for city/region keyword matches (for cases where full location string doesn't match)
      for (const keyword of locationKeywords) {
        if (candidateLocationLower.includes(keyword)) {
          return true;
        }
      }

      return false;
    });
  }
}
