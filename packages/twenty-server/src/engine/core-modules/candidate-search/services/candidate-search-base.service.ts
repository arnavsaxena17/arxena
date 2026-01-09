import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { LinkedInSearchTransformerService, TransformedCandidateForTable } from '../../candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { ResumeReaderService } from '../../candidate-sourcing/services/resume-reader.service';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { LinkedInSearchService } from '../../linkedin-search/services/linkedin-search.service';
import { LinkedInSearchResponse } from '../../linkedin-search/types/linkedin-search-response.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

import {
  CandidateSearchResponse,
  GeneratedSearchParameters,
  ParsedJobDescription,
  QueryUnderstanding,
} from '../types/candidate-search-request.type';
import {
  FileUtils,
  LinkedinParameterResolver,
  ParameterSanitizer,
} from '../utils';
import { JobDescriptionService } from './job-description.service';
import { QuerySimplificationService } from './query-simplification.service';

@Injectable()
export class CandidateSearchBaseService {
  protected readonly logger = new Logger(CandidateSearchBaseService.name);
  
  // Cache for resolved search parameters to avoid redundant API calls during retries
  private readonly resolvedParametersCache = new Map<string, GeneratedSearchParameters>();

  constructor(
    protected readonly linkedInSearchService: LinkedInSearchService,
    protected readonly workspaceQueryService: WorkspaceQueryService,
    protected readonly linkedinParameterResolver: LinkedinParameterResolver,
    protected readonly parameterSanitizer: ParameterSanitizer,
    protected readonly fileUtils: FileUtils,
    protected readonly linkedinSearchResultTransformer: LinkedInSearchTransformerService,
    protected readonly staticGraphQLService: StaticGraphQLService,
    protected readonly resumeReaderService: ResumeReaderService,
    protected readonly jobDescriptionService: JobDescriptionService,
    @Optional() protected readonly querySimplificationService?: QuerySimplificationService,
  ) {}

  /**
   * Perform complete candidate search
   */
  // async searchCandidates(
  //   request: CandidateSearchRequest,
  //   apiToken: string,
  // ): Promise<CandidateSearchResponse> {
  //   const startTime = Date.now();
    
  //   try {
  //     this.logger.log(`Starting candidate search for ${request.searchType} ${request.searchCategory}`);
  //     this.logger.log(`Request: ${JSON.stringify(request, null, 2)}`);

  //     // Get LinkedIn account ID from workspace
  //     const accountId = request?.accountId ? request.accountId : await this.getLinkedInAccountId(apiToken);
  //     this.logger.log(`Account ID: ${accountId}`);
  //     // Parse job description
  //     const parsedJobDescription = await this.jobDescriptionService.parseJobDescription(
  //       {
  //         jobDescription: request.jobDescription,
  //         jobTitle: request.jobTitle,
  //         company: request.company,
  //         location: request.location,
  //         industry: request.industry,
  //         filePath: request.filePath,
  //       },
  //       apiToken,
  //     );
  //     // Generate search parameters - this will be implemented by subclasses
  //     const generatedSearchParameters = await this.generateSearchParameters(
  //       parsedJobDescription,
  //       request.searchType,
  //       request.searchCategory,
  //       apiToken,
  //       (request as any).userMessage,
  //       (request as any).classificationReasoning,
  //       (request as any).jobId,
  //     );
  //     let resolvedSearchParameters = { ...generatedSearchParameters } as any;
  //     let resolvedParameters: any = {};
      
