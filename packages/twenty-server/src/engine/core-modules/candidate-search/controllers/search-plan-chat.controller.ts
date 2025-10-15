import { Body, Controller, Get, Headers, HttpException, HttpStatus, Logger, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CandidateSearchService } from 'src/engine/core-modules/candidate-search/services/candidate-search.service';
import { GeneratedSearchParameters, ParsedJobDescription } from 'src/engine/core-modules/candidate-search/types/candidate-search-request.type';
import { LinkedinParameterResolver } from 'src/engine/core-modules/candidate-search/utils/linkedin-parameter-resolver.util';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { LinkedInSessionTrackerService } from 'src/engine/core-modules/linkedin-search/services/linkedin-session-tracker.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { graphqlToFindManyJobs, graphqlToFindManySearchFilters, UpdateOneSearchFilter } from 'twenty-shared';
import { SearchPlanAIService } from '../services/search-plan-ai.service';
import { SearchStrategyExecutorService } from '../services/search-strategy-executor.service';

@Controller('search-plan-chat')
@UseGuards(JwtAuthGuard)
export class SearchPlanChatController {
  private readonly logger = new Logger(SearchPlanChatController.name);

  constructor(
    private readonly searchPlanAIService: SearchPlanAIService,
    private readonly candidateSearchService: CandidateSearchService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly linkedInRequestTracker: LinkedInSessionTrackerService,
    private readonly searchStrategyExecutorService: SearchStrategyExecutorService,
  ) {}


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
 
       // const normalizedParsedJD = this.validateAndNormalizeParsedJD(body.parsedJobDescription);
       
 
 
       this.logger.log(`Generating search parameters for ${body.searchType} ${body.searchCategory}`);
       
       const result = await this.candidateSearchService.generateSearchParametersFromLLM(
         body.parsedJobDescription,
         body.searchType,
         body.searchCategory,
         apiToken,
       );
 
