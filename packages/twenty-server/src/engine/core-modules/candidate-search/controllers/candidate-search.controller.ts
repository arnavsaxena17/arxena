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
  Req
} from '@nestjs/common';
import { CandidateSearchBaseService } from 'src/engine/core-modules/candidate-search/services/candidate-search-base.service';
import { LinkedInSessionTrackerService } from 'src/engine/core-modules/linkedin-search/services/linkedin-session-tracker.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { CandidateSearchHandlerService } from '../services/candidate-search-handler.service';
import { JobDescriptionService } from '../services/job-description.service';
import {
  CandidateSearchResponse,
  JobDescriptionParseRequest,
  ParsedJobDescription
} from '../types/candidate-search-request.type';
import { LinkedinParameterResolver } from '../utils/linkedin-parameter-resolver.util';

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
    private readonly linkedInRequestTracker: LinkedInSessionTrackerService,
    private readonly jobDescriptionService: JobDescriptionService,
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
      // Check if we have a valid jobDescription (non-empty string) or filePath
      const hasJobDescription = request.jobDescription && request.jobDescription.trim().length > 0;
      const hasFilePath = request.filePath && request.filePath.trim().length > 0;
      
      if (!hasJobDescription && !hasFilePath) {
        throw new HttpException('Either job description or file path is required', HttpStatus.BAD_REQUEST);
      }

      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log('Parsing job description');
      
      const result = await this.jobDescriptionService.parseJobDescription(
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
   * Search for people using LinkedIn Classic API
   */
  // @Post('search/classic/people')
  // async searchClassicPeople(
  //   @Body() body: {
  //     jobDescription: string;
  //     jobTitle?: string;
  //     company?: string;
  //     location?: string;
  //     industry?: string;
  //   },
  //   @Req() req: any,
  //   @Query('account_id') accountId?: string,
  //   @Query('cursor') cursor?: string,
  //   @Query('limit') limit?: string,
  // ): Promise<CandidateSearchResponse> {
  //   try {
  //     if (!body.jobDescription) {
  //       throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
  //     }

  //     const apiToken = req.headers.authorization?.replace('Bearer ', '');
  //     if (!apiToken) {
  //       throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
  //     }

  //     this.logger.log(`Searching for people using LinkedIn Classic`);
      
  //     // Validate and parse limit parameter
  //     const parsedLimit = limit ? parseInt(limit, 10) : undefined;
  //     if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
  //       throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
  //     }
      
  //     const request: CandidateSearchRequest = {
  //       ...body,
  //       searchType: 'classic',
  //       searchCategory: 'people',
  //       accountId: accountId || '', // Optional - will be retrieved from workspace if not provided
  //       options: { cursor, limit: parsedLimit },
  //     };

  //     const result = await this.candidateSearchService.searchCandidates(
  //       request,
  //       apiToken,
  //     );

  //     this.logger.log(`Classic people search completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
  //     return result;
  //   } catch (error) {
  //     this.logger.error('LinkedIn Classic people search failed', error);
  //     throw new HttpException(
  //       error.message || 'LinkedIn Classic people search failed',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  /**
   * Search for companies using LinkedIn Classic API
   */
  // @Post('search/classic/companies')
  // async searchClassicCompanies(
  //   @Body() body: {
  //     jobDescription: string;
  //     jobTitle?: string;
  //     company?: string;
  //     location?: string;
  //     industry?: string;
  //   },
  //   @Req() req: any,
  //   @Query('account_id') accountId?: string,
  //   @Query('cursor') cursor?: string,
  //   @Query('limit') limit?: string,
  // ): Promise<CandidateSearchResponse> {
  //   try {
  //     if (!accountId) {
  //       throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
  //     }

  //     if (!body.jobDescription) {
  //       throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
  //     }

  //     this.logger.log(`Searching for companies using LinkedIn Classic for account: ${accountId}`);
      
  //     // Validate and parse limit parameter
  //     const parsedLimit = limit ? parseInt(limit, 10) : undefined;
  //     if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
  //       throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
  //     }
      
  //     const request: CandidateSearchRequest = {
  //       ...body,
  //       searchType: 'classic',
  //       searchCategory: 'companies',
  //       accountId: accountId || '',
  //       options: { cursor, limit: parsedLimit },
  //     };

  //     const apiToken = req.headers.authorization?.replace('Bearer ', '');
  //     if (!apiToken) {
  //       throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
  //     }

  //     const result = await this.candidateSearchService.searchCandidates(
  //       request,
  //       apiToken,
  //     );

  //     this.logger.log(`Classic companies search completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
  //     return result;
  //   } catch (error) {
  //     this.logger.error('LinkedIn Classic companies search failed', error);
  //     throw new HttpException(
  //       error.message || 'LinkedIn Classic companies search failed',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  /**
   * Search for jobs using LinkedIn Classic API
   */
  // @Post('search/classic/jobs')
  // async searchClassicJobs(
  //   @Body() body: {
  //     jobDescription: string;
  //     jobTitle?: string;
  //     company?: string;
  //     location?: string;
  //     industry?: string;
  //   },
  //   @Req() req: any,
  //   @Query('account_id') accountId?: string,
  //   @Query('cursor') cursor?: string,
  //   @Query('limit') limit?: string,
  // ): Promise<CandidateSearchResponse> {
  //   try {
  //     if (!accountId) {
  //       throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
  //     }

  //     if (!body.jobDescription) {
  //       throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
  //     }

  //     this.logger.log(`Searching for jobs using LinkedIn Classic for account: ${accountId}`);
      
  //     // Validate and parse limit parameter
  //     const parsedLimit = limit ? parseInt(limit, 10) : undefined;
  //     if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
  //       throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
  //     }
      
  //     const request: CandidateSearchRequest = {
  //       ...body,
  //       searchType: 'classic',
  //       searchCategory: 'jobs',
  //       accountId: accountId || '',
  //       options: { cursor, limit: parsedLimit },
  //     };

  //     const apiToken = req.headers.authorization?.replace('Bearer ', '');
  //     if (!apiToken) {
  //       throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
  //     }

  //     const result = await this.candidateSearchService.searchCandidates(
  //       request,
  //       apiToken,
  //     );

  //     this.logger.log(`Classic jobs search completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
  //     return result;
  //   } catch (error) {
  //     this.logger.error('LinkedIn Classic jobs search failed', error);
  //     throw new HttpException(
  //       error.message || 'LinkedIn Classic jobs search failed',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  /**
   * Search for people using LinkedIn Sales Navigator API
   */
  // @Post('search/sales-navigator/people')
  // async searchSalesNavigatorPeople(
  //   @Body() body: {
  //     jobDescription: string;
  //     jobTitle?: string;
  //     company?: string;
  //     location?: string;
  //     industry?: string;
  //   },
  //   @Req() req: any,
  //   @Query('account_id') accountId?: string,
  //   @Query('cursor') cursor?: string,
  //   @Query('limit') limit?: string,
  // ): Promise<CandidateSearchResponse> {
  //   try {
  //     if (!accountId) {
  //       throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
  //     }

  //     if (!body.jobDescription) {
  //       throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
  //     }

  //     this.logger.log(`Searching for people using LinkedIn Sales Navigator for account: ${accountId}`);
      
  //     // Validate and parse limit parameter
  //     const parsedLimit = limit ? parseInt(limit, 10) : undefined;
  //     if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
  //       throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
  //     }
      
  //     const request: CandidateSearchRequest = {
  //       ...body,
  //       searchType: 'sales_navigator',
  //       searchCategory: 'people',
  //       accountId: accountId || '',
  //       options: { cursor, limit: parsedLimit },
  //     };

  //     const apiToken = req.headers.authorization?.replace('Bearer ', '');
  //     if (!apiToken) {
  //       throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
  //     }

  //     const result = await this.candidateSearchService.searchCandidates(
  //       request,
  //       apiToken,
  //     );

  //     this.logger.log(`Sales Navigator people search completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
  //     return result;
  //   } catch (error) {
  //     this.logger.error('LinkedIn Sales Navigator people search failed', error);
  //     throw new HttpException(
  //       error.message || 'LinkedIn Sales Navigator people search failed',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  /**
   * Search for companies using LinkedIn Sales Navigator API
   */
  // @Post('search/sales-navigator/companies')
  // async searchSalesNavigatorCompanies(
  //   @Body() body: {
  //     jobDescription: string;
  //     jobTitle?: string;
  //     company?: string;
  //     location?: string;
  //     industry?: string;
  //   },
  //   @Req() req: any,
  //   @Query('account_id') accountId?: string,
  //   @Query('cursor') cursor?: string,
  //   @Query('limit') limit?: string,
  // ): Promise<CandidateSearchResponse> {
  //   try {
  //     if (!accountId) {
  //       throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
  //     }

  //     if (!body.jobDescription) {
  //       throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
  //     }

  //     this.logger.log(`Searching for companies using LinkedIn Sales Navigator for account: ${accountId}`);
      
  //     // Validate and parse limit parameter
  //     const parsedLimit = limit ? parseInt(limit, 10) : undefined;
  //     if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
  //       throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
  //     }
      
  //     const request: CandidateSearchRequest = {
  //       ...body,
  //       searchType: 'sales_navigator',
  //       searchCategory: 'companies',
  //       accountId: accountId || '',
  //       options: { cursor, limit: parsedLimit },
  //     };

  //     const apiToken = req.headers.authorization?.replace('Bearer ', '');
  //     if (!apiToken) {
  //       throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
  //     }

  //     const result = await this.candidateSearchService.searchCandidates(
  //       request,
  //       apiToken,
  //     );

  //     this.logger.log(`Sales Navigator companies search completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
  //     return result;
  //   } catch (error) {
  //     this.logger.error('LinkedIn Sales Navigator companies search failed', error);
  //     throw new HttpException(
  //       error.message || 'LinkedIn Sales Navigator companies search failed',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  /**
   * Search for people using LinkedIn Recruiter API
   */
  // @Post('search/recruiter/people')
  // async searchRecruiterPeople(
  //   @Body() body: {
  //     jobDescription: string;
  //     jobTitle?: string;
  //     company?: string;
  //     location?: string;
  //     industry?: string;
  //   },
  //   @Req() req: any,
  //   @Query('account_id') accountId?: string,
  //   @Query('cursor') cursor?: string,
  //   @Query('limit') limit?: string,
  // ): Promise<CandidateSearchResponse> {
  //   try {
  //     if (!accountId) {
  //       throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
  //     }

  //     if (!body.jobDescription) {
  //       throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
  //     }

  //     this.logger.log(`Searching for people using LinkedIn Recruiter for account: ${accountId}`);
      
  //     // Validate and parse limit parameter
  //     const parsedLimit = limit ? parseInt(limit, 10) : undefined;
  //     if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
  //       throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
  //     }
      
  //     const request: CandidateSearchRequest = {
  //       ...body,
  //       searchType: 'recruiter',
  //       searchCategory: 'people',
  //       accountId: accountId || '',
  //       options: { cursor, limit: parsedLimit },
  //     };

  //     const apiToken = req.headers.authorization?.replace('Bearer ', '');
  //     if (!apiToken) {
  //       throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
  //     }

  //     const result = await this.candidateSearchService.searchCandidates(
  //       request,
  //       apiToken,
  //     );

  //     this.logger.log(`Recruiter people search completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
  //     return result;
  //   } catch (error) {
  //     this.logger.error('LinkedIn Recruiter people search failed', error);
  //     throw new HttpException(
  //       error.message || 'LinkedIn Recruiter people search failed',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  /**
   * Parse job description from file and perform candidate search
   */
  // @Post('search/from-file')
  // async searchCandidatesFromFile(
  //   @Body() body: {
  //     filePath: string;
  //     parsedJobDescription?: ParsedJobDescription;
  //     parsedJD?: any; // Full ParsedJD object from frontend
  //     generatedSearchParameters?: any;
  //     resolvedSearchParameters?: any;
  //     searchType: 'classic' | 'sales_navigator' | 'recruiter';
  //     searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
  //     jobDescription?: string;
  //     jobTitle?: string;
  //     company?: string;
  //     location?: string;
  //     industry?: string;
  //     searchParameters?: any;
  //     options?: any;
  //   },
  //   @Req() req: any,
  //   @Query('account_id') accountId?: string,
  //   @Query('cursor') cursor?: string,
  //   @Query('limit') limit?: string,
  // ) {
  // ): Promise<CandidateSearchResponse> {

    // try {
    //   if (!body.filePath && !body.resolvedSearchParameters) {
    //     throw new HttpException('File path or resolved search parameters are required', HttpStatus.BAD_REQUEST);
    //   }

    //   if (!body.searchType || !body.searchCategory) {
    //     throw new HttpException('Search type and category are required', HttpStatus.BAD_REQUEST);
    //   }

    //   const apiToken = req.headers.authorization?.replace('Bearer ', '');
    //   if (!apiToken) {
    //     throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    //   }

    //   this.logger.log(`Performing candidate search from file for ${body.searchType} ${body.searchCategory}`);
      
    //   // Validate and parse limit parameter
    //   const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    //   if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
    //     throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
    //   }

    //   // Check if resolved search parameters are provided in the parsedJD structure or as searchParameters
    //   const resolvedParams = body.resolvedSearchParameters || 
    //     body.searchParameters ||
    //     (body.parsedJD?.searchParameters && body.parsedJD.searchParameters.length > 0 ? 
    //       body.parsedJD.searchParameters[0].resolvedSearchParameters : null);

    //   // If resolved search parameters are provided, prefer using them directly.
    //   // If parsedJobDescription is missing, derive it from file to keep downstream typing consistent.
    //   if (resolvedParams) {
    //     this.logger.log('Resolved search parameters provided by client; skipping generation and resolution');
    //     this.logger.log('Resolved parameters:', JSON.stringify(resolvedParams, null, 2));
        
    //     const parsedJD = body.parsedJD;

    //     // Check if parsedJobDescription is already available in parsedJD
    //     if (parsedJD?.parsedJobDescription) {
    //       this.logger.log('Using parsedJobDescription from client-provided parsedJD');
    //       const result = await this.candidateSearchService.searchCandidatesWithParameters(
    //         parsedJD.parsedJobDescription,
    //         resolvedParams,
    //         body.searchType,
    //         body.searchCategory,
    //         apiToken,
    //         { cursor, limit: parsedLimit },
    //       );

    //       this.logger.log(`File-based candidate search with client-resolved parameters completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
    //       return result;
    //     } else if (body.filePath && body.filePath !== 'standalone_search') {
    //       // Fallback to parsing from file if parsedJobDescription is not available and we have a real file path
    //       this.logger.log('parsedJobDescription not available in parsedJD, parsing from file');
    //       const parsedJobDescription = await this.jobDescriptionService.parseJobDescriptionFromFile(
    //         body.filePath,
    //         apiToken,
    //       );

    //       const result = await this.candidateSearchService.searchCandidatesWithParameters(
    //         parsedJobDescription,
    //         resolvedParams,
    //         body.searchType,
    //         body.searchCategory,
    //         apiToken,
    //         { cursor, limit: parsedLimit },
    //       );

    //       this.logger.log(`File-based candidate search with client-resolved parameters completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
    //       return result;
    //     } else {
    //       // For standalone searches without a file, create a basic parsedJobDescription from the request
    //       this.logger.log('Creating basic parsedJobDescription for standalone search');
    //       const basicParsedJobDescription = {
    //         jobTitle: body.jobTitle || parsedJD?.name || '',
    //         company: body.company || parsedJD?.companyName || '',
    //         location: body.location || parsedJD?.jobLocation || '',
    //         industry: body.industry || parsedJD?.companyName || '',
    //         requiredSkills: [],
    //         preferredSkills: [],
    //         experienceLevel: 'mid_level' as const,
    //         education: [],
    //         keywords: [],
    //         responsibilities: [],
    //         qualifications: [],
    //         benefits: [],
    //         employmentType: 'full_time' as const,
    //         remoteWork: false,
    //         salaryRange: null,
    //       };
    //       console.log('basicParsedJobDescription', basicParsedJobDescription);
    //       console.log('resolvedParams', resolvedParams);


    //       const result = await this.candidateSearchService.searchCandidatesWithParameters(
    //         basicParsedJobDescription,
    //         resolvedParams,
    //         body.searchType,
    //         body.searchCategory,
    //         apiToken,
    //         { cursor, limit: parsedLimit },
    //       );

    //       this.logger.log(`Standalone candidate search with client-resolved parameters completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
    //       this.logger.log('result', result);
    //       return result;
    //     }
    //   }
      
    //   // If we have pre-generated search parameters, use them directly
    //   if ((body.parsedJobDescription || body.parsedJD?.parsedJobDescription) && (body.generatedSearchParameters || body.resolvedSearchParameters || body.searchParameters)) {
    //     // Prefer resolved parameters if available, otherwise use generated parameters or searchParameters
    //     const searchParams = body.resolvedSearchParameters || body.searchParameters || body.generatedSearchParameters;
    //     const paramsType = body.resolvedSearchParameters ? 'resolved' : (body.searchParameters ? 'search' : 'generated');
    //     const parsedJobDescription = body.parsedJobDescription || body.parsedJD?.parsedJobDescription;
        
    //     this.logger.log(`Using pre-${paramsType} search parameters`);
    //     this.logger.log('Search parameters type:', typeof searchParams);
    //     this.logger.log('Search parameters keys:', Object.keys(searchParams));
        
    //     // Check if parsedJobDescription is already available
    //     if (parsedJobDescription) {
    //       this.logger.log('Using parsedJobDescription from client-provided data');
    //       const result = await this.candidateSearchService.searchCandidatesWithParameters(
    //         parsedJobDescription,
    //         searchParams,
    //         body.searchType,
    //         body.searchCategory,
    //         apiToken,
    //         { cursor, limit: parsedLimit },
    //       );

    //       this.logger.log(`File-based candidate search with pre-${paramsType} parameters completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
    //       return result;
    //     } else {
    //       // Fallback to parsing from file if parsedJobDescription is not available
    //       this.logger.log('parsedJobDescription not available, parsing from file');
    //       const parsedJobDescriptionFromFile = await this.jobDescriptionService.parseJobDescriptionFromFile(
    //         body.filePath,
    //         apiToken,
    //       );

    //       const result = await this.candidateSearchService.searchCandidatesWithParameters(
    //         parsedJobDescriptionFromFile,
    //         searchParams,
    //         body.searchType,
    //         body.searchCategory,
    //         apiToken,
    //         { cursor, limit: parsedLimit },
    //       );

    //       this.logger.log(`File-based candidate search with pre-${paramsType} parameters completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
    //       return result;
    //     }
    //   } else {
    //     // Fallback to parsing and generating search parameters
    //     this.logger.log('No pre-generated search parameters found, parsing file and generating parameters');
    //     const request: CandidateSearchRequest = {
    //       jobDescription: '', // Will be parsed from file
    //       filePath: body.filePath,
    //       searchType: body.searchType,
    //       searchCategory: body.searchCategory,
    //       accountId: accountId || '',
    //       options: { cursor, limit: parsedLimit },
    //     };

    //     const result = await this.candidateSearchService.searchCandidates(
    //       request,
    //       apiToken,
    //     );

    //     this.logger.log(`File-based candidate search completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
    //     return result;
    //   }

  // } catch (error) {
  //   return {
  //     success: false,
  //     error: error.message || 'File-based candidate search failed',
  //   };
  //     this.logger.error('File-based candidate search failed', error);
  //     throw new HttpException(
  //       error.message || 'File-based candidate search failed',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );  
  //   }


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
  // ): Promise<{ parsedJobDescription: ParsedJobDescription; generatedSearchParameters: GeneratedSearchParameters }> {
  ) {
    try {
      // if (!body.filePath) {
      //   throw new HttpException('File path is required', HttpStatus.BAD_REQUEST);
      // }

      // if (!body.searchType || !body.searchCategory) {
      //   throw new HttpException('Search type and category are required', HttpStatus.BAD_REQUEST);
      // }

      // const apiToken = req.headers.authorization?.replace('Bearer ', '');
      // if (!apiToken) {
      //   throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      // }

      // this.logger.log(`Generating search parameters from file for ${body.searchType} ${body.searchCategory}`);
      
      // // Parse job description from file
      // const parsedJobDescription = await this.jobDescriptionService.parseJobDescriptionFromFile(
      //   body.filePath,
      //   apiToken,
      // );

      // // Generate search parameters
      // const generatedSearchParameters = await this.candidateSearchService.generateSearchParameters(
      //   parsedJobDescription,
      //   body.searchType,
      //   body.searchCategory,
      //   apiToken,
      // );

      // this.logger.log('Search parameters generated successfully from file');
      // return {
      //   parsedJobDescription,
      //   generatedSearchParameters,
      // };
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

  // @Post('generate-enrichments')
  // async generateEnrichments(
  //   @Body() body: GenerateEnrichmentsRequest,
  //   @Headers() headers: any
  // ) {
  //   try {
  //     this.logger.log(`Generating enrichments for searchFilterId: ${body.searchFilterId}`);
      
  //     const apiToken = extractApiToken(headers);
  //     if (!apiToken) {
  //       throw new Error('API token is required');
  //     }

  //     // Get existing search parameters
  //     const searchParameters = await this.candidateSearchHandlerService.getSearchParameters(body.searchFilterId, apiToken);
  //     if (!searchParameters) {
  //       throw new Error('Search parameters must be generated before enrichments');
  //     }

  //     console.log("searchParameters generated now going to generateEnrichments");
  //     // Generate enrichments
  //     // Note: searchParameters is GeneratedSearchParameters but service expects SearchParametersResponse
  //     // The service implementation accepts GeneratedSearchParameters despite the type signature
  //     const enrichments = await this.searchGenerationService.generateEnrichments(
  //       body.parsedJD,
  //       searchParameters as any,
  //       body.sampleResults,
  //       apiToken
  //     );

  //     this.logger.log (`enrichments from generate enrichments:: ${JSON.stringify(enrichments, null, 2)}`);
      
  //     // Store enrichments in database
  //     await this.candidateSearchHandlerService.storeEnrichments(body.searchFilterId, enrichments, apiToken);

  //     // Create chat message
  //     const chatMessage = `Generated ${enrichments.enrichments.length} enrichment configurations for candidate evaluation.`;

  //     // Add chat message to search filter
  //     await this.candidateSearchHandlerService.addChatMessage(body.searchFilterId, 'assistant', chatMessage, apiToken);

  //     return {
  //       success: true,
  //       data: enrichments,
  //       chatMessage
  //     };

  //   } catch (error) {
  //     this.logger.error('Error generating enrichments:', error);
  //     return {
  //       success: false,
  //       error: `Failed to generate enrichments: ${error.message}`
  //     };
  //   }
  // }

  // @Post('generate-filters')
  // async generateFilters(
  //   @Body() body: GenerateFiltersRequest,
  //   @Headers() headers: any
  // ) {
  //   try {
  //     this.logger.log(`Generating filters for searchFilterId: ${body.searchFilterId}`);
      
  //     const apiToken = extractApiToken(headers);
  //     if (!apiToken) {
  //       throw new Error('API token is required');
  //     }

  //     // Generate filters
  //     const filters = await this.searchGenerationService.generateFilters(
  //       body.parsedJD,
  //       body.enrichments,
  //       body.sampleResults,
  //       body.dataDistribution,
  //       apiToken
  //     );

  //     // Store filters in database
  //     await this.candidateSearchHandlerService.storeFilters(body.searchFilterId, filters, apiToken);

  //     const chatMessage = `Generated filter strategy with ${filters.handsontableFilters.length} Handsontable filters and ${filters.candidateSearchFilters.length} CandidateSearch filters.`;

  //     // Add chat message to search filter
  //     await this.candidateSearchHandlerService.addChatMessage(body.searchFilterId, 'assistant', chatMessage, apiToken);

  //     return {
  //       success: true,
  //       data: filters,
  //       chatMessage
  //     };

  //   } catch (error) {
  //     this.logger.error('Error generating filters:', error);
  //     return {
  //       success: false,
  //       error: `Failed to generate filters: ${error.message}`
  //     };
  //   }
  // }

  // @Post('generate-sorts')
  // async generateSorts(
  //   @Body() body: GenerateSortsRequest,
  //   @Headers() headers: any
  // ) {
  //   try {
  //     this.logger.log(`Generating sorts for searchFilterId: ${body.searchFilterId}`);
      
  //     const apiToken = extractApiToken(headers);
  //     if (!apiToken) {
  //       throw new Error('API token is required');
  //     }

  //     // Generate sorts
  //     const sorts = await this.searchGenerationService.generateSorts(
  //       body.parsedJD,
  //       body.searchParameters,
  //       body.enrichments,
  //       body.filters,
  //       body.sampleResults,
  //       apiToken
  //     );

  //     // Store sorts in database
  //     await this.candidateSearchHandlerService.storeSorts(body.searchFilterId, sorts, apiToken);

  //     const chatMessage = `Generated multi-column sorting strategy with ${sorts.sortStrategy.sortColumns.length} sort columns. The sorting configuration prioritizes candidates based on ${sorts.sortStrategy.name}.`;

  //     // Add chat message to search filter
  //     await this.candidateSearchHandlerService.addChatMessage(body.searchFilterId, 'assistant', chatMessage, apiToken);

  //     return {
  //       success: true,
  //       data: sorts,
  //       chatMessage
  //     };

  //   } catch (error) {
  //     this.logger.error('Error generating sorts:', error);
  //     return {
  //       success: false,
  //       error: `Failed to generate sorts: ${error.message}`
  //     };
  //   }
  // }




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
  ) {
  // ): Promise<{
  //   generatedSearchParameters: GeneratedSearchParameters;
  //   resolvedSearchParameters: any;
  //   chatMessage: string;
  //   searchResultsPreview?: SearchExecutionPreview;
  // }> {
    //  try {
    //    const apiToken = req.headers.authorization?.replace('Bearer ', '');
    //    if (!apiToken) {
    //      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    //    }

    //    const result = await this.candidateSearchHandlerService.generateSearchParametersInternal(
    //      body.parsedJobDescription,
    //      body.searchType,
    //      body.searchCategory,
    //      body.searchFilterId,
    //      apiToken
    //    ) as {
    //     generatedSearchParameters: GeneratedSearchParameters;
    //     resolvedSearchParameters: any;
    //     chatMessage: string;
    //     searchResultsPreview?: SearchExecutionPreview;
    //   } | {
    //     generatedParams: GeneratedSearchParameters;
    //   };

    //   if (result && 'generatedParams' in result) {
    //     return {
    //       generatedSearchParameters: result.generatedParams,
    //       resolvedSearchParameters: {},
    //       chatMessage: '',
    //       searchResultsPreview: undefined,
    //     };
    //   } 
    //   return result;
    //  } catch (error) {
    //    console.error('Error generating search params:', error);
    //    throw error;
    //  }
   }

}

