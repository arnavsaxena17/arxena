import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Logger,
    Post,
    Query,
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
  ): Promise<ParsedJobDescription> {
    try {
      if (!request.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log('Parsing job description');
      
      const result = await this.candidateSearchService.parseJobDescription(
        request,
        'dummy-token', // TODO: Get actual API token from request
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
  ): Promise<GeneratedSearchParameters> {
    try {
      if (!body.parsedJobDescription) {
        throw new HttpException('Parsed job description is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.searchType || !body.searchCategory) {
        throw new HttpException('Search type and category are required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Generating search parameters for ${body.searchType} ${body.searchCategory}`);
      
      const result = await this.candidateSearchService.generateSearchParameters(
        body.parsedJobDescription,
        body.searchType,
        body.searchCategory,
        'dummy-token', // TODO: Get actual API token from request
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
  ): Promise<CandidateSearchResponse> {
    try {
      if (!request.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
      }

      if (!request.searchType || !request.searchCategory) {
        throw new HttpException('Search type and category are required', HttpStatus.BAD_REQUEST);
      }

      if (!request.accountId) {
        throw new HttpException('LinkedIn account ID is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Performing candidate search for ${request.searchType} ${request.searchCategory}`);
      
      const result = await this.candidateSearchService.searchCandidates(
        request,
        'dummy-token', // TODO: Get actual API token from request
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
    @Query('account_id') accountId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ): Promise<CandidateSearchResponse> {
    try {
      if (!accountId) {
        throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Searching for people using LinkedIn Classic for account: ${accountId}`);
      
      const request: CandidateSearchRequest = {
        ...body,
        searchType: 'classic',
        searchCategory: 'people',
        accountId,
        options: { cursor, limit },
      };

      const result = await this.candidateSearchService.searchCandidates(
        request,
        'dummy-token', // TODO: Get actual API token from request
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
    @Query('account_id') accountId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ): Promise<CandidateSearchResponse> {
    try {
      if (!accountId) {
        throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Searching for companies using LinkedIn Classic for account: ${accountId}`);
      
      const request: CandidateSearchRequest = {
        ...body,
        searchType: 'classic',
        searchCategory: 'companies',
        accountId,
        options: { cursor, limit },
      };

      const result = await this.candidateSearchService.searchCandidates(
        request,
        'dummy-token', // TODO: Get actual API token from request
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
    @Query('account_id') accountId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ): Promise<CandidateSearchResponse> {
    try {
      if (!accountId) {
        throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Searching for jobs using LinkedIn Classic for account: ${accountId}`);
      
      const request: CandidateSearchRequest = {
        ...body,
        searchType: 'classic',
        searchCategory: 'jobs',
        accountId,
        options: { cursor, limit },
      };

      const result = await this.candidateSearchService.searchCandidates(
        request,
        'dummy-token', // TODO: Get actual API token from request
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
    @Query('account_id') accountId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ): Promise<CandidateSearchResponse> {
    try {
      if (!accountId) {
        throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Searching for people using LinkedIn Sales Navigator for account: ${accountId}`);
      
      const request: CandidateSearchRequest = {
        ...body,
        searchType: 'sales_navigator',
        searchCategory: 'people',
        accountId,
        options: { cursor, limit },
      };

      const result = await this.candidateSearchService.searchCandidates(
        request,
        'dummy-token', // TODO: Get actual API token from request
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
    @Query('account_id') accountId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ): Promise<CandidateSearchResponse> {
    try {
      if (!accountId) {
        throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Searching for companies using LinkedIn Sales Navigator for account: ${accountId}`);
      
      const request: CandidateSearchRequest = {
        ...body,
        searchType: 'sales_navigator',
        searchCategory: 'companies',
        accountId,
        options: { cursor, limit },
      };

      const result = await this.candidateSearchService.searchCandidates(
        request,
        'dummy-token', // TODO: Get actual API token from request
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
    @Query('account_id') accountId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ): Promise<CandidateSearchResponse> {
    try {
      if (!accountId) {
        throw new HttpException('Account ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.jobDescription) {
        throw new HttpException('Job description is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Searching for people using LinkedIn Recruiter for account: ${accountId}`);
      
      const request: CandidateSearchRequest = {
        ...body,
        searchType: 'recruiter',
        searchCategory: 'people',
        accountId,
        options: { cursor, limit },
      };

      const result = await this.candidateSearchService.searchCandidates(
        request,
        'dummy-token', // TODO: Get actual API token from request
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
