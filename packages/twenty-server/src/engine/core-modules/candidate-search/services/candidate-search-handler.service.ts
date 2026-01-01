import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { graphqlToFindManySearchFilters, UpdateOneSearchFilter } from 'twenty-shared';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { LinkedInSearchResponse } from '../../linkedin-search/types/linkedin-search-response.type';
import {
    ClassicPeopleSearchStrategyResult,
    GeneratedSearchParameters,
    ParsedJobDescription,
    RecruiterPeopleSearchStrategyResult,
    SalesNavigatorPeopleSearchStrategyResult,
} from '../types/candidate-search-request.type';
import {
    EnrichmentsResponse,
    FiltersResponse,
    GenerateEnrichmentsRequest,
    GenerateFiltersRequest,
    GenerateSortsRequest,
    SortsResponse,
} from '../types/search-plan.types';
import { LinkedinParameterResolver } from '../utils/linkedin-parameter-resolver.util';
import { constructSearchParamKey } from '../utils/search-parameter.utils';
import { CandidateSearchStreamingService } from './candidate-search-streaming.service';
import { CandidateSearchService } from './candidate-search.service';
import { SearchGenerationService } from './search-generation.service';

type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

type SearchExecutionPreview = {
  itemCount: number;
  searchResults: any;
  transformedCandidates?: any;
  searchMetadata?: any;
};

@Injectable()
export class CandidateSearchHandlerService {
  private readonly logger = new Logger(CandidateSearchHandlerService.name);

  constructor(
    private readonly candidateSearchService: CandidateSearchService,
    private readonly candidateSearchStreamingService: CandidateSearchStreamingService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly searchGenerationService: SearchGenerationService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  /**
   * Handle search parameters generation
   */
  async handleSearchParametersGeneration(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    userMessage?: string,
    classificationReasoning?: string,
  ) {
    try {
      const result = await this.generateSearchParametersInternal(
        parsedJD,
        searchType,
        searchCategory,
        searchFilterId,
        apiToken,
        userMessage,
        classificationReasoning,
      );

      return {
        success: true,
        type: 'search_parameters',
        data: result,
        chatMessage: `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`,
      };
    } catch (error) {
      this.logger.error('Error generating search parameters:', error);
      return {
        success: false,
        error: `Failed to generate search parameters: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate search parameters: ${error.message}`,
      };
    }
  }

  /**
   * Handle search parameters generation with streaming
   */
  async handleSearchParametersGenerationStream(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    userMessage?: string,
    classificationReasoning?: string,
    sendEvent?: (event: string, data: any) => void,
  ) {
    try {
      sendEvent?.('status', { message: 'Generating search parameters...' });

      const result = await this.generateSearchParametersAndResultsInternalStream(
        parsedJD,
        searchType,
        searchCategory,
        searchFilterId,
        apiToken,
        userMessage,
        classificationReasoning,
        sendEvent,
      );

      const responseData =
        'generatedParams' in result
          ? { generatedParams: result.generatedParams }
          : {
              generatedSearchParameters: result.generatedSearchParameters,
              resolvedSearchParameters: result.resolvedSearchParameters,
              searchResultsPreview: result.searchResultsPreview,
              strategyResults: result.strategyResults,
            };

      sendEvent?.('message', {
        success: true,
        type: 'search_parameters',
        data: responseData,
        chatMessage: `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`,
      });

      return {
        success: true,
        type: 'search_parameters',
        data: responseData,
        chatMessage: `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`,
      };
    } catch (error) {
      this.logger.error('Error generating search parameters:', error);
      sendEvent?.('error', {
        error: `Failed to generate search parameters: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate search parameters: ${error.message}`,
      });
      return {
        success: false,
        error: `Failed to generate search parameters: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate search parameters: ${error.message}`,
      };
    }
  }

  /**
   * Handle enrichments generation
   */
  async handleEnrichmentsGeneration(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    sampleResults: any[] | undefined,
    apiToken: string,
  ) {
    try {
      const result = await this.generateEnrichments(
        {
          searchFilterId,
          parsedJD,
          sampleResults,
        },
        apiToken,
      );

      return {
        success: true,
        type: 'enrichments',
        data: result.data,
        chatMessage: result.chatMessage,
      };
    } catch (error) {
      this.logger.error('Error generating enrichments:', error);
      return {
        success: false,
        error: `Failed to generate enrichments: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate enrichments: ${error.message}`,
      };
    }
  }

  /**
   * Handle enrichments generation with streaming
   */
  async handleEnrichmentsGenerationStream(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    sampleResults: any[] | undefined,
    apiToken: string,
    sendEvent?: (event: string, data: any) => void,
  ) {
    try {
      sendEvent?.('status', { message: 'Generating enrichments...' });

      const result = await this.generateEnrichments(
        {
          searchFilterId,
          parsedJD,
          sampleResults,
        },
        apiToken,
      );

      sendEvent?.('message', {
        success: true,
        type: 'enrichments',
        data: result.data,
        chatMessage: result.chatMessage,
      });

      return {
        success: true,
        type: 'enrichments',
        data: result.data,
        chatMessage: result.chatMessage,
      };
    } catch (error) {
      this.logger.error('Error generating enrichments:', error);
      sendEvent?.('error', {
        error: `Failed to generate enrichments: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate enrichments: ${error.message}`,
      });
      return {
        success: false,
        error: `Failed to generate enrichments: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate enrichments: ${error.message}`,
      };
    }
  }

  /**
   * Handle filters generation
   */
  async handleFiltersGeneration(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    sampleResults: any[] | undefined,
    dataDistribution:
      | Record<string, { min: number; max: number; avg: number; count: number }>
      | undefined,
    apiToken: string,
  ) {
    try {
      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      const enrichments = searchFilter.enrichmentConfigs || [];

      if (enrichments.length === 0) {
        return {
          success: false,
          error: 'Enrichments must be generated before filters',
          chatMessage: 'Please generate enrichments first before creating filters.',
        };
      }

      const enrichmentsResponse: EnrichmentsResponse = {
        enrichments,
        overallStrategy: 'Generated enrichments',
        reasoning: 'Using existing enrichments',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasSampleData: !!sampleResults,
          sampleDataSize: sampleResults?.length ?? null,
        },
      };

      const result = await this.generateFilters(
        {
          searchFilterId,
          parsedJD,
          enrichments: enrichmentsResponse,
          sampleResults,
          dataDistribution,
        },
        apiToken,
      );

      return {
        success: true,
        type: 'filters',
        data: result.data,
        chatMessage: result.chatMessage,
      };
    } catch (error) {
      this.logger.error('Error generating filters:', error);
      return {
        success: false,
        error: `Failed to generate filters: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate filters: ${error.message}`,
      };
    }
  }