       this.logger.log('Search parameters generated successfully');
       return result;
     } catch (error) {
       this.logger.error('Failed to generate search parameters in generate-search-parameters', error);
       throw new HttpException(
         error.message || 'Failed to generate search parameters',
         HttpStatus.INTERNAL_SERVER_ERROR,
       );
     }
   }
   


  private async generateSearchParams(
    searchFilterId: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string
  ): Promise<GeneratedSearchParameters> {
    try {
      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      
      // Get the job's parsed JD from the search filter's job relation
      const jobQuery = graphqlToFindManyJobs;
      this.logger.log (`searchFilter:: ${JSON.stringify(searchFilter, null, 2)}`);
      const jobResult = await this.staticGraphQLService.executeGraphQL(
        jobQuery,
        { filter: { id: { eq: searchFilter.jobId } } },
        apiToken
      );
      // jobs query returns a connection with edges → node
      const jobsConn = jobResult?.data?.data?.jobs;
      const jobEdges = jobsConn?.edges || [];
      const job = jobEdges[0]?.node;

      this.logger.log (`job:: ${JSON.stringify(job, null, 2)}`);
      if (!job) {
        throw new Error(`Job not found for searchFilterId: ${searchFilterId}`);
      }
      
      // Create a mock ParsedJobDescription from job data
      const parsedJD: ParsedJobDescription = {
        jobTitle: job.name || '',
        company: job.companyName || '',
        location: job.jobLocation || '',
        industry: job.companyName || '',
        requiredSkills: job.specificCriteria ? job.specificCriteria.split(',').map(s => s.trim()) : [],
        preferredSkills: [],
        experienceLevel: 'mid_level' as const,
        education: [],
        keywords: job.specificCriteria ? job.specificCriteria.split(',').map(s => s.trim()) : [],
        responsibilities: [],
        qualifications: [],
        benefits: [],
        employmentType: 'full_time',
        remoteWork: false,
        salaryRange: job.salaryBracket ? { min: 0, max: 0, currency: 'INR' } : null,
      };
      this.logger.log (`parsedJD:: ${JSON.stringify(parsedJD, null, 2)}`);
      // Generate new search parameters
      const generatedParams = await this.candidateSearchService.generateSearchParametersFromLLM(
        parsedJD,
        searchType,
        searchCategory,
        apiToken
      );
      this.logger.log (`generatedParams:: ${JSON.stringify(generatedParams, null, 2)}`);

      // Resolve to LinkedIn IDs
      const accountId = await this.candidateSearchService.getLinkedInAccountId(apiToken);
      const searchParamKey = `${searchType}${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}Search`;
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
      this.logger.log (`resolvedParams:: ${JSON.stringify(resolvedParams, null, 2)}`);
      // Update searchFilter
      const updateMutation = UpdateOneSearchFilter;

      // Create the proper nested structure for search parameters
      const parameterKey = `${searchType}${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}Search`;
      
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
      this.logger.log (`updatedSearchFilterParameter:: ${JSON.stringify(updatedSearchFilterParameter, null, 2)}`);
      await this.staticGraphQLService.executeGraphQL(
        updateMutation,
        { 
          idToUpdate: searchFilterId, 
          input: { 
            searchFilterParameter: updatedSearchFilterParameter,
            chatHistory: searchFilter.chatHistory,
          },
        },
        apiToken
      );
      this.logger.log (`updatedSearchFilterParameter:: ${JSON.stringify(updatedSearchFilterParameter, null, 2)}`);
      return generatedParams;
    } catch (error) {
      console.error('Error generating search params:', error);
      throw error;
    }
  }

  @Post(':searchFilterId/execute-strategy')
  async executeSearchStrategy(
    @Param('searchFilterId') searchFilterId: string,
    @Body() { parsedJD }: { parsedJD: ParsedJobDescription },
    @Headers() headers: any
  ) {
    try {
      const apiToken = headers.authorization.split(' ')[1];
      
      if (!parsedJD) {
        throw new HttpException('Parsed job description is required', HttpStatus.BAD_REQUEST);
      }

      // Get search filter with strategy
      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      this.logger.log (`searchFilter:: ${JSON.stringify(searchFilter, null, 2)}`);
      if (!searchFilter.searchStrategy) {
        throw new HttpException('No search strategy found for this search filter', HttpStatus.BAD_REQUEST);
      }
      this.logger.log (`searchFilter.searchStrategy:: ${JSON.stringify(searchFilter.searchStrategy, null, 2)}`);
      // Execute the strategy tree
      const executionResult = await this.searchStrategyExecutorService.executeTree(
        searchFilter.searchStrategy,
        parsedJD,
        apiToken
      );
      this.logger.log (`executionResult:: ${JSON.stringify(executionResult, null, 2)}`);
      // Update search filter with generated parameters, enrichments, and filters
      const updateData: any = {};
      this.logger.log (`updateData:: ${JSON.stringify(updateData, null, 2)}`);
      if (Object.keys(executionResult.searchParameters).length > 0) {
        updateData.searchFilterParameter = executionResult.searchParameters;
      }
      this.logger.log (`updateData.searchFilterParameter:: ${JSON.stringify(updateData.searchFilterParameter, null, 2)}`);
      if (executionResult.enrichments.length > 0) {
        updateData.enrichmentConfigs = executionResult.enrichments;
      }
      this.logger.log (`updateData.enrichmentConfigs:: ${JSON.stringify(updateData.enrichmentConfigs, null, 2)}`);
      if (executionResult.filters.length > 0) {
        updateData.columnFilters = executionResult.filters;
      }
      this.logger.log (`updateData.columnFilters:: ${JSON.stringify(updateData.columnFilters, null, 2)}`);
      // Save updated search filter
      if (Object.keys(updateData).length > 0) {
        await this.staticGraphQLService.executeGraphQL(
          UpdateOneSearchFilter,
          { 
            idToUpdate: searchFilterId, 
            input: updateData 
          },
          apiToken
        );
      }
      this.logger.log (`updateData:: ${JSON.stringify(updateData, null, 2)}`);
      this.logger.log (`executionResult.searchParameters:: ${JSON.stringify(executionResult.searchParameters, null, 2)}`);
      this.logger.log (`executionResult.enrichments:: ${JSON.stringify(executionResult.enrichments, null, 2)}`);
      this.logger.log (`executionResult.filters:: ${JSON.stringify(executionResult.filters, null, 2)}`);
      return {
        status: 'success',
        message: 'Search strategy executed successfully',
        data: {
          searchParameters: executionResult.searchParameters,
          enrichments: executionResult.enrichments,
          filters: executionResult.filters,
          executionLog: executionResult.executionLog,
        },
      };
    } catch (error) {
      console.error('Error executing search strategy:', error);
      throw new HttpException(
        `Failed to execute search strategy: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('process-search-parameters')
  async processSearchParameters(
    @Body() { jdText, prompt, responseFormat }: { jdText: string; prompt: string; responseFormat: string },
    @Headers() headers: any
  ) {
    try {
      const apiToken = headers.authorization.split(' ')[1];
      
      if (!jdText?.trim() || !prompt?.trim()) {
        throw new HttpException('Job description and prompt are required', HttpStatus.BAD_REQUEST);
      }

      const result = await this.searchPlanAIService.processSearchParametersPrompt(
        jdText,
        prompt,
        responseFormat,
        apiToken
      );

      return {
        status: 'success',
        data: result,
      };
    } catch (error) {
      console.error('Error processing search parameters:', error);
      throw new HttpException(
        error.message || 'Failed to process search parameters',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('process-enrichments')
  async processEnrichments(
    @Body() { jdText, prompt, responseFormat }: { jdText: string; prompt: string; responseFormat: string },
    @Headers() headers: any
  ) {
    try {
      const apiToken = headers.authorization.split(' ')[1];
      
      if (!jdText?.trim() || !prompt?.trim()) {
        throw new HttpException('Job description and prompt are required', HttpStatus.BAD_REQUEST);
      }

      const result = await this.searchPlanAIService.processEnrichmentsPrompt(
        jdText,
        prompt,
        responseFormat,
        apiToken
      );

      return {
        status: 'success',
        data: result,
      };
    } catch (error) {
      console.error('Error processing enrichments:', error);
      throw new HttpException(
        error.message || 'Failed to process enrichments',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('process-filters')
  async processFilters(
    @Body() { jdText, prompt, responseFormat }: { jdText: string; prompt: string; responseFormat: string },
    @Headers() headers: any
  ) {
    try {
      const apiToken = headers.authorization.split(' ')[1];
      
      if (!jdText?.trim() || !prompt?.trim()) {
        throw new HttpException('Job description and prompt are required', HttpStatus.BAD_REQUEST);
      }

      const result = await this.searchPlanAIService.processFiltersPrompt(
        jdText,
        prompt,
        responseFormat,
        apiToken
      );

      return {
        status: 'success',
        data: result,
      };
    } catch (error) {
      console.error('Error processing filters:', error);
      throw new HttpException(
        error.message || 'Failed to process filters',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('strategy-templates')
  async getStrategyTemplates() {
    return {
      status: 'success',
      data: [
        {
          id: 'broad-search',
          name: 'Broad Search Strategy',
          description: 'Minimal filtering with maximum enrichments for comprehensive candidate discovery',
          tree: {
            treeVersion: '1.0',
            rootNodeId: 'root_1',
            nodes: {
              root_1: {
                id: 'root_1',
                name: 'Search Strategy Decider',
                prompt: 'Analyze the job description and determine the optimal search strategy. Job Title: {jobTitle}, Company: {company}, Industry: {industry}',
                model: 'gpt-4o-mini',
                inputSources: ['jobTitle', 'company', 'industry'],
                outputSchema: [
                  { name: 'strategy', type: 'string', description: 'Recommended search strategy' },
                  { name: 'focus', type: 'string', description: 'Primary focus area' }
                ],
                outputDestination: 'intermediate',
                children: ['search_param_1', 'enrichment_1', 'filter_1']
              },
              search_param_1: {
                id: 'search_param_1',
                name: 'Keyword Generator',
                prompt: 'Generate broad search keywords for LinkedIn search. Focus on: {focus}',
                model: 'gpt-4o-mini',
                inputSources: ['focus'],
                outputSchema: [
                  { name: 'keywords', type: 'array<string>', description: 'Search keywords' },
                  { name: 'location', type: 'string', description: 'Preferred location' }
                ],
                outputDestination: 'searchParameters',
                children: [],
                parent: 'root_1'
              },
              enrichment_1: {
                id: 'enrichment_1',
                name: 'Skills Assessment',
                prompt: 'Assess candidate technical skills and experience level',
                model: 'gpt-4o-mini',
                inputSources: ['jobTitle', 'requiredSkills'],
                outputSchema: [
                  { name: 'technicalSkills', type: 'array<string>', description: 'Technical skills found' },
                  { name: 'experienceLevel', type: 'string', description: 'Experience level assessment' }
                ],
                outputDestination: 'enrichments',
                children: [],
                parent: 'root_1'
              },
              filter_1: {
                id: 'filter_1',
                name: 'Basic Filter',
                prompt: 'Apply basic location and industry filters',
                model: 'gpt-4o-mini',
                inputSources: ['location', 'industry'],
                outputSchema: [
                  { name: 'locationFilter', type: 'string', description: 'Location filter value' },
                  { name: 'industryFilter', type: 'string', description: 'Industry filter value' }
                ],
                outputDestination: 'filters',
                children: [],
                parent: 'root_1'
              }
            },
            edges: [
              { from: 'root_1', to: 'search_param_1' },
              { from: 'root_1', to: 'enrichment_1' },
              { from: 'root_1', to: 'filter_1' }
            ]
          }
        },
        {
          id: 'narrow-search',
          name: 'Narrow Search Strategy',
          description: 'Precise parameters with minimal enrichments for targeted candidate discovery',
          tree: {
            treeVersion: '1.0',
            rootNodeId: 'root_2',
            nodes: {
              root_2: {
                id: 'root_2',
                name: 'Precision Search Decider',
                prompt: 'Analyze job requirements for precise targeting. Job Title: {jobTitle}, Required Skills: {requiredSkills}',
                model: 'gpt-4o-mini',
                inputSources: ['jobTitle', 'requiredSkills'],
                outputSchema: [
                  { name: 'targetKeywords', type: 'array<string>', description: 'Targeted keywords' },
                  { name: 'seniority', type: 'string', description: 'Required seniority level' }
                ],
                outputDestination: 'intermediate',
                children: ['search_param_2', 'filter_2']
              },
              search_param_2: {
                id: 'search_param_2',
                name: 'Precise Keywords',
                prompt: 'Generate precise search keywords. Target: {targetKeywords}, Seniority: {seniority}',
                model: 'gpt-4o-mini',
                inputSources: ['targetKeywords', 'seniority'],
                outputSchema: [
                  { name: 'keywords', type: 'array<string>', description: 'Precise search keywords' },
                  { name: 'titleFilters', type: 'array<string>', description: 'Job title filters' }
                ],
                outputDestination: 'searchParameters',
                children: [],
                parent: 'root_2'
              },
              filter_2: {
                id: 'filter_2',
                name: 'Seniority Filter',
                prompt: 'Apply seniority and experience filters',
                model: 'gpt-4o-mini',
                inputSources: ['seniority'],
                outputSchema: [
                  { name: 'seniorityFilter', type: 'string', description: 'Seniority filter' },
                  { name: 'experienceFilter', type: 'string', description: 'Experience range filter' }
                ],
                outputDestination: 'filters',
                children: [],
                parent: 'root_2'
              }
            },
            edges: [
              { from: 'root_2', to: 'search_param_2' },
              { from: 'root_2', to: 'filter_2' }
            ]
          }
        }
      ]
    };
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
}
