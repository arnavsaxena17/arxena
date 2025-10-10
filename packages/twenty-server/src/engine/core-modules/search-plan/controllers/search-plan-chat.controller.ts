import { Body, Controller, Get, Headers, HttpException, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CandidateSearchService } from 'src/engine/core-modules/candidate-search/services/candidate-search.service';
import { ParsedJobDescription } from 'src/engine/core-modules/candidate-search/types/candidate-search-request.type';
import { ParameterResolver } from 'src/engine/core-modules/candidate-search/utils/parameter-resolver.util';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { LinkedInSessionTrackerService } from 'src/engine/core-modules/linkedin-search/services/linkedin-session-tracker.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { graphqlToFindManyJobs, graphqlToFindManySearchFilters, UpdateOneSearchFilter } from 'twenty-shared';
import { SearchPlanAIService } from '../services/search-plan-ai.service';

@Controller('search-plan-chat')
@UseGuards(JwtAuthGuard)
export class SearchPlanChatController {
  constructor(
    private readonly searchPlanAIService: SearchPlanAIService,
    private readonly candidateSearchService: CandidateSearchService,
    private readonly parameterResolver: ParameterResolver,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly linkedInRequestTracker: LinkedInSessionTrackerService,
  ) {}

  @Post(':searchFilterId/message')
  async sendMessage(
    @Param('searchFilterId') searchFilterId: string,
    @Body() { message }: { message: string },
    @Headers() headers: any
  ) {
    try {
      const apiToken = headers.authorization.split(' ')[1];
      
      if (!message?.trim()) {
        throw new HttpException('Message is required', HttpStatus.BAD_REQUEST);
      }

      // Analyze intent
      const intent = await this.searchPlanAIService.analyzeIntent(message, apiToken);
      
      let response: string;
      let updatedSearchFilter: any = null;

      switch (intent.type) {
        case 'edit_enrichment':
          if (!intent.enrichmentId) {
            response = 'Please specify which enrichment you want to edit.';
            break;
          }
          await this.searchPlanAIService.processNaturalLanguageEnrichmentEdit(
            searchFilterId,
            intent.enrichmentId,
            message,
            apiToken
          );
          response = 'Enrichment updated successfully!';
          break;
        
        case 'edit_filter':
          await this.searchPlanAIService.processNaturalLanguageFilterEdit(
            searchFilterId,
            message,
            apiToken
          );
          response = 'Filters updated successfully!';
          break;
        
        case 'clarification':
          // Store clarification answer and refine search plan
          response = 'Thank you! I\'ll use this information to refine the search plan.';
          // TODO: Implement clarification processing
          break;
        
        case 'generate_search_params':
          if (!intent.searchType || !intent.searchCategory) {
            response = 'Please specify the search type and category (e.g., "generate sales navigator people parameters").';
            break;
          }
          const params = await this.generateSearchParams(
            searchFilterId,
            intent.searchType,
            intent.searchCategory,
            apiToken
          );
          response = `Generated ${intent.searchType} ${intent.searchCategory} search parameters!`;
          break;
        
        default:
          response = 'I can help you edit enrichments, adjust filters, answer clarification questions, or generate additional search parameters. What would you like to do?';
      }
      
      // Save to chat history
      await this.addChatMessage(searchFilterId, 'user', message, apiToken);
      await this.addChatMessage(searchFilterId, 'assistant', response, apiToken);
      
      return { response, updatedSearchFilter };
    } catch (error) {
      console.error('Error in sendMessage:', error);
      throw new HttpException(
        error.message || 'Failed to process message',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':searchFilterId/generate-params')
  async generateAdditionalParams(
    @Param('searchFilterId') searchFilterId: string,
    @Body() { searchType, searchCategory }: { searchType: string; searchCategory: string },
    @Headers() headers: any
  ) {
    try {
      const apiToken = headers.authorization.split(' ')[1];
      
      if (!searchType || !searchCategory) {
        throw new HttpException('searchType and searchCategory are required', HttpStatus.BAD_REQUEST);
      }

      const params = await this.generateSearchParams(searchFilterId, searchType, searchCategory, apiToken);
      
      return { success: true, params };
    } catch (error) {
      console.error('Error in generateAdditionalParams:', error);
      throw new HttpException(
        error.message || 'Failed to generate parameters',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
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

  private async generateSearchParams(
    searchFilterId: string,
    searchType: string,
    searchCategory: string,
    apiToken: string
  ) {
    try {
      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      
      // Get the job's parsed JD from the search filter's job relation
      const jobQuery = graphqlToFindManyJobs;
      
      const jobResult = await this.staticGraphQLService.executeGraphQL(
        jobQuery,
        { filter: { id: { eq: searchFilter.jobId } } },
        apiToken
      );
      
      const job = jobResult.data?.data?.job;
      
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

      // Generate new search parameters
      const generatedParams = await this.candidateSearchService.generateSearchParameters(
        parsedJD,
        searchType as any,
        searchCategory as any,
        apiToken
      );

      // Resolve to LinkedIn IDs
      const accountId = await this.candidateSearchService.getLinkedInAccountId(apiToken);
      const resolvedParams = await this.parameterResolver.resolveParameterIds(
        generatedParams[`${searchType}${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}Search`],
        searchType as any,
        searchCategory as any,
        accountId
      );

      // Update searchFilter
      const updateMutation = UpdateOneSearchFilter;

      const updatedSearchFilterParameter = {
        ...searchFilter.searchFilterParameter,
        [`${searchType}_${searchCategory}`]: {
          generatedSearchParameters: generatedParams,
          resolvedSearchParameters: resolvedParams,
        },
      };

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

      return {
        searchType,
        searchCategory,
        generatedParameters: generatedParams,
        resolvedParameters: resolvedParams,
      };
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
}
