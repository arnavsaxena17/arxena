import { Body, Controller, Headers, Logger, Post } from '@nestjs/common';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { CandidateSearchService } from '../../candidate-search/services/candidate-search.service';
import { SearchPlanGenerationService } from '../services/search-plan-generation.service';
import {
  EnrichmentsResponse,
  FiltersResponse,
  GenerateEnrichmentsRequest,
  GenerateFiltersRequest,
  GenerateSearchParametersRequest,
  SearchParametersResponse,
  SearchPlanChatMessage
} from '../types/search-plan.types';

@Controller('search-plan-generation')
export class SearchPlanGenerationController {
  private readonly logger = new Logger(SearchPlanGenerationController.name);

  constructor(
    private readonly searchPlanGenerationService: SearchPlanGenerationService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly candidateSearchService: CandidateSearchService,
    private readonly linkedInSearchService: LinkedInSearchService,
  ) {}

  @Post('generate-complete-plan')
  async generateCompletePlan(
    @Body() body: {
      jdText: string;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'jobs';
      searchFilterId?: string;
      sampleResults?: any[];
      dataDistribution?: Record<string, { min: number; max: number; avg: number; count: number }>;
    },
    @Headers() headers: any
  ) {
    try {
      this.logger.log('Generating complete search plan from JD text');
      
      const apiToken = this.extractApiToken(headers);
      if (!apiToken) {
        throw new Error('API token is required');
      }

      // Step 1: Parse JD text
      this.logger.log('Parsing job description...');
      const parsedJD = await this.candidateSearchService.parseJobDescription(
        { jobDescription: body.jdText },
        apiToken
      );

      // Step 2: Generate search parameters
      this.logger.log('Generating search parameters...');
      const searchParameters = await this.searchPlanGenerationService.generateSearchParameters(
        parsedJD,
        body.searchType,
        body.searchCategory,
        apiToken
      );

      // Step 3: Perform LinkedIn search to get sample results
      this.logger.log('Performing LinkedIn search to get sample results...');
      const sampleResults = await this.performLinkedInSearchForSample(
        searchParameters,
        body.searchType,
        body.searchCategory,
        apiToken
      );

      // Step 4: Generate enrichments with sample results
      this.logger.log('Generating enrichments...');
      const enrichments = await this.searchPlanGenerationService.generateEnrichments(
        parsedJD,
        searchParameters,
        sampleResults,
        apiToken
      );

      // Step 5: Generate filters with enriched sample results
      this.logger.log('Generating filters...');
      const filters = await this.searchPlanGenerationService.generateFilters(
        parsedJD,
        enrichments,
        sampleResults, // Pass enriched sample results
        body.dataDistribution,
        apiToken
      );

      // Step 5: Store everything if searchFilterId is provided
      if (body.searchFilterId) {
        this.logger.log(`Storing complete plan for searchFilterId: ${body.searchFilterId}`);
        
        await this.storeSearchParameters(body.searchFilterId, searchParameters, apiToken);
        await this.storeEnrichments(body.searchFilterId, enrichments, apiToken);
        await this.storeFilters(body.searchFilterId, filters, apiToken);

        // Create chat messages
        const searchParamsChatMessage = this.createSearchParametersChatMessage(searchParameters);
        const enrichmentsChatMessage = this.createEnrichmentsChatMessage(enrichments);
        const filtersChatMessage = this.createFiltersChatMessage(filters);

        await this.addChatMessage(body.searchFilterId, searchParamsChatMessage, apiToken);
        await this.addChatMessage(body.searchFilterId, enrichmentsChatMessage, apiToken);
        await this.addChatMessage(body.searchFilterId, filtersChatMessage, apiToken);
      }

      this.logger.log('Complete search plan generated successfully');

      return {
        success: true,
        data: {
          parsedJD,
          searchParameters,
          enrichments,
          filters
        },
        searchFilterId: body.searchFilterId
      };

    } catch (error) {
      this.logger.error('Error generating complete search plan:', error);
      return {
        success: false,
        error: `Failed to generate complete search plan: ${error.message}`
      };
    }
  }