  /**
   * Handle filters generation with streaming
   */
  async handleFiltersGenerationStream(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    sampleResults: any[] | undefined,
    dataDistribution:
      | Record<string, { min: number; max: number; avg: number; count: number }>
      | undefined,
    apiToken: string,
    sendEvent?: (event: string, data: any) => void,
  ) {
    try {
      sendEvent?.('status', { message: 'Generating filters...' });

      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      const enrichments = searchFilter.enrichmentConfigs || [];

      if (enrichments.length === 0) {
        sendEvent?.('error', {
          error: 'Enrichments must be generated before filters',
          chatMessage: 'Please generate enrichments first before creating filters.',
        });
        return {
          success: false,
          error: 'Enrichments must be generated before filters',
          chatMessage: 'Please generate enrichments first before creating filters.',
        };
      }

      const enrichmentsResponse: EnrichmentsResponse = {
        enrichments,
        overallStrategy: 'Generated enrichments',
        reasoning: 'Using existing enrichments',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasSampleData: !!sampleResults,
          sampleDataSize: sampleResults?.length ?? null,
        },
      };

      const result = await this.generateFilters(
        {
          searchFilterId,
          parsedJD,
          enrichments: enrichmentsResponse,
          sampleResults,
          dataDistribution,
        },
        apiToken,
      );

      sendEvent?.('message', {
        success: true,
        type: 'filters',
        data: result.data,
        chatMessage: result.chatMessage,
      });

      return {
        success: true,
        type: 'filters',
        data: result.data,
        chatMessage: result.chatMessage,
      };
    } catch (error) {
      this.logger.error('Error generating filters:', error);
      sendEvent?.('error', {
        error: `Failed to generate filters: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate filters: ${error.message}`,
      });
      return {
        success: false,
        error: `Failed to generate filters: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate filters: ${error.message}`,
      };
    }
  }

  /**
   * Handle sorts generation
   */
  async handleSortsGeneration(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    sampleResults: any[] | undefined,
    apiToken: string,
  ) {
    try {
      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      const enrichments = searchFilter.enrichmentConfigs || [];
      const filters = searchFilter.columnFilters || [];

      if (enrichments.length === 0) {
        return {
          success: false,
          error: 'Enrichments must be generated before sorts',
          chatMessage: 'Please generate enrichments first before creating sorts.',
        };
      }

      if (filters.length === 0) {
        return {
          success: false,
          error: 'Filters must be generated before sorts',
          chatMessage: 'Please generate filters first before creating sorts.',
        };
      }

      const enrichmentsResponse: EnrichmentsResponse = {
        enrichments,
        overallStrategy: 'Generated enrichments',
        reasoning: 'Using existing enrichments',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasSampleData: !!sampleResults,
          sampleDataSize: sampleResults?.length ?? null,
        },
      };

      const filtersResponse: FiltersResponse = {
        filterStrategy: {
          name: 'Generated filter strategy',
          description: 'Using existing filters',
          targetShortlistSize: 50,
          priority: 'balanced' as const,
          reasoning: 'Using existing filters',
        },
        handsontableFilters: filters,
        candidateSearchFilters: [],
        reasoning: 'Using existing filters',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasDataDistribution: false,
          dataDistributionFields: null,
          hasSampleData: !!sampleResults,
          sampleDataSize: sampleResults?.length ?? null,
        },
      };

      const searchParameters =
        searchFilter.searchFilterParameter?.generatedSearchParameters || {};

      const result = await this.generateSorts(
        {
          searchFilterId,
          parsedJD,
          searchParameters,
          enrichments: enrichmentsResponse,
          filters: filtersResponse,
          sampleResults,
        },
        apiToken,
      );

      return {
        success: true,
        type: 'sorts',
        data: result.data,
        chatMessage: result.chatMessage,
      };
    } catch (error) {
      this.logger.error('Error generating sorts:', error);
      return {
        success: false,
        error: `Failed to generate sorts: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate sorts: ${error.message}`,
      };
    }
  }

  /**
   * Handle sorts generation with streaming
   */
  async handleSortsGenerationStream(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    sampleResults: any[] | undefined,
    apiToken: string,
    sendEvent?: (event: string, data: any) => void,
  ) {
    try {
      sendEvent?.('status', { message: 'Generating sorts...' });

      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      const enrichments = searchFilter.enrichmentConfigs || [];
      const filters = searchFilter.columnFilters || [];

      if (enrichments.length === 0) {
        sendEvent?.('error', {
          error: 'Enrichments must be generated before sorts',
          chatMessage: 'Please generate enrichments first before creating sorts.',
        });
        return {
          success: false,
          error: 'Enrichments must be generated before sorts',
          chatMessage: 'Please generate enrichments first before creating sorts.',
        };
      }

      if (filters.length === 0) {
        sendEvent?.('error', {
          error: 'Filters must be generated before sorts',
          chatMessage: 'Please generate filters first before creating sorts.',
        });
        return {
          success: false,
          error: 'Filters must be generated before sorts',
          chatMessage: 'Please generate filters first before creating sorts.',
        };
      }

      const enrichmentsResponse: EnrichmentsResponse = {
        enrichments,
        overallStrategy: 'Generated enrichments',
        reasoning: 'Using existing enrichments',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasSampleData: !!sampleResults,
          sampleDataSize: sampleResults?.length ?? null,
        },
      };

      const filtersResponse: FiltersResponse = {
        filterStrategy: {
          name: 'Generated filter strategy',
          description: 'Using existing filters',
          targetShortlistSize: 50,
          priority: 'balanced' as const,
          reasoning: 'Using existing filters',
        },
        handsontableFilters: filters,
        candidateSearchFilters: [],
        reasoning: 'Using existing filters',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasDataDistribution: false,
          dataDistributionFields: null,
          hasSampleData: !!sampleResults,
          sampleDataSize: sampleResults?.length ?? null,
        },
      };

      const searchParameters =
        searchFilter.searchFilterParameter?.generatedSearchParameters || {};

      const result = await this.generateSorts(
        {
          searchFilterId,
          parsedJD,
          searchParameters,
          enrichments: enrichmentsResponse,
          filters: filtersResponse,
          sampleResults,
        },
        apiToken,
      );

      sendEvent?.('message', {
        success: true,
        type: 'sorts',
        data: result.data,
        chatMessage: result.chatMessage,
      });

      return {
        success: true,
        type: 'sorts',
        data: result.data,
        chatMessage: result.chatMessage,
      };
    } catch (error) {
      this.logger.error('Error generating sorts:', error);
      sendEvent?.('error', {
        error: `Failed to generate sorts: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate sorts: ${error.message}`,
      });
      return {
        success: false,
        error: `Failed to generate sorts: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate sorts: ${error.message}`,
      };
    }
  }

  /**
   * Handle complete plan generation (all components)
   */
  async handleCompletePlanGeneration(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    sampleResults: any[] | undefined,
    dataDistribution:
      | Record<string, { min: number; max: number; avg: number; count: number }>
      | undefined,
    apiToken: string,
    userMessage?: string,
    classificationReasoning?: string,
  ) {
    try {
      const results: any = {};

      const searchParamsResult = await this.handleSearchParametersGeneration(
        searchFilterId,
        parsedJD,
        searchType,
        searchCategory,
        apiToken,
        userMessage,
        classificationReasoning,
      );
      results.searchParameters = searchParamsResult;

      const enrichmentsResult = await this.handleEnrichmentsGeneration(
        searchFilterId,
        parsedJD,
        sampleResults,
        apiToken,
      );
      results.enrichments = enrichmentsResult;

      const filtersResult = await this.handleFiltersGeneration(
        searchFilterId,
        parsedJD,
        sampleResults,
        dataDistribution,
        apiToken,
      );
      results.filters = filtersResult;

      const sortsResult = await this.handleSortsGeneration(
        searchFilterId,
        parsedJD,
        sampleResults,
        apiToken,
      );
      results.sorts = sortsResult;

      const successCount = Object.values(results).filter(
        (r: any) => r.success,
      ).length;
      const totalCount = Object.keys(results).length;

      return {
        success: successCount === totalCount,
        type: 'complete_plan',
        data: results,
        chatMessage: `Generated complete search plan with ${successCount}/${totalCount} components successfully.`,
      };
    } catch (error) {
      this.logger.error('Error generating complete plan:', error);
      return {
        success: false,
        error: `Failed to generate complete plan: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate the complete plan: ${error.message}`,
      };
    }
  }

  /**
   * Handle complete plan generation with streaming
   */
  async handleCompletePlanGenerationStream(
    searchFilterId: string,
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    sampleResults: any[] | undefined,
    dataDistribution:
      | Record<string, { min: number; max: number; avg: number; count: number }>
      | undefined,
    apiToken: string,
    userMessage?: string,
    classificationReasoning?: string,
    sendEvent?: (event: string, data: any) => void,
  ) {
    try {
      const results: any = {};

      sendEvent?.('status', { message: 'Generating complete search plan...' });

      sendEvent?.('status', {
        message: 'Step 1/4: Generating search parameters...',
      });
      const searchParamsResult = await this.handleSearchParametersGenerationStream(
        searchFilterId,
        parsedJD,
        searchType,
        searchCategory,
        apiToken,
        userMessage,
        classificationReasoning,
        sendEvent,
      );
      results.searchParameters = searchParamsResult;

      sendEvent?.('status', { message: 'Step 2/4: Generating enrichments...' });
      const enrichmentsResult = await this.handleEnrichmentsGenerationStream(
        searchFilterId,
        parsedJD,
        sampleResults,
        apiToken,
        sendEvent,
      );
      results.enrichments = enrichmentsResult;

      sendEvent?.('status', { message: 'Step 3/4: Generating filters...' });
      const filtersResult = await this.handleFiltersGenerationStream(
        searchFilterId,
        parsedJD,
        sampleResults,
        dataDistribution,
        apiToken,
        sendEvent,
      );
      results.filters = filtersResult;

      sendEvent?.('status', { message: 'Step 4/4: Generating sorts...' });
      const sortsResult = await this.handleSortsGenerationStream(
        searchFilterId,
        parsedJD,
        sampleResults,
        apiToken,
        sendEvent,
      );
      results.sorts = sortsResult;

      const successCount = Object.values(results).filter(
        (r: any) => r.success,
      ).length;
      const totalCount = Object.keys(results).length;

      sendEvent?.('message', {
        success: successCount === totalCount,
        type: 'complete_plan',
        data: results,
        chatMessage: `Generated complete search plan with ${successCount}/${totalCount} components successfully.`,
      });

      return {
        success: successCount === totalCount,
        type: 'complete_plan',
        data: results,
        chatMessage: `Generated complete search plan with ${successCount}/${totalCount} components successfully.`,
      };
    } catch (error) {
      this.logger.error('Error generating complete plan:', error);
      sendEvent?.('error', {
        error: `Failed to generate complete plan: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate the complete plan: ${error.message}`,
      });
      return {
        success: false,
        error: `Failed to generate complete plan: ${error.message}`,
        chatMessage: `Sorry, I couldn't generate the complete plan: ${error.message}`,
      };
    }
  }

  // Private helper methods

  private async executeSearchPreview(
    parsedJobDescription: ParsedJobDescription,
    generatedParams: GeneratedSearchParameters,
    resolvedParams: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
  ): Promise<SearchExecutionPreview | null> {
    try {
      const parameterKey = constructSearchParamKey(
        searchType,
        searchCategory,
      );
      const resolvedHasData = Boolean(
        resolvedParams?.[parameterKey] &&
          Object.keys(resolvedParams[parameterKey] || {}).length > 0,
      );
      const paramsForExecution = resolvedHasData ? resolvedParams : generatedParams;

      if (!paramsForExecution?.[parameterKey]) {
        this.logger.warn(
          `No ${parameterKey} parameters available for automatic LinkedIn search preview. Skipping.`,
        );
        return null;
      }

      const previewLimit = Number(process.env.AUTO_SEARCH_PREVIEW_LIMIT ?? 25);
      const response = await this.candidateSearchService.searchCandidatesWithParameters(
        parsedJobDescription,
        paramsForExecution,
        searchType,
        searchCategory,
        apiToken,
        { limit: previewLimit },
      );

      return {
        itemCount: response.searchResults?.items?.length ?? 0,
        searchResults: response.searchResults,
        transformedCandidates: response.transformedCandidates,
        searchMetadata: response.searchMetadata,
      };
    } catch (error) {
      this.logger.error('Automatic LinkedIn search preview failed', error);
      return null;
    }
  }

  private async executeSearchPreviewsForStrategies(
    parsedJobDescription: ParsedJobDescription,
    strategies: PeopleSearchStrategyResult[],
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    parameterKey: string,
  ): Promise<Array<{ strategyId: string; preview: SearchExecutionPreview | null }>> {
    const previewLimit = Number(process.env.AUTO_SEARCH_PREVIEW_LIMIT ?? 25);
    const results: Array<{
      strategyId: string;
      preview: SearchExecutionPreview | null;
    }> = [];

    for (const strategy of strategies) {
      try {
        if (!strategy.parameters) {
          this.logger.warn(
            `Strategy ${strategy.id} has no parameters, skipping search preview`,
          );
          results.push({ strategyId: strategy.id, preview: null });
          continue;
        }

        const strategyResolvedParams: GeneratedSearchParameters = {
          [parameterKey]: strategy.parameters,
        } as GeneratedSearchParameters;

        this.logger.log(
          `Executing search preview for strategy ${strategy.id} (${strategy.label || 'unnamed'})`,
        );

        const response = await this.candidateSearchService.searchCandidatesWithParameters(
          parsedJobDescription,
          strategyResolvedParams,
          searchType,
          searchCategory,
          apiToken,
          { limit: previewLimit },
        );

        results.push({
          strategyId: strategy.id,
          preview: {
            itemCount: response.searchResults?.items?.length ?? 0,
            searchResults: response.searchResults,
            transformedCandidates: response.transformedCandidates,
            searchMetadata: response.searchMetadata,
          },
        });

        this.logger.log(
          `Strategy ${strategy.id} preview completed: ${response.searchResults?.items?.length ?? 0} candidates found`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to execute search preview for strategy ${strategy.id}:`,
          error,
        );
        results.push({ strategyId: strategy.id, preview: null });
      }
    }

    return results;
  }

async getSearchFilter(searchFilterId: string, apiToken: string) {
    const query = graphqlToFindManySearchFilters;

    const result = await this.staticGraphQLService.executeGraphQL(
      query,
      { filter: { id: { eq: searchFilterId } } },
      apiToken,
    );

    if (!result.data?.data?.searchFilters?.edges?.[0]?.node) {
      throw new HttpException('Search filter not found', HttpStatus.NOT_FOUND);
    }
    return result.data.data.searchFilters.edges[0].node;
  }

  async getSearchParameters(
    searchFilterId: string,
    apiToken: string,
  ): Promise<GeneratedSearchParameters | null> {
    try {
      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      const searchParameters =
        searchFilter.searchFilterParameter?.generatedSearchParameters;

      this.logger.log(
        `Search parameters for searchFilterId: ${searchFilterId}`,
        JSON.stringify(searchParameters, null, 2),
      );
      return searchParameters || null;
    } catch (error) {
      this.logger.error('Error getting search parameters:', error);
      return null;
    }
  }

  async addChatMessage(
    searchFilterId: string,
    role: 'user' | 'assistant',
    content: string,
    apiToken: string,
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
          chatHistory: updatedHistory,
        },
      },
      apiToken,
    );
  }

  private async updateSearchFilterParameters(
    searchFilterId: string,
    updatedSearchFilterParameter: any,
    chatHistory: any,
    apiToken: string,
  ): Promise<void> {
    const updateMutation = UpdateOneSearchFilter;
    await this.staticGraphQLService.executeGraphQL(
      updateMutation,
      {
        idToUpdate: searchFilterId,
        input: {
          searchFilterParameter: updatedSearchFilterParameter,
          chatHistory: chatHistory,
        },
      },
      apiToken,
    );
  }

  async generateSearchParametersInternal(
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    searchFilterId: string,
    apiToken: string,
    userMessage?: string,
    classificationReasoning?: string,
  ): Promise<{
    generatedSearchParameters: GeneratedSearchParameters;
    resolvedSearchParameters: GeneratedSearchParameters;
    chatMessage: string;
    searchResultsPreview?: SearchExecutionPreview;
    strategyResults?: Array<{ strategy: PeopleSearchStrategyResult; preview: SearchExecutionPreview | null }>;
  } | {
    generatedParams: GeneratedSearchParameters;
  }> {
    try {
      if (!parsedJobDescription) {
        throw new HttpException(
          'Parsed job description is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!searchType || !searchCategory) {
        throw new HttpException(
          'Search type and category are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      this.logger.log(`searchFilter:: ${JSON.stringify(searchFilter, null, 2)}`);

      const jobId = searchFilter?.jobId;

      this.logger.log(
        `Generating search parameters for ${searchType} ${searchCategory}`,
      );
      if (userMessage) {
        this.logger.log(`User message: ${userMessage}`);
      }
      if (classificationReasoning) {
        this.logger.log(`Classification reasoning: ${classificationReasoning}`);
      }
      if (jobId) {
        this.logger.log(`JobId: ${jobId}`);
      }

      const generatedParams =
        await this.candidateSearchService.generateSearchParametersFromLLM(
          parsedJobDescription,
          searchType,
          searchCategory,
          apiToken,
          userMessage,
          classificationReasoning,
          jobId,
        );

      if (!generatedParams) {
        throw new HttpException(
          'Failed to generate search parameters',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const accountId = await this.candidateSearchService.getLinkedInAccountId(
        apiToken,
      );
      const searchParamKey = constructSearchParamKey(
        searchType,
        searchCategory,
      );
      this.logger.log(`searchParamKey:: ${searchParamKey}`);
      const searchParams = generatedParams[searchParamKey];
      let resolvedParams = {};

      if (!searchParams) {
        this.logger.warn(
          `No search parameters generated for ${searchParamKey}, using empty object`,
        );
      } else {
        resolvedParams = await this.linkedinParameterResolver.resolveParameterIds(
          searchParams,
          searchType,
          searchCategory,
          accountId,
        );
      }
      const updateMutation = UpdateOneSearchFilter;
      const parameterKey = constructSearchParamKey(searchType, searchCategory);

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
      await this.staticGraphQLService.executeGraphQL(
        updateMutation,
        {
          idToUpdate: searchFilter.id,
          input: {
            searchFilterParameter: updatedSearchFilterParameter,
            chatHistory: searchFilter.chatHistory,
          },
        },
        apiToken,
      );

      const chatMessage = `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`;
      await this.addChatMessage(searchFilterId, 'assistant', chatMessage, apiToken);

      const resolvedSearchParametersPayload: GeneratedSearchParameters = {
        [parameterKey]: resolvedParams,
      } as GeneratedSearchParameters;

      const searchResultsPreview = await this.executeSearchPreview(
        parsedJobDescription,
        generatedParams,
        resolvedSearchParametersPayload,
        searchType,
        searchCategory,
        apiToken,
      );

      // Extract strategies based on search type
      let strategies: PeopleSearchStrategyResult[] = [];
      if (searchType === 'classic' && searchCategory === 'people') {
        strategies = generatedParams.classicPeopleSearchStrategies || [];
      } else if (searchType === 'sales_navigator' && searchCategory === 'people') {
        strategies = generatedParams.salesNavigatorPeopleSearchStrategies || [];
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        strategies = generatedParams.recruiterPeopleSearchStrategies || [];
      }

      this.logger.log(`Found ${strategies.length} strategies to execute searches for ${searchType} ${searchCategory}`);
      this.logger.log(
        `GeneratedParams keys: ${Object.keys(generatedParams).join(', ')}`,
      );
      if (strategies.length > 0) {
        this.logger.log(
          `Strategy IDs: ${strategies.map((s) => s.id).join(', ')}`,
        );
      }
      let strategyResults: Array<{
        strategy: PeopleSearchStrategyResult;
        preview: SearchExecutionPreview | null;
      }> = [];

      if (strategies.length > 0) {
        this.logger.log(
          `Executing searches for ${strategies.length} strategies...`,
        );
        const strategyPreviews = await this.executeSearchPreviewsForStrategies(
          parsedJobDescription,
          strategies,
          searchType,
          searchCategory,
          apiToken,
          parameterKey,
        );

        strategyResults = strategies.map((strategy) => {
          const preview =
            strategyPreviews.find((sp) => sp.strategyId === strategy.id)?.preview ||
            null;
          return { strategy, preview };
        });

        this.logger.log(
          `Completed searches for ${strategies.length} strategies, ${strategyResults.filter((sr) => sr.preview).length} with results`,
        );
      } else {
        this.logger.log(
          `No strategies found for ${searchType} ${searchCategory}. Available keys:`,
          Object.keys(generatedParams),
        );
      }

      return {
        generatedSearchParameters: generatedParams,
        resolvedSearchParameters: resolvedSearchParametersPayload,
        chatMessage,
        searchResultsPreview: searchResultsPreview ?? undefined,
        strategyResults:
          strategyResults.length > 0 ? strategyResults : undefined,
      };
    } catch (error) {
      this.logger.error('Error generating search parameters:', error);
      throw error;
    }
  }

  private async generateSearchParametersAndResultsInternalStream(
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    searchFilterId: string,
    apiToken: string,
    userMessage?: string,
    classificationReasoning?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<{
    generatedSearchParameters: GeneratedSearchParameters;
    resolvedSearchParameters: GeneratedSearchParameters;
    chatMessage: string;
    searchResultsPreview?: SearchExecutionPreview;
    strategyResults?: Array<{ strategy: PeopleSearchStrategyResult; preview: SearchExecutionPreview | null }>;
  } | {
    generatedParams: GeneratedSearchParameters;
  }> {
    try {
      if (!parsedJobDescription) {
        throw new HttpException(
          'Parsed job description is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!searchType || !searchCategory) {
        throw new HttpException(
          'Search type and category are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
      this.logger.log(`searchFilter:: ${JSON.stringify(searchFilter, null, 2)}`);

      const jobId = searchFilter?.jobId;

      this.logger.log(
        `Generating search parameters for ${searchType} ${searchCategory}`,
      );
      if (userMessage) {
        this.logger.log(`User message: ${userMessage}`);
      }
      if (classificationReasoning) {
        this.logger.log(`Classification reasoning: ${classificationReasoning}`);
      }
      if (jobId) {
        this.logger.log(`JobId: ${jobId}`);
      }

      sendEvent?.('status', { message: 'Connecting to AI model...' });

      const generatedParams =
        await this.candidateSearchStreamingService.streamSearchParametersAndStrategies(
          parsedJobDescription,
          searchType,
          searchCategory,
          apiToken,
          userMessage,
          classificationReasoning,
          jobId,
          sendEvent,
        );

      if (!generatedParams) {
        throw new HttpException(
          'Failed to generate search parameters',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const accountId = await this.candidateSearchService.getLinkedInAccountId(
        apiToken,
      );
      const searchParamKey = constructSearchParamKey(
        searchType,
        searchCategory,
      );
      this.logger.log(`searchParamKey:: ${searchParamKey}`);
      const searchParams = generatedParams[searchParamKey];
      let resolvedParams = {};

      if (!searchParams) {
        this.logger.warn(
          `No search parameters generated for ${searchParamKey}, using empty object`,
        );
      } else {
        sendEvent?.('status', { message: 'Resolving parameter IDs...' });
        resolvedParams = await this.linkedinParameterResolver.resolveParameterIds(
          searchParams,
          searchType,
          searchCategory,
          accountId,
        );
      }

    //   const parameterKey = constructSearchParamKey(searchType, searchCategory);

      const updatedSearchFilterParameter = {
        ...searchFilter.searchFilterParameter,
        generatedSearchParameters: {
          ...searchFilter.searchFilterParameter?.generatedSearchParameters,
          [searchParamKey]: generatedParams[searchParamKey],
        },
        resolvedSearchParameters: {
          ...searchFilter.searchFilterParameter?.resolvedSearchParameters,
          [searchParamKey]: resolvedParams,
        },
      };

      sendEvent?.('status', { message: 'Saving parameters...' });

      await this.updateSearchFilterParameters(
        searchFilter.id,
        updatedSearchFilterParameter,
        searchFilter.chatHistory,
        apiToken,
      );

      const chatMessage = `Generated search parameters for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`;
      await this.addChatMessage(searchFilterId, 'assistant', chatMessage, apiToken);

      const resolvedSearchParametersPayload: GeneratedSearchParameters = {
        [searchParamKey]: resolvedParams,
      } as GeneratedSearchParameters;

      // Extract strategies based on search type
      let strategies: PeopleSearchStrategyResult[] = [];
      if (searchType === 'classic' && searchCategory === 'people') {
        strategies = generatedParams.classicPeopleSearchStrategies || [];
      } else if (searchType === 'sales_navigator' && searchCategory === 'people') {
        strategies = generatedParams.salesNavigatorPeopleSearchStrategies || [];
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        strategies = generatedParams.recruiterPeopleSearchStrategies || [];
      }

      this.logger.log(
        `Found ${strategies.length} strategies to execute searches for ${searchType} ${searchCategory}`,
      );
      let strategyResults: Array<{
        strategy: PeopleSearchStrategyResult;
        preview: SearchExecutionPreview | null;
      }> = [];

      if (strategies.length > 0) {
        this.logger.log(
          `Executing searches for ${strategies.length} strategies...`,
        );
        sendEvent?.('status', {
          message: `Executing searches for ${strategies.length} strategies...`,
        });
        const strategyPreviews = await this.executeSearchPreviewsForStrategies(
          parsedJobDescription,
          strategies,
          searchType,
          searchCategory,
          apiToken,
          searchParamKey,
        );

        strategyResults = strategies.map((strategy) => {
          const preview =
            strategyPreviews.find((sp) => sp.strategyId === strategy.id)?.preview ||
            null;
          return { strategy, preview };
        });

        this.logger.log(
          `Completed searches for ${strategies.length} strategies, ${strategyResults.filter((sr) => sr.preview).length} with results`,
        );
        sendEvent?.('status', {
          message: `Completed searches for ${strategies.length} strategies`,
        });
      } else {
        this.logger.log(
          `No strategies found for ${searchType} ${searchCategory}`,
        );
      }

      return {
        generatedSearchParameters: generatedParams,
        resolvedSearchParameters: resolvedSearchParametersPayload,
        chatMessage,
        searchResultsPreview: {
          itemCount: 0,
          searchResults: [] as unknown as LinkedInSearchResponse[],
        } as unknown as SearchExecutionPreview,
        strategyResults:
          strategyResults.length > 0 ? strategyResults : undefined,
      };
    } catch (error) {
      this.logger.error('Error generating search parameters:', error);
      throw error;
    }
  }

  private async generateEnrichments(
    request: GenerateEnrichmentsRequest,
    apiToken: string,
  ) {
    const searchFilter = await this.getSearchFilter(
      request.searchFilterId,
      apiToken,
    );
    const searchParameters = searchFilter.searchFilterParameter
      ?.generatedSearchParameters;

    if (!searchParameters) {
      throw new Error('Search parameters must be generated before enrichments');
    }

    const enrichments = await this.searchGenerationService.generateEnrichments(
      request.parsedJD,
      searchParameters,
      request.sampleResults,
      apiToken,
    );

    await this.storeEnrichments(
      request.searchFilterId,
      enrichments,
      apiToken,
    );

    const chatMessage = `Generated ${enrichments.enrichments.length} enrichment configurations for candidate evaluation.`;

    await this.addChatMessage(
      request.searchFilterId,
      'assistant',
      chatMessage,
      apiToken,
    );

    return {
      success: true,
      data: enrichments,
      chatMessage,
    };
  }

  private async generateFilters(
    request: GenerateFiltersRequest,
    apiToken: string,
  ) {
    const filters = await this.searchGenerationService.generateFilters(
      request.parsedJD,
      request.enrichments,
      request.sampleResults,
      request.dataDistribution,
      apiToken,
    );

    await this.storeFilters(request.searchFilterId, filters, apiToken);

    const chatMessage = `Generated filter strategy with ${filters.handsontableFilters.length} Handsontable filters and ${filters.candidateSearchFilters.length} CandidateSearch filters.`;

    await this.addChatMessage(
      request.searchFilterId,
      'assistant',
      chatMessage,
      apiToken,
    );

    return {
      success: true,
      data: filters,
      chatMessage,
    };
  }

  private async generateSorts(request: GenerateSortsRequest, apiToken: string) {
    const sorts = await this.searchGenerationService.generateSorts(
      request.parsedJD,
      request.searchParameters,
      request.enrichments,
      request.filters,
      request.sampleResults,
      apiToken,
    );

    await this.storeSorts(request.searchFilterId, sorts, apiToken);

    const chatMessage = `Generated multi-column sorting strategy with ${sorts.sortStrategy.sortColumns.length} sort columns. The sorting configuration prioritizes candidates based on ${sorts.sortStrategy.name}.`;

    await this.addChatMessage(
      request.searchFilterId,
      'assistant',
      chatMessage,
      apiToken,
    );

    return {
      success: true,
      data: sorts,
      chatMessage,
    };
  }

  async storeEnrichments(
    searchFilterId: string,
    enrichments: EnrichmentsResponse,
    apiToken: string,
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
        },
      },
      apiToken,
    );
  }

  async storeFilters(
    searchFilterId: string,
    filters: FiltersResponse,
    apiToken: string,
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
        },
      },
      apiToken,
    );
  }

  async storeSorts(
    searchFilterId: string,
    sorts: SortsResponse,
    apiToken: string,
  ) {
    const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);

    const updateMutation = UpdateOneSearchFilter;

    await this.staticGraphQLService.executeGraphQL(
      updateMutation,
      {
        idToUpdate: searchFilterId,
        input: {
          sortColumns: sorts.sortStrategy.sortColumns,
          sortStrategyName: sorts.sortStrategy.name,
          sortStrategyDescription: sorts.sortStrategy.description,
          sortStrategyReasoning: sorts.sortStrategy.reasoning,
          columnSortConfigs: sorts.sortStrategy,
          chatHistory: searchFilter.chatHistory,
        },
      },
      apiToken,
    );
  }
}

