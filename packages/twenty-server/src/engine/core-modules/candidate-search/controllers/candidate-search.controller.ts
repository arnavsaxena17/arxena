import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CandidateSearchService } from '../services/candidate-search.service';
import {
  CandidateSearchRequest,
  CandidateSearchResponse,
  GeneratedSearchParameters,
  JobDescriptionParseRequest,
  ParsedJobDescription,
} from '../types/candidate-search-request.type';

@Controller('candidate-search')
export class CandidateSearchController {
  private readonly logger = new Logger(CandidateSearchController.name);

  constructor(private readonly candidateSearchService: CandidateSearchService) {}

  /**
   * Parse job description and extract structured information
   */
  @Post('parse-job-description')
  async parseJobDescription(
    @Body() request: JobDescriptionParseRequest,
    @Req() req: any,
  ): Promise<ParsedJobDescription> {
    try {
      if (!request.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
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
      this.logger.error('Failed to parse job description', error);
      throw new HttpException(
        error.message || 'Failed to parse job description',
        HttpStatus.INTERNAL_SERVER_ERROR,
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
    },
    @Req() req: any,
  ): Promise<GeneratedSearchParameters> {
    try {
      if (!body.parsedJobDescription) {
        throw new HttpException('Parsed job description is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.searchType || !body.searchCategory) {
        throw new HttpException('Search type and category are required', HttpStatus.BAD_REQUEST);
      }

      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Generating search parameters for ${body.searchType} ${body.searchCategory}`);
      
      const result = await this.candidateSearchService.generateSearchParameters(
        body.parsedJobDescription,
        body.searchType,
        body.searchCategory,
        apiToken,
      );

      this.logger.log('Search parameters generated successfully');
      return result;
    } catch (error) {
      this.logger.error('Failed to generate search parameters', error);
      throw new HttpException(
        error.message || 'Failed to generate search parameters',
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
      parsedJobDescription?: any;
      generatedSearchParameters?: any;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
    },
    @Req() req: any,
    @Query('account_id') accountId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<CandidateSearchResponse> {
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

      this.logger.log(`Performing candidate search from file for ${body.searchType} ${body.searchCategory}`);
      
      // Validate and parse limit parameter
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      if (parsedLimit && (isNaN(parsedLimit) || parsedLimit <= 0)) {
        throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
      }
      
      // If we have pre-generated search parameters, use them directly
      if (body.parsedJobDescription && body.generatedSearchParameters) {
        this.logger.log('Using pre-generated search parameters');
        this.logger.log('Search parameters type:', typeof body.generatedSearchParameters);
        this.logger.log('Search parameters keys:', Object.keys(body.generatedSearchParameters));
        const result = await this.candidateSearchService.searchCandidatesWithParameters(
          body.parsedJobDescription,
          body.generatedSearchParameters,
          body.searchType,
          body.searchCategory,
          apiToken,
          { cursor, limit: parsedLimit },
        );

        this.logger.log(`File-based candidate search with pre-generated parameters completed successfully. Found ${result.searchResults?.items?.length || 0} results.`);
        return result;
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
      this.logger.error('File-based candidate search failed', error);
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
      const generatedSearchParameters = await this.candidateSearchService.generateSearchParameters(
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
      
      const result = await this.candidateSearchService.resolveParameterIds(
        body.searchParameters,
        body.searchType,
        body.searchCategory,
        apiToken,
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
   * Get health status of the candidate search service
   */
  @Get('health')
  async getHealth(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}