  //     if (request.searchType === 'classic' && request.searchCategory === 'people' && generatedSearchParameters.classicPeopleSearch) {
  //       resolvedParameters = await this.linkedinParameterResolver.resolveParameterIds(
  //         generatedSearchParameters.classicPeopleSearch,
  //         request.searchType,
  //         request.searchCategory,
  //         accountId,
  //       );
  //       resolvedSearchParameters.classicPeopleSearch = resolvedParameters;
  //     } else if (request.searchType === 'classic' && request.searchCategory === 'companies' && generatedSearchParameters.classicCompaniesSearch) {
  //       resolvedParameters = await this.linkedinParameterResolver.resolveParameterIds(
  //         generatedSearchParameters.classicCompaniesSearch,
  //         request.searchType,
  //         request.searchCategory,
  //         accountId,
  //       );
  //       resolvedSearchParameters.classicCompaniesSearch = resolvedParameters;
  //     } else if (request.searchType === 'classic' && request.searchCategory === 'jobs' && generatedSearchParameters.classicJobsSearch) {
  //       resolvedParameters = await this.linkedinParameterResolver.resolveParameterIds(
  //         generatedSearchParameters.classicJobsSearch,
  //         request.searchType,
  //         request.searchCategory,
  //         accountId,
  //       );
  //       resolvedSearchParameters.classicJobsSearch = resolvedParameters;
  //     }

  //     // Perform LinkedIn search
  //     let searchResults: LinkedInSearchResponse | undefined = undefined;
  //     if (request.searchType === 'classic' && request.searchCategory === 'people' && generatedSearchParameters.classicPeopleSearch) {
  //       searchResults = await this.linkedInSearchService.searchPeople(
  //         resolvedParameters,
  //         accountId,
  //         request.options,
  //       );
  //     } else if (request.searchType === 'classic' && request.searchCategory === 'companies' && generatedSearchParameters.classicCompaniesSearch) {
  //       searchResults = await this.linkedInSearchService.searchCompanies(
  //         resolvedParameters,
  //         accountId,
  //         request.options,
  //       );
  //     } else if (request.searchType === 'classic' && request.searchCategory === 'jobs' && generatedSearchParameters.classicJobsSearch) {
  //       searchResults = await this.linkedInSearchService.searchJobs(
  //         resolvedParameters,
  //         accountId,
  //         request.options,
  //       );
  //     } else if (request.searchType === 'sales_navigator' && request.searchCategory === 'people' && generatedSearchParameters.salesNavigatorPeopleSearch) {
  //       searchResults = await this.linkedInSearchService.searchPeopleSalesNavigator(
  //         generatedSearchParameters.salesNavigatorPeopleSearch,
  //         accountId,
  //         request.options,
  //       );
  //     } else if (request.searchType === 'sales_navigator' && request.searchCategory === 'companies' && generatedSearchParameters.salesNavigatorCompaniesSearch) {
  //       searchResults = await this.linkedInSearchService.searchCompaniesSalesNavigator(
  //         generatedSearchParameters.salesNavigatorCompaniesSearch,
  //         accountId,
  //         request.options,
  //       );
  //     } else if (request.searchType === 'recruiter' && request.searchCategory === 'people' && generatedSearchParameters.recruiterPeopleSearch) {
  //       searchResults = await this.linkedInSearchService.searchPeopleRecruiter(
  //         generatedSearchParameters.recruiterPeopleSearch,
  //         accountId,
  //         request.options,
  //       );
  //     }

  //     const processingTime = Date.now() - startTime;

  //     // Transform search results for DataTable if we have people results
  //     let transformedCandidates: TransformedCandidateForTable[] = [];
  //     if (searchResults?.items && request.searchCategory === 'people') {
  //       this.logger.log(`Transforming ${searchResults.items.length} LinkedIn search results for DataTable`);
  //       transformedCandidates = this.linkedinSearchResultTransformer.transformSearchResultsToTableFormat(
  //         searchResults.items,
  //         'linkedin_search_job', // Default job ID for search results
  //         `${request.searchType} ${request.searchCategory} search results`
  //       );
        
  //       // Add search metadata to candidates
  //       transformedCandidates = this.linkedinSearchResultTransformer.addMetadataToCandidates(
  //         transformedCandidates,
  //         {
  //           searchType: request.searchType,
  //           searchCategory: request.searchCategory,
  //           timestamp: new Date().toISOString(),
  //           processingTime,
  //         }
  //       );
        
  //       this.logger.log(`Transformed ${transformedCandidates.length} candidates for DataTable`);
  //     }

