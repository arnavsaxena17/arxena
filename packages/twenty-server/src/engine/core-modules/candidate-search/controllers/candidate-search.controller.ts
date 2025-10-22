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
  Req,
} from '@nestjs/common';
import { SearchGenerationService } from 'src/engine/core-modules/candidate-search/services/search-generation.service';
import { ChatMessageRequest, ChatMessageResponse, EnrichmentsResponse, FiltersResponse, GenerateEnrichmentsRequest, GenerateFiltersRequest, GenerateSortsRequest, SearchParametersResponse, SortsResponse } from 'src/engine/core-modules/candidate-search/types/search-plan.types';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { LinkedInSessionTrackerService } from 'src/engine/core-modules/linkedin-search/services/linkedin-session-tracker.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { graphqlToFindManySearchFilters, UpdateOneSearchFilter } from 'twenty-shared';
import { CandidateSearchService } from '../services/candidate-search.service';
import {
  CandidateSearchRequest,
  CandidateSearchResponse,
  GeneratedSearchParameters,
  JobDescriptionParseRequest,
  ParsedJobDescription,
} from '../types/candidate-search-request.type';
import { LinkedinParameterResolver } from '../utils/linkedin-parameter-resolver.util';

@Controller('candidate-search')
export class CandidateSearchController {
  private readonly logger = new Logger(CandidateSearchController.name);

  constructor(
    private readonly candidateSearchService: CandidateSearchService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly searchGenerationService: SearchGenerationService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly linkedInRequestTracker: LinkedInSessionTrackerService,
  ) {}