  @Post('generate-search-parameters')
  async generateSearchParameters(
    @Body() body: GenerateSearchParametersRequest,
    @Headers() headers: any
  ) {
    try {
      this.logger.log(`Generating search parameters for searchFilterId: ${body.searchFilterId}`);
      
      const apiToken = this.extractApiToken(headers);
      if (!apiToken) {
        throw new Error('API token is required');
      }

      // Generate search parameters
      const searchParameters = await this.searchPlanGenerationService.generateSearchParameters(
        body.parsedJD,
        body.searchType,
        body.searchCategory,
        apiToken
      );

      // Store in database
      await this.storeSearchParameters(body.searchFilterId, searchParameters, apiToken);

      // Create chat message
      const chatMessage = this.createSearchParametersChatMessage(searchParameters);

      // Add chat message to search filter
      await this.addChatMessage(body.searchFilterId, chatMessage, apiToken);

      return {
        success: true,
        data: searchParameters,
        chatMessage
      };

    } catch (error) {
      this.logger.error('Error generating search parameters:', error);
      return {
        success: false,
        error: `Failed to generate search parameters: ${error.message}`
      };
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

      // Generate enrichments
      const enrichments = await this.searchPlanGenerationService.generateEnrichments(
        body.parsedJD,
        searchParameters,
        body.sampleResults,
        apiToken
      );

      // Store in database
      await this.storeEnrichments(body.searchFilterId, enrichments, apiToken);

      // Create chat message
      const chatMessage = this.createEnrichmentsChatMessage(enrichments);

      // Add chat message to search filter
      await this.addChatMessage(body.searchFilterId, chatMessage, apiToken);

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
      const filters = await this.searchPlanGenerationService.generateFilters(
        body.parsedJD,
        body.enrichments,
        body.sampleResults,
        body.dataDistribution,
        apiToken
      );

      // Store in database
      await this.storeFilters(body.searchFilterId, filters, apiToken);

      // Create chat message
      const chatMessage = this.createFiltersChatMessage(filters);

      // Add chat message to search filter
      await this.addChatMessage(body.searchFilterId, chatMessage, apiToken);

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

  private extractApiToken(headers: any): string | null {
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  private async storeSearchParameters(searchFilterId: string, searchParameters: SearchParametersResponse, apiToken: string): Promise<void> {
    try {
      const mutation = `
        mutation UpdateSearchFilter($id: ID!, $searchParameters: JSON!) {
          updateSearchFilter(
            where: { id: $id }
            data: { searchParameters: $searchParameters }
          ) {
            id
            searchParameters
          }
        }
      `;

      await this.staticGraphQLService.executeGraphQL(
        mutation,
        {
          id: searchFilterId,
          searchParameters: JSON.stringify(searchParameters)
        },
        apiToken
      );

      this.logger.log(`Stored search parameters for searchFilterId: ${searchFilterId}`);
    } catch (error) {
      this.logger.error('Error storing search parameters:', error);
      throw error;
    }
  }

  private async storeEnrichments(searchFilterId: string, enrichments: EnrichmentsResponse, apiToken: string): Promise<void> {
    try {
      const mutation = `
        mutation UpdateSearchFilter($id: ID!, $enrichments: JSON!) {
          updateSearchFilter(
            where: { id: $id }
            data: { enrichments: $enrichments }
          ) {
            id
            enrichments
          }
        }
      `;

      await this.staticGraphQLService.executeGraphQL(
        mutation,
        {
          id: searchFilterId,
          enrichments: JSON.stringify(enrichments)
        },
        apiToken
      );

      this.logger.log(`Stored enrichments for searchFilterId: ${searchFilterId}`);
    } catch (error) {
      this.logger.error('Error storing enrichments:', error);
      throw error;
    }
  }

  private async storeFilters(searchFilterId: string, filters: FiltersResponse, apiToken: string): Promise<void> {
    try {
      const mutation = `
        mutation UpdateSearchFilter($id: ID!, $filters: JSON!) {
          updateSearchFilter(
            where: { id: $id }
            data: { filters: $filters }
          ) {
            id
            filters
          }
        }
      `;

      await this.staticGraphQLService.executeGraphQL(
        mutation,
        {
          id: searchFilterId,
          filters: JSON.stringify(filters)
        },
        apiToken
      );

      this.logger.log(`Stored filters for searchFilterId: ${searchFilterId}`);
    } catch (error) {
      this.logger.error('Error storing filters:', error);
      throw error;
    }
  }

  private async getSearchParameters(searchFilterId: string, apiToken: string): Promise<SearchParametersResponse | null> {
    try {
      const query = `
        query GetSearchFilter($id: ID!) {
          searchFilter(where: { id: $id }) {
            id
            searchParameters
          }
        }
      `;

      const response = await this.staticGraphQLService.executeGraphQL(
        query,
        { id: searchFilterId },
        apiToken
      );

      const searchParameters = response.data?.searchFilter?.searchParameters;
      return searchParameters ? JSON.parse(searchParameters) : null;
    } catch (error) {
      this.logger.error('Error getting search parameters:', error);
      return null;
    }
  }

  private async addChatMessage(searchFilterId: string, chatMessage: SearchPlanChatMessage, apiToken: string): Promise<void> {
    try {
      const mutation = `
        mutation CreateChatMessage($searchFilterId: ID!, $content: String!, $metadata: JSON!) {
          createChatMessage(
            data: {
              searchFilterId: $searchFilterId
              content: $content
              metadata: $metadata
              type: ${chatMessage.type}
            }
          ) {
            id
          }
        }
      `;

      await this.staticGraphQLService.executeGraphQL(
        mutation,
        {
          searchFilterId,
          content: chatMessage.content,
          metadata: JSON.stringify(chatMessage.metadata || {})
        },
        apiToken
      );

      this.logger.log(`Added chat message for searchFilterId: ${searchFilterId}`);
    } catch (error) {
      this.logger.error('Error adding chat message:', error);
      // Don't throw error for chat message failures
    }
  }

  private createSearchParametersChatMessage(searchParameters: SearchParametersResponse): SearchPlanChatMessage {
    const content = `I've generated ${searchParameters.variations.length} search strategy variations for your ${searchParameters.metadata.searchType} ${searchParameters.metadata.searchCategory} search:

**Overall Strategy:** ${searchParameters.overallStrategy}

**Search Variations:**
${searchParameters.variations.map((variation, index) => `
${index + 1}. **${variation.name}** (${variation.type})
   - Description: ${variation.description}
   - Expected Results: ${variation.expectedResultSize}
   - Reasoning: ${variation.reasoning}
`).join('')}

**Complexity Analysis:** ${searchParameters.complexity} - ${searchParameters.reasoning}

You can now select a variation to apply to your search parameters, or generate enrichments to further refine your candidate evaluation.`;

    return {
      id: `search-params-${Date.now()}`,
      type: 'search_parameters',
      content,
      metadata: {
        searchParameters,
        actionButtons: [
          {
            id: 'select-variation',
            label: 'Select Variation',
            action: 'select_search_variation'
          },
          {
            id: 'generate-enrichments',
            label: 'Generate Enrichments',
            action: 'generate_enrichments'
          }
        ]
      },
      timestamp: new Date()
    };
  }

  private createEnrichmentsChatMessage(enrichments: EnrichmentsResponse): SearchPlanChatMessage {
    const content = `I've generated ${enrichments.enrichments.length} enrichment configurations to help evaluate your candidates:

**Enrichment Strategy:** ${enrichments.overallStrategy}

**Enrichments:**
${enrichments.enrichments.map((enrichment, index) => `
${index + 1}. **${enrichment.name}** (${enrichment.category})
   - Description: ${enrichment.description}
   - Fields: ${enrichment.fields.map(f => f.name).join(', ')}
   - Reasoning: ${enrichment.reasoning}
`).join('')}

**Overall Reasoning:** ${enrichments.reasoning}

These enrichments will create new columns in your candidate data to help you make better hiring decisions. You can now execute these enrichments or generate filters to create your final shortlist.`;

    return {
      id: `enrichments-${Date.now()}`,
      type: 'enrichments',
      content,
      metadata: {
        enrichments,
        actionButtons: [
          {
            id: 'execute-enrichments',
            label: 'Execute Enrichments',
            action: 'execute_enrichments'
          },
          {
            id: 'generate-filters',
            label: 'Generate Filters',
            action: 'generate_filters'
          }
        ]
      },
      timestamp: new Date()
    };
  }

  private createFiltersChatMessage(filters: FiltersResponse): SearchPlanChatMessage {
    const content = `I've generated a comprehensive filter strategy to help you create your final candidate shortlist:

**Filter Strategy:** ${filters.filterStrategy.name}
- Description: ${filters.filterStrategy.description}
- Target Shortlist Size: ${filters.filterStrategy.targetShortlistSize} candidates
- Priority: ${filters.filterStrategy.priority}
- Reasoning: ${filters.filterStrategy.reasoning}

**Handsontable Filters (${filters.handsontableFilters.length}):**
${filters.handsontableFilters.map((filter, index) => `
${index + 1}. ${filter.column} (${filter.type}) - ${filter.condition} ${filter.value || ''}
`).join('')}

**Candidate Search Filters (${filters.candidateSearchFilters.length}):**
${filters.candidateSearchFilters.map((filter, index) => `
${index + 1}. ${filter.label} (${filter.type})
`).join('')}

**Overall Reasoning:** ${filters.reasoning}

You can now apply these filters to create your final candidate shortlist.`;

    return {
      id: `filters-${Date.now()}`,
      type: 'filters',
      content,
      metadata: {
        filters,
        actionButtons: [
          {
            id: 'apply-filters',
            label: 'Apply Filters',
            action: 'apply_filters'
          }
        ]
      },
      timestamp: new Date()
    };
  }

  /**
   * Perform LinkedIn search to get sample results for enrichments
   */
  private async performLinkedInSearchForSample(
    searchParameters: SearchParametersResponse,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'jobs',
    apiToken: string
  ): Promise<any[]> {
    try {
      this.logger.log('Performing LinkedIn search for sample results...');
      
      // Get LinkedIn account ID
      const accountId = await this.candidateSearchService.getLinkedInAccountId(apiToken);
      
      // Select the first variation for sample search
      const selectedVariation = searchParameters.variations[0];
      if (!selectedVariation) {
        this.logger.warn('No search variations available for sample search');
        return [];
      }

      // Perform search based on type and category
      let searchResults;
      const searchParams = selectedVariation.searchParameters;
      
      if (searchType === 'classic' && searchCategory === 'people') {
        searchResults = await this.linkedInSearchService.searchPeople(
          searchParams,
          accountId,
          { limit: 15 } // Get top 15 results
        );
      } else if (searchType === 'classic' && searchCategory === 'companies') {
        searchResults = await this.linkedInSearchService.searchCompanies(
          searchParams,
          accountId,
          { limit: 15 }
        );
      } else if (searchType === 'classic' && searchCategory === 'jobs') {
        searchResults = await this.linkedInSearchService.searchJobs(
          searchParams,
          accountId,
          { limit: 15 }
        );
      } else if (searchType === 'sales_navigator' && searchCategory === 'people') {
        searchResults = await this.linkedInSearchService.searchPeopleSalesNavigator(
          searchParams,
          accountId,
          { limit: 15 }
        );
      } else if (searchType === 'sales_navigator' && searchCategory === 'companies') {
        searchResults = await this.linkedInSearchService.searchCompaniesSalesNavigator(
          searchParams,
          accountId,
          { limit: 15 }
        );
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        searchResults = await this.linkedInSearchService.searchPeopleRecruiter(
          searchParams,
          accountId,
          { limit: 15 }
        );
      } else {
        this.logger.warn(`Unsupported search type/category combination: ${searchType}/${searchCategory}`);
        return [];
      }

      const sampleResults = searchResults?.items?.slice(0, 10) || []; // Take top 10
      this.logger.log(`Retrieved ${sampleResults.length} sample results for enrichments`);
      
      return sampleResults;
    } catch (error) {
      this.logger.error('Error performing LinkedIn search for sample results:', error);
      // Don't throw error, just return empty array to continue without sample data
      return [];
    }
  }
}