  //     const response: CandidateSearchResponse = {
  //       parsedJobDescription,
  //       generatedSearchParameters: resolvedSearchParameters,
  //       searchResults,
  //       transformedCandidates: transformedCandidates.length > 0 ? transformedCandidates : undefined,
  //       searchMetadata: {
  //         searchType: request.searchType,
  //         searchCategory: request.searchCategory,
  //         timestamp: new Date().toISOString(),
  //         processingTime,
  //       },
  //     };

  //     this.logger.log(`Candidate search completed in ${processingTime}ms with ${transformedCandidates.length} transformed candidates`);
  //     return response;
  //   } catch (error) {
  //     this.logger.error(`Candidate search failed: ${error}`);
  //     throw error;
  //   }
  // }

  /**
   * Generate search parameters - to be implemented by subclasses
   */

  /**
   * Generate a cache key for resolved parameters based on normalized parameters
   */
  private generateCacheKey(
    generatedSearchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    accountId: string,
  ): string {
    // Normalize parameters by removing display fields and creating a stable representation
    const normalizedParams = this.normalizeParametersForCache(generatedSearchParameters, searchType, searchCategory);
    const cacheData = {
      params: normalizedParams,
      searchType,
      searchCategory,
      accountId,
    };
    const cacheString = JSON.stringify(cacheData);
    return createHash('sha256').update(cacheString).digest('hex');
  }

  /**
   * Normalize parameters for cache key generation (remove display fields, sort arrays)
   */
  private normalizeParametersForCache(
    generatedSearchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): any {
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
    
    if (!params) {
      return null;
    }
    
    // Recursively normalize the parameters
    return this.normalizeValue(params);
  }

  /**
   * Recursively normalize a value for cache key generation
   */
  private normalizeValue(value: any): any {
    // Skip display fields
    if (value === null || value === undefined) {
      return value;
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return [...value].sort();
    }
    
    // Handle objects
    if (typeof value === 'object' && !Array.isArray(value)) {
      const normalized: any = {};
      for (const [key, val] of Object.entries(value)) {
        // Skip display fields
        if (key.endsWith('_display')) {
          continue;
        }
        normalized[key] = this.normalizeValue(val);
      }
      return normalized;
    }
    
    // Handle primitives
    return value;
  }

