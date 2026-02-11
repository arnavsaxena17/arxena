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
    Put,
    Query,
    Req,
} from '@nestjs/common';
import { CandidateSearchBaseService } from 'src/engine/core-modules/candidate-search/services/candidate-search-base.service';
import { LinkedInSessionTrackerService } from 'src/engine/core-modules/linkedin-search/services/linkedin-session-tracker.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { CandidateSearchHandlerService } from '../services/candidate-search-handler.service';
import { JobDescriptionService } from '../services/job-description.service';
import { SearchResultsCacheService } from '../services/search-results-cache.service';
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
    private readonly searchResultsCacheService: SearchResultsCacheService,
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
        throw new HttpException('AI filter not found', HttpStatus.NOT_FOUND);
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
   * Get persisted search results and metadata from backend cache (3 months TTL).
   */
  @Get('cache/results')
  async getSearchResultsCache(
    @Query('jobId') jobId: string,
    @Req() req: any,
  ) {
    try {
      const apiToken = req.headers?.authorization?.replace?.('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }
      if (!jobId || jobId === 'job-id') {
        throw new HttpException('jobId is required', HttpStatus.BAD_REQUEST);
      }
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const payload =
        await this.searchResultsCacheService.get(workspaceId, jobId);
      if (!payload) {
        throw new HttpException('No cached results for this job', HttpStatus.NOT_FOUND);
      }
      return {
        results: payload.results,
        metadata: payload.metadata,
        jobId: payload.jobId,
        cachedAt: payload.cachedAt,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get search results cache', error);
      throw new HttpException(
        error?.message || 'Failed to get search results cache',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Persist search results and metadata to backend cache (3 months TTL).
   */
  @Put('cache/results')
  async setSearchResultsCache(
    @Body()
    body: {
      jobId: string;
      results: any[];
      metadata: {
        totalCount: number;
        currentPage: number;
        totalPages: number;
        cursor?: string;
        searchType?: string;
        searchCategory?: string;
        searchParameters?: any;
      };
    },
    @Req() req: any,
  ) {
    try {
      const apiToken = req.headers?.authorization?.replace?.('Bearer ', '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }
      if (!body?.jobId || body.jobId === 'job-id') {
        throw new HttpException('jobId is required', HttpStatus.BAD_REQUEST);
      }
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      await this.searchResultsCacheService.set(
        workspaceId,
        body.jobId,
        body.results ?? [],
        body.metadata ?? {
          totalCount: 0,
          currentPage: 0,
          totalPages: 0,
        },
      );
      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to set search results cache', error);
      throw new HttpException(
        error?.message || 'Failed to set search results cache',
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

