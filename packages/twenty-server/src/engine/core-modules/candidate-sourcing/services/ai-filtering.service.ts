import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiFilter,
  mutationToCreateOneCandidateEnrichment,
} from 'twenty-shared';

import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { AiFilterConfig, AiFilteringProcessorService } from './ai-filtering-processor.service';
import { AiFilteringProgressPubSubService } from './ai-filtering-progress-pubsub.service';
import { CandidateDataService } from './candidate-data.service';
import { CandidateFieldValueService } from './candidate-field-value.service';

export interface ProcessAiFiltersRequest {
  aiFilters: AiFilter[];
  objectNameSingular: string;
  availableSortDefinitions: any[];
  availableFilterDefinitions: any[];
  objectRecordId: string;
  selectedRecordIds: string[];
  jobId: string;
}

export interface ProcessAiFiltersResponse {
  status: 'Success' | 'Failed';
  error?: any;
}

@Injectable()
export class AiFilteringService {
  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly configService: ConfigService,
    private readonly candidateDataService: CandidateDataService,
    private readonly candidateFieldValueService: CandidateFieldValueService,
    private readonly aiFilteringProcessorService: AiFilteringProcessorService,
    private readonly aiFilteringProgressPubSubService: AiFilteringProgressPubSubService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  async processAiFilters(
    request: ProcessAiFiltersRequest,
    apiToken: string,
    origin: string,
  ): Promise<ProcessAiFiltersResponse> {
    let recruiterId: string | null = null;

    try {
      console.log('Processing AI filters locally in TypeScript service');

      if (!request) {
        throw new Error('Request object is required');
      }

      if (!apiToken || apiToken.trim().length === 0) {
        throw new Error('API token is required');
      }

      const {
        aiFilters,
        jobId,
        selectedRecordIds,
      } = request;

      if (!aiFilters || !Array.isArray(aiFilters)) {
        throw new Error('AI filters array is required');
      }

      if (!jobId || jobId.trim().length === 0) {
        throw new Error('Job ID is required');
      }

      console.log('aiFilters:', aiFilters?.length);
      console.log('selectedRecordIds:', selectedRecordIds?.length);

      try {
        const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
        recruiterId = currentUser?.workspaceMember?.id;
      } catch (userError) {
        console.warn('Could not get current user for progress reporting:', userError.message);
      }

      const validAiFilters = aiFilters.filter(e =>
        e &&
        e.modelName &&
        e.modelName.trim() !== '' &&
        e.prompt &&
        e.prompt.trim() !== ''
      );

      if (validAiFilters.length === 0) {
        console.log('No valid AI filters to process');
        return { status: 'Success' };
      }

      console.log(`Processing ${validAiFilters.length} valid AI filters out of ${aiFilters.length} total`);

      for (const aiFilter of validAiFilters) {
        try {
          await this.createOneAiFilter(aiFilter, request.jobId, apiToken);
        } catch (createError) {
          console.error('Error creating AI filter:', createError.message);
        }
      }

      console.log('Fetching candidates data');
      const candidates = await this.candidateDataService.fetchCandidatesForJob(
        jobId,
        selectedRecordIds,
        apiToken
      );

      if (recruiterId) {
        try {
          await this.aiFilteringProgressPubSubService.publishAiFilteringStarted(
            recruiterId,
            validAiFilters.length,
            candidates.length
          );
        } catch (pubSubError) {
          console.warn('Pub-sub notification failed:', pubSubError.message);
        }
      }

      if (candidates.length === 0) {
        console.log('No candidates found for processing');
        return { status: 'Success' };
      }

      console.log(`Found ${candidates.length} candidates to process`);

      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);
      const openaiApiKey = await this.workspaceQueryService.getWorkspaceApiKey(workspaceId, 'openaikey');

      if (!openaiApiKey) {
        throw new Error('OpenAI API key not found in workspace API keys');
      }

      const aiFilterConfigs: AiFilterConfig[] = validAiFilters.map(e => ({
        modelName: e.modelName,
        prompt: e.prompt,
        selectedModel: e.selectedModel || 'gpt-5.1-chat-latest',
        fields: e.fields || [],
        selectedMetadataFields: e.selectedMetadataFields || [],
        embeddingsModel: false
      }));

      for (const config of aiFilterConfigs) {
        if (!config.fields || config.fields.length === 0) {
          throw new Error(`AI filter "${config.modelName}" has no output fields defined`);
        }
        if (!config.selectedMetadataFields || config.selectedMetadataFields.length === 0) {
          throw new Error(`AI filter "${config.modelName}" has no input fields selected`);
        }
      }

      const aiFilterResults = await this.aiFilteringProcessorService.processAiFilters(
        candidates,
        aiFilterConfigs,
        openaiApiKey,
        async (progress, current, total) => {
          if (recruiterId) {
            try {
              await this.aiFilteringProgressPubSubService.publishAiFilteringProcessing(
                recruiterId,
                progress,
                current,
                total,
                validAiFilters.length
              );
            } catch (pubSubError) {
              console.warn('Pub-sub progress notification failed:', pubSubError.message);
            }
          }
        }
      );

      console.log(`AI filter processing completed. Got ${aiFilterResults.length} results`);

      const allFieldNames = new Set<string>();
      aiFilterConfigs.forEach(config => {
        config.fields.forEach(field => allFieldNames.add(field.name));
      });

      if (allFieldNames.size > 0) {
        try {
          await this.candidateFieldValueService.processAiFilterResults(
            aiFilterResults,
            Array.from(allFieldNames),
            apiToken
          );
        } catch (fieldError) {
          console.error('Error processing field values:', fieldError.message);
        }
      }

      if (recruiterId) {
        try {
          await this.aiFilteringProgressPubSubService.publishAiFilteringCompleted(
            recruiterId,
            candidates.length,
            validAiFilters.length
          );
        } catch (pubSubError) {
          console.warn('Pub-sub completion notification failed:', pubSubError.message);
        }
      }

      console.log('AI filter processing completed successfully');
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in AI filtering service:', err);

      if (recruiterId) {
        try {
          await this.aiFilteringProgressPubSubService.publishAiFilteringError(
            recruiterId,
            err.message || 'Unknown error occurred'
          );
        } catch (pubSubError) {
          console.warn('Pub-sub error notification failed:', pubSubError.message);
        }
      }

      return { status: 'Failed', error: err.message || 'Unknown error occurred' };
    }
  }

  async createOneAiFilter(
    aiFilter: AiFilter,
    jobId: string,
    apiToken: string,
  ): Promise<any> {
    const graphqlVariables = {
      input: {
        name: aiFilter.modelName,
        modelName: aiFilter.modelName,
        prompt: aiFilter.prompt,
        selectedModel: aiFilter.selectedModel,
        fields: aiFilter.fields,
        selectedMetadataFields: aiFilter.selectedMetadataFields,
        jobId: jobId,
      },
    };

    const response = await this.staticGraphQLService.executeGraphQL(
      mutationToCreateOneCandidateEnrichment,
      graphqlVariables,
      apiToken
    );

    return response.data;
  }

  async computeTokens(
    request: ProcessAiFiltersRequest,
    apiToken: string
  ): Promise<{
    totalInputTokens: number;
    totalOutputTokens: number;
    estimatedCost: number;
    totalCandidates: number;
  }> {
    try {
      const { aiFilters, jobId, selectedRecordIds } = request;

      const validAiFilters = aiFilters.filter(e => e.modelName && e.modelName.trim() !== '');

      if (validAiFilters.length === 0) {
        return {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          estimatedCost: 0,
          totalCandidates: 0
        };
      }

      const candidates = await this.candidateDataService.fetchCandidatesForJob(
        jobId,
        selectedRecordIds,
        apiToken
      );

      if (candidates.length === 0) {
        return {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          estimatedCost: 0,
          totalCandidates: 0
        };
      }

      const aiFilterConfigs: AiFilterConfig[] = validAiFilters.map(e => ({
        modelName: e.modelName,
        prompt: e.prompt,
        selectedModel: e.selectedModel || 'gpt-5.1-chat-latest',
        fields: e.fields || [],
        selectedMetadataFields: e.selectedMetadataFields || [],
        embeddingsModel: false
      }));

      const tokenAnalysis = await this.aiFilteringProcessorService.computeTokensForAiFilters(
        candidates,
        aiFilterConfigs
      );

      return tokenAnalysis;
    } catch (error) {
      console.error('Error computing tokens:', error);
      throw error;
    }
  }
}