  /**
   * Resolve search parameters by converting parameter names to LinkedIn IDs
   */
  protected async resolveSearchParameters(
    generatedSearchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    accountId: string,
  ): Promise<GeneratedSearchParameters> {
    const areParametersResolved = this.checkIfParametersResolved(
      generatedSearchParameters,
      searchType,
      searchCategory,
    );

    if (areParametersResolved) {
      this.logger.log(`Parameters are already resolved, using them directly for ${searchType} ${searchCategory}`);
      return { ...generatedSearchParameters };
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(generatedSearchParameters, searchType, searchCategory, accountId);
    const cachedResult = this.resolvedParametersCache.get(cacheKey);
    
    if (cachedResult) {
      this.logger.log(`Using cached resolved parameters for ${searchType} ${searchCategory}`);
      return { ...cachedResult };
    }

    this.logger.log(`Parameters are not resolved, resolving parameter names to LinkedIn IDs for ${searchType} ${searchCategory}`);
    const resolvedSearchParameters = { ...generatedSearchParameters };

    if (searchType === 'classic' && searchCategory === 'people' && generatedSearchParameters.classicPeopleSearch) {
      this.logger.log(`Resolving parameters for classic people search for ${searchType} ${searchCategory}`);
      resolvedSearchParameters.classicPeopleSearch = await this.linkedinParameterResolver.resolveParameterIds(
        generatedSearchParameters.classicPeopleSearch,
        searchType,
        searchCategory,
        accountId,
      );
      // Store in cache
      this.resolvedParametersCache.set(cacheKey, { ...resolvedSearchParameters });
      this.logger.log(`Cached resolved parameters for ${searchType} ${searchCategory}`);
      return resolvedSearchParameters;
    }

    if (searchType === 'classic' && searchCategory === 'companies' && generatedSearchParameters.classicCompaniesSearch) {
      this.logger.log(`Resolving parameters for classic companies search for ${searchType} ${searchCategory}`);
      resolvedSearchParameters.classicCompaniesSearch = await this.linkedinParameterResolver.resolveParameterIds(
        generatedSearchParameters.classicCompaniesSearch,
        searchType,
        searchCategory,
        accountId,
      );
      // Store in cache
      this.resolvedParametersCache.set(cacheKey, { ...resolvedSearchParameters });
      this.logger.log(`Cached resolved parameters for ${searchType} ${searchCategory}`);
      return resolvedSearchParameters;
    }

    if (searchType === 'classic' && searchCategory === 'jobs' && generatedSearchParameters.classicJobsSearch) {
      this.logger.log(`Resolving parameters for classic jobs search for ${searchType} ${searchCategory}`);
      resolvedSearchParameters.classicJobsSearch = await this.linkedinParameterResolver.resolveParameterIds(
        generatedSearchParameters.classicJobsSearch,
        searchType,
        searchCategory,
        accountId,
      );
      // Store in cache
      this.resolvedParametersCache.set(cacheKey, { ...resolvedSearchParameters });
      this.logger.log(`Cached resolved parameters for ${searchType} ${searchCategory}`);
      return resolvedSearchParameters;
    }

    if (searchType === 'sales_navigator' && searchCategory === 'people' && generatedSearchParameters.salesNavigatorPeopleSearch) {
      this.logger.log(`Resolving parameters for sales navigator people search for ${searchType} ${searchCategory}`);
      resolvedSearchParameters.salesNavigatorPeopleSearch = await this.linkedinParameterResolver.resolveParameterIds(
        generatedSearchParameters.salesNavigatorPeopleSearch,
        searchType,
        searchCategory,
        accountId,
      );
      // Store in cache
      this.resolvedParametersCache.set(cacheKey, { ...resolvedSearchParameters });
      this.logger.log(`Cached resolved parameters for ${searchType} ${searchCategory}`);
      return resolvedSearchParameters;
    }

    if (searchType === 'sales_navigator' && searchCategory === 'companies' && generatedSearchParameters.salesNavigatorCompaniesSearch) {
      this.logger.log(`Resolving parameters for sales navigator companies search for ${searchType} ${searchCategory}`);
      resolvedSearchParameters.salesNavigatorCompaniesSearch = await this.linkedinParameterResolver.resolveParameterIds(
        generatedSearchParameters.salesNavigatorCompaniesSearch,
        searchType,
        searchCategory,
        accountId,
      );
      // Store in cache
      this.resolvedParametersCache.set(cacheKey, { ...resolvedSearchParameters });
      this.logger.log(`Cached resolved parameters for ${searchType} ${searchCategory}`);
      return resolvedSearchParameters;
    }

    if (searchType === 'recruiter' && searchCategory === 'people' && generatedSearchParameters.recruiterPeopleSearch) {
      this.logger.log(`Resolving parameters for recruiter people search for ${searchType} ${searchCategory}`);
      resolvedSearchParameters.recruiterPeopleSearch = await this.linkedinParameterResolver.resolveParameterIds(
        generatedSearchParameters.recruiterPeopleSearch,
        searchType,
        searchCategory,
        accountId,
      );
      // Store in cache
      this.resolvedParametersCache.set(cacheKey, { ...resolvedSearchParameters });
      this.logger.log(`Cached resolved parameters for ${searchType} ${searchCategory}`);
      return resolvedSearchParameters;
    }

    return resolvedSearchParameters;
  }

  /**
   * Execute LinkedIn search with resolved parameters
   */
  protected async executeLinkedInSearch(
    resolvedSearchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    accountId: string,
    options?: { cursor?: string; limit?: number },
  ): Promise<LinkedInSearchResponse | undefined> {
    const areParametersResolved = this.checkIfParametersResolved(
      resolvedSearchParameters,
      searchType,
      searchCategory,
    );

    this.logger.log(`Generated searchCategory: ${searchCategory}`);
    this.logger.log(`Generated searchType: ${searchType}`);
    this.logger.log(`Options passed to LinkedIn search: ${JSON.stringify(options, null, 2)}`);

    // Handle flat format resolved parameters (when resolvedSearchParameters are sent directly)
    if (searchType === 'classic' && searchCategory === 'people' && areParametersResolved && !resolvedSearchParameters.classicPeopleSearch) {
      this.logger.log(`Searching for people with flat format resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
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
      };
      const sanitizedParams = this.parameterSanitizer.sanitizeClassicPeopleSearchRequest(nestedParams);
      return await this.linkedInSearchService.searchPeople(sanitizedParams, accountId, options);
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
      return await this.linkedInSearchService.searchCompanies(sanitizedParams, accountId, options);
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
      return await this.linkedInSearchService.searchJobs(sanitizedParams, accountId, options);
    }

    if (searchType === 'sales_navigator' && searchCategory === 'people' && areParametersResolved && !resolvedSearchParameters.salesNavigatorPeopleSearch) {
      this.logger.log(`Searching for people with Sales Navigator flat format resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
      const sanitizedParams = this.parameterSanitizer.sanitizeSalesNavigatorPeopleSearchRequest(cleanedParams);
      this.logger.log(`Sanitized Sales Navigator parameters for ${searchType} ${searchCategory}: ${JSON.stringify(sanitizedParams, null, 2)}`);
      return await this.linkedInSearchService.searchPeopleSalesNavigator(sanitizedParams, accountId, options);
    }

    if (searchType === 'sales_navigator' && searchCategory === 'companies' && areParametersResolved && !resolvedSearchParameters.salesNavigatorCompaniesSearch) {
      this.logger.log(`Searching for companies with Sales Navigator flat format resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
      const sanitizedParams = this.parameterSanitizer.sanitizeSalesNavigatorCompaniesSearchRequest(cleanedParams);
      this.logger.log(`Sanitized Sales Navigator Companies parameters for ${searchType} ${searchCategory}: ${JSON.stringify(sanitizedParams, null, 2)}`);
      return await this.linkedInSearchService.searchCompaniesSalesNavigator(sanitizedParams, accountId, options);
    }

    if (searchType === 'recruiter' && searchCategory === 'people' && areParametersResolved && !resolvedSearchParameters.recruiterPeopleSearch) {
      this.logger.log(`Searching for people with Recruiter flat format resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
      const sanitizedParams = this.parameterSanitizer.sanitizeRecruiterPeopleSearchRequest(cleanedParams);
      this.logger.log(`Sanitized Recruiter People parameters for ${searchType} ${searchCategory}: ${JSON.stringify(sanitizedParams, null, 2)}`);
      return await this.linkedInSearchService.searchPeopleRecruiter(sanitizedParams, accountId, options);
    }

    if (searchType === 'classic' && searchCategory === 'people' && resolvedSearchParameters.classicPeopleSearch) {
      this.logger.log(`Searching for people with resolved parameters for ${searchType} ${searchCategory}`);
      this.logger.log(`Parameters before cleaning: ${JSON.stringify(resolvedSearchParameters.classicPeopleSearch, null, 2)}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters.classicPeopleSearch);
      this.logger.log(`Parameters after cleaning: ${JSON.stringify(cleanedParams, null, 2)}`);
      const sanitizedParams = this.parameterSanitizer.sanitizeClassicPeopleSearchRequest(cleanedParams);
      this.logger.log(`Sanitized parameters for LinkedIn API: ${JSON.stringify(sanitizedParams, null, 2)}`);
      return await this.linkedInSearchService.searchPeople(sanitizedParams, accountId, options);
    }

    if (searchType === 'classic' && searchCategory === 'companies' && resolvedSearchParameters.classicCompaniesSearch) {
      this.logger.log(`Searching for companies with resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters.classicCompaniesSearch);
      const sanitizedParams = this.parameterSanitizer.sanitizeClassicCompaniesSearchRequest(cleanedParams);
      return await this.linkedInSearchService.searchCompanies(sanitizedParams, accountId, options);
    }

    if (searchType === 'classic' && searchCategory === 'jobs' && resolvedSearchParameters.classicJobsSearch) {
      this.logger.log(`Searching for jobs with resolved parameters for ${searchType} ${searchCategory}`);
      const cleanedParams = this.removeDisplayFields(resolvedSearchParameters.classicJobsSearch);
      const sanitizedParams = this.parameterSanitizer.sanitizeClassicJobsSearchRequest(cleanedParams);
      return await this.linkedInSearchService.searchJobs(sanitizedParams, accountId, options);
    }

    if (searchType === 'sales_navigator' && searchCategory === 'people' && resolvedSearchParameters.salesNavigatorPeopleSearch) {
      this.logger.log(`Searching for people with sales navigator resolved parameters for ${searchType} ${searchCategory}`);
      return await this.linkedInSearchService.searchPeopleSalesNavigator(
        resolvedSearchParameters.salesNavigatorPeopleSearch,
        accountId,
        options,
      );
    }

    if (searchType === 'sales_navigator' && searchCategory === 'companies' && resolvedSearchParameters.salesNavigatorCompaniesSearch) {
      this.logger.log(`Searching for companies with sales navigator resolved parameters for ${searchType} ${searchCategory}`);
      return await this.linkedInSearchService.searchCompaniesSalesNavigator(
        resolvedSearchParameters.salesNavigatorCompaniesSearch,
        accountId,
        options,
      );
    }

    if (searchType === 'recruiter' && searchCategory === 'people' && resolvedSearchParameters.recruiterPeopleSearch) {
      this.logger.log(`Searching for people with recruiter resolved parameters for ${searchType} ${searchCategory}`);
      return await this.linkedInSearchService.searchPeopleRecruiter(
        resolvedSearchParameters.recruiterPeopleSearch,
        accountId,
        options,
      );
    }

    return undefined;
  }

  /**
   * Perform candidate search using pre-generated search parameters
   * This method skips JD parsing and parameter generation since they are provided
   */
  async searchCandidatesWithParameters(
    parsedJobDescription: ParsedJobDescription,
    generatedSearchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    options?: { cursor?: string; limit?: number },
    queryUnderstanding?: QueryUnderstanding,
    userMessage?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<CandidateSearchResponse> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Starting candidate search with pre-generated parameters for ${searchType} ${searchCategory}`);
      const accountId = await this.getLinkedInAccountId(apiToken);
      this.logger.log(`Account ID: ${accountId}`);

      let resolvedSearchParameters = await this.resolveSearchParameters(
        generatedSearchParameters,
        searchType,
        searchCategory,
        accountId,
      );

      this.logger.log(`Resolved search parameters for ${searchType} ${searchCategory}: ${JSON.stringify(resolvedSearchParameters, null, 2)}`);

      // Check if this is a classic people search that might need location fallback
      const needsLocationFallback = this.shouldUseLocationFallback(
        resolvedSearchParameters,
        searchType,
        searchCategory,
      );

      let searchResults: LinkedInSearchResponse | undefined;
      let originalLocationFilter: string[] | undefined;
      let locationDisplayInfo: Array<{ id: string; title: string }> | undefined;

      if (needsLocationFallback) {
        // Store original location filter for later filtering
        // IMPORTANT: location_display is only available in parameters BEFORE cleaning
        // It contains the actual location names (e.g., "Mumbai, Maharashtra, India") 
        // that we need to match against candidate location strings
        const classicParams = resolvedSearchParameters.classicPeopleSearch;
        if (classicParams?.location) {
          originalLocationFilter = Array.isArray(classicParams.location) 
            ? [...classicParams.location] 
            : [classicParams.location];
          // location_display is added by parameter resolver but not in base type
          // It contains { id: string, title: string }[] with actual location names
          locationDisplayInfo = (classicParams as any).location_display;
          
          this.logger.log(`Detected potentially restrictive search with location filter. Will attempt fallback if needed.`);
          this.logger.log(`Original location filter IDs: ${JSON.stringify(originalLocationFilter)}`);
          this.logger.log(`Location display info (for matching): ${JSON.stringify(locationDisplayInfo)}`);
          
          if (!locationDisplayInfo || locationDisplayInfo.length === 0) {
            this.logger.warn(`No location_display info found - location filtering may not work correctly`);
          }
        }
      }

      try {
        searchResults = await this.executeLinkedInSearch(
          resolvedSearchParameters,
          searchType,
          searchCategory,
          accountId,
          options,
        );

        // Check if we got 0 results and should try fallback
        if (needsLocationFallback && originalLocationFilter && 
            (!searchResults || !searchResults.items || searchResults.items.length === 0)) {
          this.logger.warn(`Search returned 0 results, attempting fallback without location filter`);
          
          // Retry without location filter
          const fallbackParams = this.createFallbackParametersWithoutLocation(
            resolvedSearchParameters,
            searchType,
            searchCategory,
          );
          
          searchResults = await this.executeLinkedInSearch(
            fallbackParams,
            searchType,
            searchCategory,
            accountId,
            options,
          );
          
          this.logger.log(`Fallback search returned ${searchResults?.items?.length || 0} results`);
        }
      } catch (error) {
        // Check if this is a "Content too large" error or 503 Service unavailable error
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isContentTooLarge = this.querySimplificationService?.isContentTooLargeError(error) || false;
        const isServiceError = errorMessage.includes('503') || 
                              errorMessage.includes('504') || 
                              errorMessage.includes('Service unavailable');
        
        // For both "Content too large" and 503 errors, try query simplification immediately
        // 503 errors might indicate the query is too complex for the service to handle
        if ((isContentTooLarge || isServiceError) && this.querySimplificationService) {
          const errorType = isContentTooLarge ? 'Content too large' : 'Service unavailable (503)';
          this.logger.warn(`Search failed with "${errorType}" error, attempting query simplification immediately`);
          
          sendEvent?.('status', {
            message: `Query rejected by service, simplifying parameters and retrying...`,
          });
          
          // Try query simplification with up to 3 attempts
          let lastError = error;
          const previousAttempts: any[] = [];
          let simplifiedParams: GeneratedSearchParameters | null = null;
          
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              sendEvent?.('querySimplification', {
                attempt,
                status: 'starting',
                message: `Simplifying query (attempt ${attempt}/3)...`,
              });
              
              const simplification = await this.querySimplificationService.simplifyQuery(
                attempt === 1 ? generatedSearchParameters : (simplifiedParams || generatedSearchParameters),
                searchType,
                searchCategory,
                apiToken,
                attempt,
                previousAttempts,
                queryUnderstanding,
                userMessage,
                parsedJobDescription,
                sendEvent,
              );
              
              if (!simplification) {
                this.logger.warn(`Query simplification attempt ${attempt} returned no result`);
                break;
              }
              
              previousAttempts.push(simplification);
              simplifiedParams = simplification.simplifiedParameters;
              
              this.logger.log(`Query simplification attempt ${attempt} completed: ${simplification.strategy}`);
              this.logger.log(`Modifications: ${simplification.modifications.join(', ')}`);
              
              // Re-resolve simplified parameters
              if (!simplifiedParams) {
                this.logger.warn(`Simplified parameters are null, cannot proceed`);
                break;
              }
              
              const resolvedSimplifiedParams = await this.resolveSearchParameters(
                simplifiedParams,
                searchType,
                searchCategory,
                accountId,
              );
              
              // Retry search with simplified parameters
              searchResults = await this.executeLinkedInSearch(
                resolvedSimplifiedParams,
                searchType,
                searchCategory,
                accountId,
                options,
              );
              
              this.logger.log(`Simplified search (attempt ${attempt}) succeeded with ${searchResults?.items?.length || 0} results`);
              sendEvent?.('querySimplification', {
                attempt,
                status: 'success',
                message: `Query simplified successfully using strategy: ${simplification.strategy}`,
              });
              
              // Update resolvedSearchParameters to reflect the simplified version
              resolvedSearchParameters = resolvedSimplifiedParams;
              break; // Success, exit retry loop
              
            } catch (simplificationError) {
              lastError = simplificationError;
              const simplificationErrorMessage = simplificationError instanceof Error 
                ? simplificationError.message 
                : String(simplificationError);
              
              this.logger.warn(`Query simplification attempt ${attempt} failed: ${simplificationErrorMessage}`);
              
              // If it's still "Content too large" or 503, continue to next attempt
              const isStillContentTooLarge = this.querySimplificationService.isContentTooLargeError(simplificationError);
              const isStillServiceError = this.querySimplificationService.isServiceUnavailableError(simplificationError);
              
              if ((isStillContentTooLarge || isStillServiceError) && attempt < 3) {
                continue;
              } else {
                // If it's a different error or we've exhausted attempts, break
                break;
              }
            }
          }
          
          // If all simplification attempts failed, throw the last error
          // Note: Location removal should have been tried as part of simplification strategies
          if (!searchResults) {
            this.logger.error(`All query simplification attempts failed`);
            throw lastError;
          }
        } else {
          // QuerySimplificationService not available - throw error
          // Note: Without simplification service, we cannot simplify queries
          throw error;
        }
      }

      const processingTime = Date.now() - startTime;
      // this.logger.log(`Search results for ${searchType} ${searchCategory}: ${JSON.stringify(searchResults, null, 2)}`);
      this.logger.log(`LinkedIn API returned ${searchResults?.items?.length || 0} items with cursor: ${searchResults?.cursor || 'null'}`);
      
      // If we used fallback and have results, filter by location
      if (needsLocationFallback && originalLocationFilter && searchResults?.items && searchResults.items.length > 0) {
        const filteredItems = this.filterResultsByLocation(
          searchResults.items,
          originalLocationFilter,
          locationDisplayInfo,
        );
        
        this.logger.log(`Filtered ${searchResults.items.length} results to ${filteredItems.length} matching location criteria`);
        
        // Update search results with filtered items
        searchResults = {
          ...searchResults,
          items: filteredItems,
          paging: {
            ...searchResults.paging,
            total_count: filteredItems.length,
          },
        };
      }
      
      let transformedCandidates: TransformedCandidateForTable[] = [];
      if (searchResults?.items && searchCategory === 'people') {
        this.logger.log(`Transforming ${searchResults.items.length} LinkedIn search results for DataTable`);
        transformedCandidates = this.linkedinSearchResultTransformer.transformSearchResultsToTableFormat(
          searchResults.items,
          'linkedin_search_job',
          `${searchType} ${searchCategory} search results`
        );
        
        transformedCandidates = this.linkedinSearchResultTransformer.addMetadataToCandidates(
          transformedCandidates,
          {
            searchType,
            searchCategory,
            timestamp: new Date().toISOString(),
            processingTime,
          }
        );
        
        this.logger.log(`Transformed ${transformedCandidates.length} candidates for DataTable`);
      }
      
      const response: CandidateSearchResponse = {
        parsedJobDescription,
        generatedSearchParameters,
        resolvedSearchParameters,
        searchResults,
        transformedCandidates: transformedCandidates.length > 0 ? transformedCandidates : undefined,
        searchMetadata: {
          searchType,
          searchCategory,
          timestamp: new Date().toISOString(),
          processingTime,
        },
      };
      this.logger.log(`Response for ${searchType} ${searchCategory} includes ${transformedCandidates.length} transformed candidates`);
      this.logger.log(`Candidate search with resolved parameters completed in ${processingTime}ms`);
      return response;
    } catch (error) {
      this.logger.error(`Candidate search with pre-generated parameters failed for ${searchType} ${searchCategory}: ${error}`);
      throw error;
    }
  }

  /**
   * Get LinkedIn account ID from workspace
   */
  async getLinkedInAccountId(apiToken: string): Promise<string> {
    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const linkedinAccountId = await this.workspaceQueryService.getWorkspaceApiKey(workspaceId, 'linkedin_unipile_account_id');

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
      
      const result = await this.linkedInSearchService.getSearchParameters(
        parameterType as any,
        accountId,
        { keywords, limit }
      );

      this.logger.log(`Fetched ${result.items.length} LinkedIn parameters for type: ${parameterType}`);
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