  /**
   * Parse job description and extract structured information
   */
  @Post('parse-job-description')
  async parseJobDescription(
    @Body() request: JobDescriptionParseRequest,
    @Req() req: any,
  ): Promise<ParsedJobDescription> {
    try {
      if (!request.jobDescription && !request.filePath) {
        throw new HttpException('Either job description or file path is required', HttpStatus.BAD_REQUEST);
      }

      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log('Parsing job description');
      
      const result = await this.candidateSearchService.parseJobDescription(
        request,
        apiToken,
      );

      this.logger.log('Job description parsed successfully');
      return result;
    } catch (error) {
      this.logger.error('Failed to parse job description in parse-job-description', error);
      throw new HttpException(
        error.message || 'Failed to parse job description',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

 
  /**
   * Perform complete candidate search (parse JD + generate parameters + search LinkedIn)
   */
  @Post('search')
  async searchCandidates(
    @Body() request: CandidateSearchRequest,
    @Req() req: any,
  ): Promise<CandidateSearchResponse> {
    try {
      if (!request.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
      }

      if (!request.searchType || !request.searchCategory) {
        throw new HttpException('Search type and category are required', HttpStatus.BAD_REQUEST);
      }

      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Performing candidate search for ${request.searchType} ${request.searchCategory}`);
      
      const result = await this.candidateSearchService.searchCandidates(
        request,
        apiToken,
      );

      this.logger.log(`Candidate search completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
      return result;
    } catch (error) {
      this.logger.error('Candidate search failed', error);
      throw new HttpException(
        error.message || 'Candidate search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for people using LinkedIn Classic API
   */
  @Post('search/classic/people')
  async searchClassicPeople(
    @Body() body: {
      jobDescription: string;
      jobTitle?: string;
      company?: string;
      location?: string;
      industry?: string;
    },
    @Req() req: any,
    @Query('account_id') accountId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<CandidateSearchResponse> {
    try {
      if (!body.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
      }

      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Searching for people using LinkedIn Classic`);
      
      // Validate and parse limit parameter
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
        throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
      }
      
      const request: CandidateSearchRequest = {
        ...body,
        searchType: 'classic',
        searchCategory: 'people',
        accountId: accountId || '', // Optional - will be retrieved from workspace if not provided
        options: { cursor, limit: parsedLimit },
      };

      const result = await this.candidateSearchService.searchCandidates(
        request,
        apiToken,
      );

      this.logger.log(`Classic people search completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
      return result;
    } catch (error) {
      this.logger.error('LinkedIn Classic people search failed', error);
      throw new HttpException(
        error.message || 'LinkedIn Classic people search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for companies using LinkedIn Classic API
   */
  @Post('search/classic/companies')
  async searchClassicCompanies(
    @Body() body: {
      jobDescription: string;
      jobTitle?: string;
      company?: string;
      location?: string;
      industry?: string;
    },
    @Req() req: any,
    @Query('account_id') accountId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<CandidateSearchResponse> {
    try {
      if (!accountId) {
        throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Searching for companies using LinkedIn Classic for account: ${accountId}`);
      
      // Validate and parse limit parameter
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
        throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
      }
      
      const request: CandidateSearchRequest = {
        ...body,
        searchType: 'classic',
        searchCategory: 'companies',
        accountId: accountId || '',
        options: { cursor, limit: parsedLimit },
      };

      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.candidateSearchService.searchCandidates(
        request,
        apiToken,
      );

      this.logger.log(`Classic companies search completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
      return result;
    } catch (error) {
      this.logger.error('LinkedIn Classic companies search failed', error);
      throw new HttpException(
        error.message || 'LinkedIn Classic companies search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for jobs using LinkedIn Classic API
   */
  @Post('search/classic/jobs')
  async searchClassicJobs(
    @Body() body: {
      jobDescription: string;
      jobTitle?: string;
      company?: string;
      location?: string;
      industry?: string;
    },
    @Req() req: any,
    @Query('account_id') accountId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<CandidateSearchResponse> {
    try {
      if (!accountId) {
        throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Searching for jobs using LinkedIn Classic for account: ${accountId}`);
      
      // Validate and parse limit parameter
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
        throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
      }
      
      const request: CandidateSearchRequest = {
        ...body,
        searchType: 'classic',
        searchCategory: 'jobs',
        accountId: accountId || '',
        options: { cursor, limit: parsedLimit },
      };

      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.candidateSearchService.searchCandidates(
        request,
        apiToken,
      );

      this.logger.log(`Classic jobs search completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
      return result;
    } catch (error) {
      this.logger.error('LinkedIn Classic jobs search failed', error);
      throw new HttpException(
        error.message || 'LinkedIn Classic jobs search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for people using LinkedIn Sales Navigator API
   */
  @Post('search/sales-navigator/people')
  async searchSalesNavigatorPeople(
    @Body() body: {
      jobDescription: string;
      jobTitle?: string;
      company?: string;
      location?: string;
      industry?: string;
    },
    @Req() req: any,
    @Query('account_id') accountId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<CandidateSearchResponse> {
    try {
      if (!accountId) {
        throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Searching for people using LinkedIn Sales Navigator for account: ${accountId}`);
      
      // Validate and parse limit parameter
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
        throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
      }
      
      const request: CandidateSearchRequest = {
        ...body,
        searchType: 'sales_navigator',
        searchCategory: 'people',
        accountId: accountId || '',
        options: { cursor, limit: parsedLimit },
      };

      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.candidateSearchService.searchCandidates(
        request,
        apiToken,
      );

      this.logger.log(`Sales Navigator people search completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
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
  async searchSalesNavigatorCompanies(
    @Body() body: {
      jobDescription: string;
      jobTitle?: string;
      company?: string;
      location?: string;
      industry?: string;
    },
    @Req() req: any,
    @Query('account_id') accountId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<CandidateSearchResponse> {
    try {
      if (!accountId) {
        throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Searching for companies using LinkedIn Sales Navigator for account: ${accountId}`);
      
      // Validate and parse limit parameter
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
        throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
      }
      
      const request: CandidateSearchRequest = {
        ...body,
        searchType: 'sales_navigator',
        searchCategory: 'companies',
        accountId: accountId || '',
        options: { cursor, limit: parsedLimit },
      };

      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.candidateSearchService.searchCandidates(
        request,
        apiToken,
      );

      this.logger.log(`Sales Navigator companies search completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
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
  async searchRecruiterPeople(
    @Body() body: {
      jobDescription: string;
      jobTitle?: string;
      company?: string;
      location?: string;
      industry?: string;
    },
    @Req() req: any,
    @Query('account_id') accountId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<CandidateSearchResponse> {
    try {
      if (!accountId) {
        throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Searching for people using LinkedIn Recruiter for account: ${accountId}`);
      
      // Validate and parse limit parameter
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
        throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
      }
      
      const request: CandidateSearchRequest = {
        ...body,
        searchType: 'recruiter',
        searchCategory: 'people',
        accountId: accountId || '',
        options: { cursor, limit: parsedLimit },
      };

      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.candidateSearchService.searchCandidates(
        request,
        apiToken,
      );

      this.logger.log(`Recruiter people search completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
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
   * Parse job description from file and perform candidate search
   */
  @Post('search/from-file')
  async searchCandidatesFromFile(
    @Body() body: {
      filePath: string;
      parsedJobDescription?: ParsedJobDescription;
      parsedJD?: any; // Full ParsedJD object from frontend
      generatedSearchParameters?: any;
      resolvedSearchParameters?: any;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
      jobDescription?: string;
      jobTitle?: string;
      company?: string;
      location?: string;
      industry?: string;
      searchParameters?: any;
      options?: any;
    },
    @Req() req: any,
    @Query('account_id') accountId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<CandidateSearchResponse> {
    try {
      if (!body.filePath && !body.resolvedSearchParameters) {
        throw new HttpException('File path or resolved search parameters are required', HttpStatus.BAD_REQUEST);
      }

      if (!body.searchType || !body.searchCategory) {
        throw new HttpException('Search type and category are required', HttpStatus.BAD_REQUEST);
      }

      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Performing candidate search from file for ${body.searchType} ${body.searchCategory}`);
      
      // Validate and parse limit parameter
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
        throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
      }

      // Check if resolved search parameters are provided in the parsedJD structure
      const resolvedParams = body.resolvedSearchParameters || 
        (body.parsedJD?.searchParameters && body.parsedJD.searchParameters.length > 0 ? 
          body.parsedJD.searchParameters[0].resolvedSearchParameters : null);

      // If resolved search parameters are provided, prefer using them directly.
      // If parsedJobDescription is missing, derive it from file to keep downstream typing consistent.
      if (resolvedParams) {
        this.logger.log('Resolved search parameters provided by client; skipping generation and resolution');
        this.logger.log('Resolved parameters:', JSON.stringify(resolvedParams, null, 2));
        
        const parsedJD = body.parsedJD;

        // Check if parsedJobDescription is already available in parsedJD
        if (parsedJD?.parsedJobDescription) {
          this.logger.log('Using parsedJobDescription from client-provided parsedJD');
          const result = await this.candidateSearchService.searchCandidatesWithParameters(
            parsedJD.parsedJobDescription,
            resolvedParams,
            body.searchType,
            body.searchCategory,
            apiToken,
            { cursor, limit: parsedLimit },
          );

          this.logger.log(`File-based candidate search with client-resolved parameters completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
          return result;
        } else if (body.filePath && body.filePath !== 'standalone_search') {
          // Fallback to parsing from file if parsedJobDescription is not available and we have a real file path
          this.logger.log('parsedJobDescription not available in parsedJD, parsing from file');
          const parsedJobDescription = await this.candidateSearchService.parseJobDescriptionFromFile(
            body.filePath,
            apiToken,
          );

          const result = await this.candidateSearchService.searchCandidatesWithParameters(
            parsedJobDescription,
            resolvedParams,
            body.searchType,
            body.searchCategory,
            apiToken,
            { cursor, limit: parsedLimit },
          );

          this.logger.log(`File-based candidate search with client-resolved parameters completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
          return result;
        } else {
          // For standalone searches without a file, create a basic parsedJobDescription from the request
          this.logger.log('Creating basic parsedJobDescription for standalone search');
          const basicParsedJobDescription = {
            jobTitle: body.jobTitle || parsedJD?.name || '',
            company: body.company || parsedJD?.companyName || '',
            location: body.location || parsedJD?.jobLocation || '',
            industry: body.industry || parsedJD?.companyName || '',
            requiredSkills: [],
            preferredSkills: [],
            experienceLevel: 'mid_level' as const,
            education: [],
            keywords: [],
            responsibilities: [],
            qualifications: [],
            benefits: [],
            employmentType: 'full_time' as const,
            remoteWork: false,
            salaryRange: null,
          };
          console.log('basicParsedJobDescription', basicParsedJobDescription);
          console.log('resolvedParams', resolvedParams);


          const result = await this.candidateSearchService.searchCandidatesWithParameters(
            basicParsedJobDescription,
            resolvedParams,
            body.searchType,
            body.searchCategory,
            apiToken,
            { cursor, limit: parsedLimit },
          );

          this.logger.log(`Standalone candidate search with client-resolved parameters completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
          return result;
        }
      }
      
      // If we have pre-generated search parameters, use them directly
      if ((body.parsedJobDescription || body.parsedJD?.parsedJobDescription) && (body.generatedSearchParameters || body.resolvedSearchParameters)) {
        // Prefer resolved parameters if available, otherwise use generated parameters
        const searchParams = body.resolvedSearchParameters || body.generatedSearchParameters;
        const paramsType = body.resolvedSearchParameters ? 'resolved' : 'generated';
        const parsedJobDescription = body.parsedJobDescription || body.parsedJD?.parsedJobDescription;
        
        this.logger.log(`Using pre-${paramsType} search parameters`);
        this.logger.log('Search parameters type:', typeof searchParams);
        this.logger.log('Search parameters keys:', Object.keys(searchParams));
        
        // Check if parsedJobDescription is already available
        if (parsedJobDescription) {
          this.logger.log('Using parsedJobDescription from client-provided data');
          const result = await this.candidateSearchService.searchCandidatesWithParameters(
            parsedJobDescription,
            searchParams,
            body.searchType,
            body.searchCategory,
            apiToken,
            { cursor, limit: parsedLimit },
          );

          this.logger.log(`File-based candidate search with pre-${paramsType} parameters completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
          return result;
        } else {
          // Fallback to parsing from file if parsedJobDescription is not available
          this.logger.log('parsedJobDescription not available, parsing from file');
          const parsedJobDescriptionFromFile = await this.candidateSearchService.parseJobDescriptionFromFile(
            body.filePath,
            apiToken,
          );

          const result = await this.candidateSearchService.searchCandidatesWithParameters(
            parsedJobDescriptionFromFile,
            searchParams,
            body.searchType,
            body.searchCategory,
            apiToken,
            { cursor, limit: parsedLimit },
          );

          this.logger.log(`File-based candidate search with pre-${paramsType} parameters completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
          return result;
        }
      } else {
        // Fallback to parsing and generating search parameters
        this.logger.log('No pre-generated search parameters found, parsing file and generating parameters');
        const request: CandidateSearchRequest = {
          jobDescription: '', // Will be parsed from file
          filePath: body.filePath,
          searchType: body.searchType,
          searchCategory: body.searchCategory,
          accountId: accountId || '',
          options: { cursor, limit: parsedLimit },
        };

        const result = await this.candidateSearchService.searchCandidates(
          request,
          apiToken,
        );

        this.logger.log(`File-based candidate search completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
        return result;
      }
    } catch (error) {
      throw new HttpException(
        error.message || 'File-based candidate search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Generate search parameters from uploaded JD file
   */
  @Post('generate-search-parameters/from-file')
  async generateSearchParametersFromFile(
    @Body() body: {
      filePath: string;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
    },
    @Req() req: any,
  ): Promise<{ parsedJobDescription: ParsedJobDescription; generatedSearchParameters: GeneratedSearchParameters }> {
    try {
      if (!body.filePath) {
        throw new HttpException('File path is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.searchType || !body.searchCategory) {
        throw new HttpException('Search type and category are required', HttpStatus.BAD_REQUEST);
      }

      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Generating search parameters from file for ${body.searchType} ${body.searchCategory}`);
      
      // Parse job description from file
      const parsedJobDescription = await this.candidateSearchService.parseJobDescriptionFromFile(
        body.filePath,
        apiToken,
      );

      // Generate search parameters
      const generatedSearchParameters = await this.candidateSearchService.generateSearchParametersFromLLM(
        parsedJobDescription,
        body.searchType,
        body.searchCategory,
        apiToken,
      );

      this.logger.log('Search parameters generated successfully from file');
      return {
        parsedJobDescription,
        generatedSearchParameters,
      };
    } catch (error) {
      this.logger.error('Failed to generate search parameters from file', error);
      throw new HttpException(
        error.message || 'Failed to generate search parameters from file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

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
      
      const result = await this.candidateSearchService.fetchLinkedInParameters(
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
      const accountId = await this.candidateSearchService.getLinkedInAccountId(apiToken);
      
      const result = await this.linkedinParameterResolver.resolveParameterIds(
        body.searchParameters,
        body.searchType,
        body.searchCategory,
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

  @Post('generate-enrichments')
  async generateEnrichments(
    @Body() body: GenerateEnrichmentsRequest,
    @Headers() headers: any
  ) {
    try {
      this.logger.log(`Generating enrichments for searchFilterId: ${body.searchFilterId}`);
      
      const apiToken = this.extractApiToken(headers);
      if (!apiToken) {
        throw new Error('API token is required');
      }

      // Get existing search parameters
      const searchParameters = await this.getSearchParameters(body.searchFilterId, apiToken);
      if (!searchParameters) {
        throw new Error('Search parameters must be generated before enrichments');
      }

      console.log("searchParameters generated now going to generateEnrichments");
      // Generate enrichments
      const enrichments = await this.searchGenerationService.generateEnrichments(
        body.parsedJD,
        searchParameters,
        body.sampleResults,
        apiToken
      );

      this.logger.log (`enrichments from generate enrichments:: ${JSON.stringify(enrichments, null, 2)}`);
      
      // Store enrichments in database
      await this.storeEnrichments(body.searchFilterId, enrichments, apiToken);

      // Create chat message
      const chatMessage = `Generated ${enrichments.enrichments.length} enrichment configurations for candidate evaluation.`;

      // Add chat message to search filter
      await this.addChatMessage(body.searchFilterId, 'assistant', chatMessage, apiToken);

      return {
        success: true,
        data: enrichments,
        chatMessage
      };

    } catch (error) {
      this.logger.error('Error generating enrichments:', error);
      return {
        success: false,
        error: `Failed to generate enrichments: ${error.message}`
      };
    }
  }

  @Post('generate-filters')
  async generateFilters(
    @Body() body: GenerateFiltersRequest,
    @Headers() headers: any
  ) {
    try {
      this.logger.log(`Generating filters for searchFilterId: ${body.searchFilterId}`);
      
      const apiToken = this.extractApiToken(headers);
      if (!apiToken) {
        throw new Error('API token is required');
      }

      // Generate filters
      const filters = await this.searchGenerationService.generateFilters(
        body.parsedJD,
        body.enrichments,
        body.sampleResults,
        body.dataDistribution,
        apiToken
      );

      // Store filters in database
      await this.storeFilters(body.searchFilterId, filters, apiToken);

      const chatMessage = `Generated filter strategy with ${filters.handsontableFilters.length} Handsontable filters and ${filters.candidateSearchFilters.length} CandidateSearch filters.`;

      // Add chat message to search filter
      await this.addChatMessage(body.searchFilterId, 'assistant', chatMessage, apiToken);

      return {
        success: true,
        data: filters,
        chatMessage
      };

    } catch (error) {
      this.logger.error('Error generating filters:', error);
      return {
        success: false,
        error: `Failed to generate filters: ${error.message}`
      };
    }
  }

  @Post('generate-sorts')
  async generateSorts(
    @Body() body: GenerateSortsRequest,
    @Headers() headers: any
  ) {
    try {
      this.logger.log(`Generating sorts for searchFilterId: ${body.searchFilterId}`);
      
      const apiToken = this.extractApiToken(headers);
      if (!apiToken) {
        throw new Error('API token is required');
      }

      // Generate sorts
      const sorts = await this.searchGenerationService.generateSorts(
        body.parsedJD,
        body.searchParameters,
        body.enrichments,
        body.filters,
        body.sampleResults,
        apiToken
      );

      // Store sorts in database
      await this.storeSorts(body.searchFilterId, sorts, apiToken);

      const chatMessage = `Generated multi-column sorting strategy with ${sorts.sortStrategy.sortColumns.length} sort columns. The sorting configuration prioritizes candidates based on ${sorts.sortStrategy.name}.`;

      // Add chat message to search filter
      await this.addChatMessage(body.searchFilterId, 'assistant', chatMessage, apiToken);

      return {
        success: true,
        data: sorts,
        chatMessage
      };

    } catch (error) {
      this.logger.error('Error generating sorts:', error);
      return {
        success: false,
        error: `Failed to generate sorts: ${error.message}`
      };
    }
  }

  /**
   * Process chat messages and route to appropriate services
   */
  @Post('message')
  async processMessage(
    @Body() body: ChatMessageRequest,
    @Headers() headers: any
  ): Promise<ChatMessageResponse> {
    try {
      this.logger.log(`Processing chat message for searchFilterId: ${body.searchFilterId}`);
      
      const apiToken = this.extractApiToken(headers);
      if (!apiToken) {
        throw new Error('API token is required');
      }

      // Classify the message to determine what action to take
      const messageClassification = await this.searchGenerationService.classifyMessage(body.message, apiToken);
      this.logger.log(`Message classified as: ${messageClassification.type} (confidence: ${messageClassification.confidence})`);
      this.logger.log(`Classification reasoning: ${messageClassification.reasoning}`);

      let response: any = {};

      switch (messageClassification.type) {
        case 'search_parameters':
          response = await this.handleSearchParametersGeneration(
            body.searchFilterId,
            body.parsedJD,
            body.searchType || 'classic',
            body.searchCategory || 'people',
            apiToken
          );
          break;

        case 'enrichments':
          response = await this.handleEnrichmentsGeneration(
            body.searchFilterId,
            body.parsedJD,
            body.sampleResults,
            apiToken
          );
          break;

        case 'filters':
          response = await this.handleFiltersGeneration(
            body.searchFilterId,
            body.parsedJD,
            body.sampleResults,
            body.dataDistribution,
            apiToken
          );
          break;

        case 'sorts':
          response = await this.handleSortsGeneration(
            body.searchFilterId,
            body.parsedJD,
            body.sampleResults,
            apiToken
          );
          break;

        case 'complete_plan':
          response = await this.handleCompletePlanGeneration(
            body.searchFilterId,
            body.parsedJD,
            body.searchType || 'classic',
            body.searchCategory || 'people',
            body.sampleResults,
            body.dataDistribution,
            apiToken
          );
          break;

        case 'general_help':
          response = {
            success: true,
            type: 'general_help',
            chatMessage: 'I can help you with candidate search and recruitment workflows! Here\'s what I can do:\n\n' +
              '🔍 **Search Parameters** - Generate LinkedIn search criteria to find candidates\n' +
              '📊 **Enrichments** - Add AI-powered insights to candidate profiles\n' +
              '🔧 **Filters** - Create filtering strategies to narrow down candidate lists\n' +
              '📈 **Sorts** - Design sorting strategies to prioritize the best candidates\n' +
              '🎯 **Complete Plan** - Generate all components at once for a comprehensive search strategy\n\n' +
              'Try saying "generate search parameters" or "create enrichments" to get started!'
          };
          break;

        default:
          response = {
            success: false,
            error: 'I didn\'t understand your request. Please try asking for search parameters, enrichments, filters, sorts, or a complete plan.',
            chatMessage: 'I didn\'t understand your request. Please try asking for search parameters, enrichments, filters, sorts, or a complete plan.'
          };
      }

      // Add user message to chat history
      await this.addChatMessage(body.searchFilterId, 'user', body.message, apiToken);

      return response;

    } catch (error) {
      this.logger.error('Error processing chat message:', error);
      return {
        success: false,
        error: `Failed to process message: ${error.message}`,
        chatMessage: `Sorry, I encountered an error: ${error.message}`
      };
    }
  }

  private extractApiToken(headers: any): string | null {
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }


  /**
   * Handle search parameters generation
   */
  private async handleSearchParametersGeneration(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string
  ) {
    try {
      const result = await this.generateSearchParametersInternal(
        parsedJD,
        searchType,
        searchCategory,
        searchFilterId,
        apiToken
      );

      return {
        success: true,
        type: 'search_parameters',
        data: result,
        chatMessage: `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`
      };
    } catch (error) {
      this.logger.error('Error generating search parameters:', error);
      return {
        success: false,
        error: `Failed to generate search parameters: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate search parameters: ${error.message}`
      };
    }
  }

  /**
   * Handle enrichments generation
   */
  private async handleEnrichmentsGeneration(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    sampleResults: any[] | undefined,
    apiToken: string
  ) {
    try {
      const result = await this.generateEnrichments({
        searchFilterId,
        parsedJD,
        sampleResults
      }, { headers: { authorization: `Bearer ${apiToken}` } } as any);

      return {
        success: true,
        type: 'enrichments',
        data: result.data,
        chatMessage: result.chatMessage
      };
    } catch (error) {
      this.logger.error('Error generating enrichments:', error);
      return {
        success: false,
        error: `Failed to generate enrichments: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate enrichments: ${error.message}`
      };
    }
  }

  /**
   * Handle filters generation
   */
  private async handleFiltersGeneration(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    sampleResults: any[] | undefined,
    dataDistribution: Record<string, { min: number; max: number; avg: number; count: number }> | undefined,
    apiToken: string
  ) {
    try {
      // Get existing enrichments first
      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      const enrichments = searchFilter.enrichmentConfigs || [];

      if (enrichments.length === 0) {
        return {
          success: false,
          error: 'Enrichments must be generated before filters',
          chatMessage: 'Please generate enrichments first before creating filters.'
        };
      }

      const enrichmentsResponse: EnrichmentsResponse = {
        enrichments,
        overallStrategy: 'Generated enrichments',
        reasoning: 'Using existing enrichments',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasSampleData: !!sampleResults,
          sampleDataSize: sampleResults?.length ?? null
        }
      };

      const result = await this.generateFilters({
        searchFilterId,
        parsedJD,
        enrichments: enrichmentsResponse,
        sampleResults,
        dataDistribution
      }, { headers: { authorization: `Bearer ${apiToken}` } } as any);

      return {
        success: true,
        type: 'filters',
        data: result.data,
        chatMessage: result.chatMessage
      };
    } catch (error) {
      this.logger.error('Error generating filters:', error);
      return {
        success: false,
        error: `Failed to generate filters: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate filters: ${error.message}`
      };
    }
  }

  /**
   * Handle sorts generation
   */
  private async handleSortsGeneration(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    sampleResults: any[] | undefined,
    apiToken: string
  ) {
    try {
      // Get existing data
      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      const enrichments = searchFilter.enrichmentConfigs || [];
      const filters = searchFilter.columnFilters || [];

      if (enrichments.length === 0) {
        return {
          success: false,
          error: 'Enrichments must be generated before sorts',
          chatMessage: 'Please generate enrichments first before creating sorts.'
        };
      }

      if (filters.length === 0) {
        return {
          success: false,
          error: 'Filters must be generated before sorts',
          chatMessage: 'Please generate filters first before creating sorts.'
        };
      }

      const enrichmentsResponse: EnrichmentsResponse = {
        enrichments,
        overallStrategy: 'Generated enrichments',
        reasoning: 'Using existing enrichments',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasSampleData: !!sampleResults,
          sampleDataSize: sampleResults?.length ?? null
        }
      };

      const filtersResponse: FiltersResponse = {
        filterStrategy: {
          name: 'Generated filter strategy',
          description: 'Using existing filters',
          targetShortlistSize: 50,
          priority: 'balanced' as const,
          reasoning: 'Using existing filters'
        },
        handsontableFilters: filters,
        candidateSearchFilters: [],
        reasoning: 'Using existing filters',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasDataDistribution: false,
          dataDistributionFields: null,
          hasSampleData: !!sampleResults,
          sampleDataSize: sampleResults?.length ?? null
        }
      };

      const searchParameters = searchFilter.searchFilterParameter?.generatedSearchParameters || {};

      const result = await this.generateSorts({
        searchFilterId,
        parsedJD,
        searchParameters,
        enrichments: enrichmentsResponse,
        filters: filtersResponse,
        sampleResults
      }, { headers: { authorization: `Bearer ${apiToken}` } } as any);

      return {
        success: true,
        type: 'sorts',
        data: result.data,
        chatMessage: result.chatMessage
      };
    } catch (error) {
      this.logger.error('Error generating sorts:', error);
      return {
        success: false,
        error: `Failed to generate sorts: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate sorts: ${error.message}`
      };
    }
  }

  /**
   * Handle complete plan generation (all components)
   */
  private async handleCompletePlanGeneration(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    sampleResults: any[] | undefined,
    dataDistribution: Record<string, { min: number; max: number; avg: number; count: number }> | undefined,
    apiToken: string
  ) {
    try {
      const results: any = {};

      // 1. Generate search parameters
      const searchParamsResult = await this.handleSearchParametersGeneration(
        searchFilterId, parsedJD, searchType, searchCategory, apiToken
      );
      results.searchParameters = searchParamsResult;

      // 2. Generate enrichments
      const enrichmentsResult = await this.handleEnrichmentsGeneration(
        searchFilterId, parsedJD, sampleResults, apiToken
      );
      results.enrichments = enrichmentsResult;

      // 3. Generate filters
      const filtersResult = await this.handleFiltersGeneration(
        searchFilterId, parsedJD, sampleResults, dataDistribution, apiToken
      );
      results.filters = filtersResult;

      // 4. Generate sorts
      const sortsResult = await this.handleSortsGeneration(
        searchFilterId, parsedJD, sampleResults, apiToken
      );
      results.sorts = sortsResult;

      const successCount = Object.values(results).filter((r: any) => r.success).length;
      const totalCount = Object.keys(results).length;

      return {
        success: successCount === totalCount,
        type: 'complete_plan',
        data: results,
        chatMessage: `Generated complete search plan with ${successCount}/${totalCount} components successfully.`
      };
    } catch (error) {
      this.logger.error('Error generating complete plan:', error);
      return {
        success: false,
        error: `Failed to generate complete plan: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate the complete plan: ${error.message}`
      };
    }
  }

  private constructSearchParamKey(searchType: string, searchCategory: string): string {
    // Convert searchType to camelCase and construct the proper key
    const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const capitalizedCategory = searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
    return `${camelCaseSearchType}${capitalizedCategory}Search`;
  }




  private async getSearchParameters(searchFilterId: string, apiToken: string): Promise<SearchParametersResponse | null> {
    console.log("searchFilterId", searchFilterId);
    try {
 

      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFindManySearchFilters,
        { filter: { id: { eq: searchFilterId } } },
        apiToken
      );

      const searchParameters = response.data?.data?.searchFilters?.edges[0]?.node;
      console.log("searchParameters for searchFilterId: ", searchFilterId, JSON.stringify(searchParameters, null, 2));
      return searchParameters;
    } catch (error) {
      this.logger.error('Error getting search parameters:', error);
      return null;
    }
  }




  @Get(':searchFilterId/history')
  async getChatHistory(
    @Param('searchFilterId') searchFilterId: string,
    @Headers() headers: any
  ) {
    try {
      const apiToken = headers.authorization.split(' ')[1];
        
      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      
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

      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      const enrichment = searchFilter.enrichmentConfigs?.find((e: any) => e.id === enrichmentId);
      
      if (!enrichment) {
        throw new HttpException('Enrichment not found', HttpStatus.NOT_FOUND);
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
   * Internal method to generate LinkedIn search parameters from parsed job description
   */
  private async generateSearchParametersInternal(
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    searchFilterId: string,
    apiToken: string
  ): Promise<{ generatedSearchParameters: GeneratedSearchParameters; resolvedSearchParameters: any; chatMessage: string }> {
    try {
      if (!parsedJobDescription) {
        throw new HttpException('Parsed job description is required', HttpStatus.BAD_REQUEST);
      }

      if (!searchType || !searchCategory) {
        throw new HttpException('Search type and category are required', HttpStatus.BAD_REQUEST);
      }

      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      this.logger.log(`searchFilter:: ${JSON.stringify(searchFilter, null, 2)}`);

      this.logger.log(`Generating search parameters for ${searchType} ${searchCategory}`);
      
      const generatedParams = await this.candidateSearchService.generateSearchParametersFromLLM(
        parsedJobDescription,
        searchType,
        searchCategory,
        apiToken,
      );

      this.logger.log('Search parameters generated successfully');
      this.logger.log(`generatedParams:: ${JSON.stringify(generatedParams, null, 2)}`);

      // Resolve to LinkedIn IDs
      const accountId = await this.candidateSearchService.getLinkedInAccountId(apiToken);
      const searchParamKey = this.constructSearchParamKey(searchType, searchCategory);
      this.logger.log(`searchParamKey:: ${searchParamKey}`);
      const searchParams = generatedParams[searchParamKey];
      let resolvedParams = {};
      if (!searchParams) {
        this.logger.warn(`No search parameters generated for ${searchParamKey}, using empty object`);
      } else {
        resolvedParams = await this.linkedinParameterResolver.resolveParameterIds(
          searchParams,
          searchType,
          searchCategory,
          accountId
        );
      }
      this.logger.log(`resolvedParams:: ${JSON.stringify(resolvedParams, null, 2)}`);

      // Update searchFilter
      const updateMutation = UpdateOneSearchFilter;

      // Create the proper nested structure for search parameters
      const parameterKey = this.constructSearchParamKey(searchType, searchCategory);
       
      const updatedSearchFilterParameter = {
        ...searchFilter.searchFilterParameter,
        generatedSearchParameters: {
          ...searchFilter.searchFilterParameter?.generatedSearchParameters,
          [parameterKey]: generatedParams[parameterKey],
        },
        resolvedSearchParameters: {
          ...searchFilter.searchFilterParameter?.resolvedSearchParameters,
          [parameterKey]: resolvedParams,
        },
      };
      this.logger.log(`updatedSearchFilterParameter:: ${JSON.stringify(updatedSearchFilterParameter, null, 2)}`);
      await this.staticGraphQLService.executeGraphQL(
        updateMutation,
        { 
          idToUpdate: searchFilter.id, 
          input: { 
            searchFilterParameter: updatedSearchFilterParameter,
            chatHistory: searchFilter.chatHistory,
          },
        },
        apiToken
      );

      // Create chat message
      const chatMessage = `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`;

      // Add chat message to search filter
      await this.addChatMessage(searchFilterId, 'assistant', chatMessage, apiToken);
      
      // Return both generated and resolved parameters
      return {
        generatedSearchParameters: generatedParams,
        resolvedSearchParameters: {
          [parameterKey]: resolvedParams
        },
        chatMessage
      };

    } catch (error) {
      this.logger.error('Error generating search parameters:', error);
      throw error;
    }
  }

  /**
   * Generate LinkedIn search parameters from parsed job description
   */
  @Post('generate-search-parameters')
  async generateSearchParameters(
     @Body() body: {
       parsedJobDescription: ParsedJobDescription;
       searchType: 'classic' | 'sales_navigator' | 'recruiter';
       searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
       searchFilterId: string;
     },
    @Req() req: any,
  ): Promise<{ generatedSearchParameters: GeneratedSearchParameters; resolvedSearchParameters: any; chatMessage: string }> {
     try {
       const apiToken = req.headers.authorization?.replace('Bearer ', '');
       if (!apiToken) {
         throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
       }

       return await this.generateSearchParametersInternal(
         body.parsedJobDescription,
         body.searchType,
         body.searchCategory,
         body.searchFilterId,
         apiToken
       );
     } catch (error) {
       console.error('Error generating search params:', error);
       throw error;
     }
   }



  private async getSearchFilter(searchFilterId: string, apiToken: string) {
    const query = graphqlToFindManySearchFilters;

    const result = await this.staticGraphQLService.executeGraphQL(
      query,
      { filter: { id: { eq: searchFilterId } } },
      apiToken
    );

    if (!result.data?.data?.searchFilters?.edges?.[0]?.node) {
      throw new HttpException('Search filter not found', HttpStatus.NOT_FOUND);
    }

    return result.data.data.searchFilters.edges[0].node;
  }




  private async addChatMessage(
    searchFilterId: string,
    role: 'user' | 'assistant',
    content: string,
    apiToken: string
  ) {
    const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
    const currentHistory = searchFilter.chatHistory || [];
    
    const newMessage = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date().toISOString(),
    };

    const updatedHistory = [...currentHistory, newMessage];

    const updateMutation = UpdateOneSearchFilter;

    await this.staticGraphQLService.executeGraphQL(
      updateMutation,
      { 
        idToUpdate: searchFilterId, 
        input: { 
          chatHistory: updatedHistory 
        } 
      },
      apiToken
    );
  }

  private async storeEnrichments(
    searchFilterId: string,
    enrichments: EnrichmentsResponse,
    apiToken: string
  ) {
    const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
    
    const updateMutation = UpdateOneSearchFilter;

    await this.staticGraphQLService.executeGraphQL(
      updateMutation,
      { 
        idToUpdate: searchFilterId, 
        input: { 
          enrichmentConfigs: enrichments.enrichments,
          chatHistory: searchFilter.chatHistory,
        } 
      },
      apiToken
    );
  }

  private async storeFilters(
    searchFilterId: string,
    filters: FiltersResponse,
    apiToken: string
  ) {
    const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
    
    const updateMutation = UpdateOneSearchFilter;

    await this.staticGraphQLService.executeGraphQL(
      updateMutation,
      { 
        idToUpdate: searchFilterId, 
        input: { 
          columnFilters: filters.handsontableFilters,
          chatHistory: searchFilter.chatHistory,
        } 
      },
      apiToken
    );
  }

  private async storeSorts(
    searchFilterId: string,
    sorts: SortsResponse,
    apiToken: string
  ) {
    const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
    
    const updateMutation = UpdateOneSearchFilter;

    await this.staticGraphQLService.executeGraphQL(
      updateMutation,
      { 
        idToUpdate: searchFilterId, 
        input: { 
          // Store flattened sort data
          sortColumns: sorts.sortStrategy.sortColumns,
          sortStrategyName: sorts.sortStrategy.name,
          sortStrategyDescription: sorts.sortStrategy.description,
          sortStrategyReasoning: sorts.sortStrategy.reasoning,
          // Keep legacy structure for backward compatibility
          columnSortConfigs: sorts.sortStrategy,
          chatHistory: searchFilter.chatHistory,
        } 
      },
      apiToken
    );
  }
}

